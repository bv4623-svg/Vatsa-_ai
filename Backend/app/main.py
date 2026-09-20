import sys

# Windows consoles default to a legacy codepage (cp1252) that can't encode the
# emoji used in several log/print statements across this codebase; without this
# those prints raise UnicodeEncodeError and crash the process at import time.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        try:
            _stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(env_path if env_path.exists() else None)

import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from pydantic import BaseModel, Field
from typing import List, Optional

from app.middleware import SecurityHeadersMiddleware
from app.config.urls import allowed_origins

from app.routers import chat, profile, conversations, auth as auth_router
from app.routers import memory, payment, payment_history, tokens, upload, files, vision
from app.routers import library as library_router
from app.routers import scheduled_tasks as scheduled_tasks_router
from app.routers import chat_projects as chat_projects_router
from app.routers import account as account_router
from app.core.classifier import IntentClassifier
from intents_data import INTENTS
from app.database import init_db
from app.services.scheduled_tasks import init_scheduler, shutdown_scheduler
from app.services.account import register_account_jobs

# Initialize intent classifier singleton
intent_classifier = IntentClassifier()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    init_scheduler()
    register_account_jobs()
    yield
    shutdown_scheduler()


app = FastAPI(title="Vatsa AI Backend", lifespan=lifespan)

app.add_middleware(SecurityHeadersMiddleware)

# ALLOWED_ORIGINS if set, else the live frontend and API (app/config/urls.py).
_allowed_origins = allowed_origins()

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all routers
app.include_router(chat.router)
app.include_router(profile.router)
app.include_router(auth_router.router)
app.include_router(conversations.router)
app.include_router(memory.router)
app.include_router(payment.router)
app.include_router(payment_history.router)
app.include_router(tokens.router)
app.include_router(upload.router)
app.include_router(files.router)
app.include_router(vision.router)
app.include_router(library_router.router)
app.include_router(scheduled_tasks_router.router)
app.include_router(chat_projects_router.router)
app.include_router(account_router.router)


# Intent classification endpoints
class ClassifyRequest(BaseModel):
    query: str = Field(..., min_length=1)
    top_k: int = Field(5, ge=1, le=27)
    model: Optional[str] = None
    user_tier: str = Field("free")


class IntentMatchResponse(BaseModel):
    intent: str
    confidence: float
    band: str
    matched_keywords: List[str]


class ClassifyResponse(BaseModel):
    query: str
    primary_intent: IntentMatchResponse
    secondary_intents: List[IntentMatchResponse]
    is_multi_intent: bool
    disclaimer: Optional[str] = None


@app.get("/health")
def health():
    return {"status": "ok", "intents_loaded": len(INTENTS)}


@app.get("/intents")
def list_intents():
    return {
        name: {
            "description": data["description"],
            "keywords": data["keywords"],
            "related_intents": data.get("related_intents", []),
        }
        for name, data in INTENTS.items()
    }


@app.get("/intents/{intent_name}")
def get_intent(intent_name: str):
    intent_name = intent_name.upper()
    if intent_name not in INTENTS:
        raise HTTPException(status_code=404, detail=f"Unknown intent: {intent_name}")
    return {intent_name: INTENTS[intent_name]}


@app.post("/api/classify", response_model=ClassifyResponse)
def classify(req: ClassifyRequest):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query must not be empty")

    result = intent_classifier.classify(req.query, top_k=req.top_k)
    return result.to_dict()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
