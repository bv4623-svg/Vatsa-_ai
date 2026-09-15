from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv
load_dotenv()

from app.routers import chat, profile, conversations
from app.routers import auth as auth_router
from app.core.classifier import IntentClassifier
from app.core.router_engine import VatsaRouter
from intents_data import INTENTS
from app.database import init_db

# Initialize intent classifier and router as singletons
intent_classifier = IntentClassifier()
vatsa_router = VatsaRouter()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    yield
    # Shutdown (if needed)

app = FastAPI(title="Vatsa AI Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all routers
app.include_router(chat.router)
app.include_router(profile.router)
app.include_router(auth_router.router)  # /auth/me, /auth/onboarding, etc.
app.include_router(conversations.router)

# Intent classification endpoints (internal use by router, but exposed for debugging)
from pydantic import BaseModel, Field
from typing import List, Optional

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
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Unknown intent: {intent_name}")
    return {intent_name: INTENTS[intent_name]}

@app.post("/api/classify", response_model=ClassifyResponse)
def classify(req: ClassifyRequest):
    if not req.query.strip():
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Query must not be empty")
    result = intent_classifier.classify(req.query, top_k=req.top_k)
    return result.to_dict()

# Chat endpoint that uses the router (for Code page streaming)
@app.post("/api/chat")
async def chat_endpoint(req: ClassifyRequest):
    if not req.query.strip():
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Query must not be empty")
    return await vatsa_router.route(
        query=req.query,
        preferred_model=req.model,
        user_tier=req.user_tier
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
