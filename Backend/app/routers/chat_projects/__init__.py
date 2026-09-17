"""Projects API: create/list/get/update/delete/archive plus chat/file
membership, backed by ChatProject (table chat_projects) -- named to avoid
colliding with the pre-existing, unrelated code-workspace Project model.
One APIRouter combining the split submodules, mounted once from app.main
the same way app.routers.library's package is.
"""
from fastapi import APIRouter

from app.routers.chat_projects.crud import router as crud_router
from app.routers.chat_projects.membership import router as membership_router

router = APIRouter(tags=["projects"])
router.include_router(crud_router)
router.include_router(membership_router)

__all__ = ["router"]
