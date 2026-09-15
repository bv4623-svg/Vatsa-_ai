import sys
import os
import logging
from pathlib import Path
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# UTF-8 encoding fix for Windows console
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

# Load environment variables
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(env_path if env_path.exists() else None)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from app.database import init_db
from app.routers import auth, chat, conversations, memory, payment, tokens, upload

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("VatsaAI")

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    logger.info("[OK] Vatsa AI database initialized.")
    yield

app = FastAPI(
    title="Vatsa AI Backend",
    description="Next-generation AI routing, memory, and code workspace platform",
    version="2.5",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Modular Routers
app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(conversations.router)
app.include_router(memory.router)
app.include_router(payment.router)
app.include_router(tokens.router)
app.include_router(upload.router)

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "Vatsa AI Backend",
        "version": "2.5",
        "database": "sqlite/vatsa.db"
    }

@app.get("/")
def root():
    return {
        "message": "Welcome to Vatsa AI API",
        "version": "2.5",
        "docs": "/docs"
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
