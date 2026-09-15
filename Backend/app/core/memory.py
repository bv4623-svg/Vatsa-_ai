from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.memory import Memory

def get_relevant_memories(user_id: int, query: str, limit: int = 5) -> str:
    db = SessionLocal()
    try:
        memories = db.query(Memory).filter(Memory.user_id == user_id).order_by(Memory.created_at.desc()).limit(limit).all()
        return " | ".join([m.content for m in memories]) if memories else ""
    finally:
        db.close()
