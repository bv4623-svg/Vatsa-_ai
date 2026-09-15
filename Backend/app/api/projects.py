from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.project import Project
from app.models.file import File
from app.schemas.project import ProjectCreate, ProjectResponse, FileUpdate
from app.workspace.project_manager import ProjectManager
from app.providers.llm_client import RouterClient

router = APIRouter(prefix="/projects", tags=["projects"])

@router.post("/", response_model=ProjectResponse)
async def create_project(
    data: ProjectCreate,
    db: AsyncSession = Depends(get_db)
):
    llm = RouterClient()
    pm = ProjectManager(db, llm, "./workspace")
    project = await pm.create_project(data.chat_id, data.title, data.framework)
    return project

@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: int, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    return project

@router.put("/{project_id}/files")
async def update_files(
    project_id: int,
    updates: List[FileUpdate],  # [{path, content}] or patches
    db: AsyncSession = Depends(get_db)
):
    llm = RouterClient()
    pm = ProjectManager(db, llm, "./workspace")
    # If updates are full files:
    await pm.save_files_from_ai(project_id, [{"path": u.path, "content": u.content} for u in updates])
    return {"status": "ok"}

@router.post("/{project_id}/build")
async def build_project(
    project_id: int,
    db: AsyncSession = Depends(get_db)
):
    llm = RouterClient()
    pm = ProjectManager(db, llm, "./workspace")
    # We need a way to stream logs; maybe use WebSocket or callback.
    # For simplicity, we just trigger build and return.
    success = await pm.build_project(project_id, print)  # Replace with proper logging
    return {"success": success}