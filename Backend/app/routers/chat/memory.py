from app.database import SessionLocal
from app.services.memory_extractor import extract_facts
from app.services.memory_service import MemoryService
from app.routers.chat.router import logger


def _extract_and_save_memory(user_id: int, message_text: str) -> None:
    """
    Runs after the response has already been sent (via BackgroundTasks),
    so extraction never adds latency to the chat request. Uses its own
    DB session -- the request-scoped session from `get_db` is closed by
    the time this runs.
    """
    db = SessionLocal()
    try:
        facts = extract_facts(message_text)
        for fact in facts:
            try:
                MemoryService.upsert_memory(
                    db,
                    user_id=user_id,
                    mem_type=fact["type"],
                    category=fact["category"],
                    content=fact["content"],
                    confidence=fact.get("confidence", 0.8),
                )
            except Exception as e:
                logger.warning(f"Failed to save extracted memory for user {user_id}: {e}")
    except Exception as e:
        logger.warning(f"Memory extraction failed for user {user_id}: {e}")
    finally:
        db.close()
