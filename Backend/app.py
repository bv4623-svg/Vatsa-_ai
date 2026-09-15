"""
VATSA AI ROUTER - INTENT CLASSIFIER API

FastAPI service exposing the Intent Catalog classifier.

Per the catalog's critical rules, this service:
  - does NOT select an AI model
  - does NOT classify difficulty levels
  - does NOT generate responses
  - ONLY returns structured intent classification data

Updated to accept user-selected model and user tier for smart routing.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional

from app.core.classifier import IntentClassifier
from app.core.router_engine import VatsaRouter
from intents_data import INTENTS

app = FastAPI(
    title="Vatsa AI Router - Intent Classifier",
    description="Intent classification service based on the Intent Catalog v1.0",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

classifier = IntentClassifier()
router = VatsaRouter()                     # ✅ sahi object


class ClassifyRequest(BaseModel):
    query: str = Field(..., min_length=1, description="The user query to classify")
    top_k: int = Field(5, ge=1, le=27, description="Max number of intents to consider")
    model: Optional[str] = Field(None, description="User-selected model (overrides auto-routing)")
    user_tier: str = Field("free", description="User tier: free or premium")  # ✅ ADDED


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
    """Return the full structured intent catalog (names, descriptions, keywords)."""
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


@app.post("/classify", response_model=ClassifyResponse)
def classify(req: ClassifyRequest):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query must not be empty")
    result = classifier.classify(req.query, top_k=req.top_k)
    return result.to_dict()


@app.post("/chat")
async def chat(req: ClassifyRequest):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query must not be empty")
    # ✅ Pass model AND user_tier to router
    return await router.route(
        query=req.query,
        preferred_model=req.model,
        user_tier=req.user_tier
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)