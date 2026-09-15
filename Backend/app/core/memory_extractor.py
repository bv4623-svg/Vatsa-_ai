from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.memory import Memory
import logging
logger = logging.getLogger(__name__)

def extract_and_store_memory(user_id: int, user_message: str, ai_response: str):
    db = SessionLocal()
    try:
        if len(user_message) > 15 and not user_message.endswith("?"):
            mem = Memory(user_id=user_id, content=user_message, source="user")
            db.add(mem)
            db.commit()
    except Exception as e:
        logger.error(f"Memory extraction failed: {e}")
        db.rollback()
    finally:
        db.close()
