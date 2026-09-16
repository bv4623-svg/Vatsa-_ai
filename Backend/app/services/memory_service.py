from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.models.memory import Memory

class MemoryService:
    @staticmethod
    def get_user_memories(
        db: Session,
        user_id: int,
        mem_type: Optional[str] = None,
        category: Optional[str] = None,
        limit: int = 50
    ) -> List[Memory]:
        q = db.query(Memory).filter(Memory.user_id == user_id)
        if mem_type:
            q = q.filter(Memory.type == mem_type)
        if category:
            q = q.filter(Memory.category == category)
        # Filter unexpired
        now = datetime.utcnow()
        q = q.filter((Memory.expires_at.is_(None)) | (Memory.expires_at > now))
        return q.order_by(Memory.created_at.desc()).limit(limit).all()

    @staticmethod
    def create_memory(
        db: Session,
        user_id: int,
        content: str,
        mem_type: str = "preference",
        category: Optional[str] = None,
        source: str = "user",
        confidence: float = 0.8,
        expires_at: Optional[datetime] = None
    ) -> Memory:
        mem = Memory(
            user_id=user_id,
            content=content.strip(),
            type=mem_type,
            category=category,
            source=source,
            confidence=confidence,
            expires_at=expires_at
        )
        db.add(mem)
        db.commit()
        db.refresh(mem)
        return mem

    @staticmethod
    def update_memory(
        db: Session,
        user_id: int,
        memory_id: int,
        updates: dict
    ) -> Optional[Memory]:
        mem = db.query(Memory).filter(Memory.id == memory_id, Memory.user_id == user_id).first()
        if not mem:
            return None
        for k, v in updates.items():
            if hasattr(mem, k) and v is not None:
                setattr(mem, k, v)
        mem.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(mem)
        return mem

    @staticmethod
    def delete_memory(db: Session, user_id: int, memory_id: int) -> bool:
        mem = db.query(Memory).filter(Memory.id == memory_id, Memory.user_id == user_id).first()
        if not mem:
            return False
        db.delete(mem)
        db.commit()
        return True

    @staticmethod
    def clear_all_memories(db: Session, user_id: int) -> int:
        count = db.query(Memory).filter(Memory.user_id == user_id).delete()
        db.commit()
        return count

    @staticmethod
    def upsert_memory(
        db: Session,
        user_id: int,
        mem_type: str,
        category: str,
        content: str,
        confidence: float = 0.8,
        source: str = "extracted",
        max_per_user: int = 200,
    ) -> Memory:
        """
        Insert a new long-term fact, or update it in place if this user
        already has a memory in the same category (e.g. re-stating their
        name or favorite color overwrites the old value instead of piling
        up duplicates). Caps total memories per user, evicting the oldest
        first once the cap is exceeded.
        """
        existing = (
            db.query(Memory)
            .filter(Memory.user_id == user_id, Memory.category == category)
            .first()
        )
        if existing:
            existing.content = content.strip()
            existing.type = mem_type
            existing.confidence = confidence
            existing.source = source
            existing.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(existing)
            return existing

        mem = Memory(
            user_id=user_id,
            content=content.strip(),
            type=mem_type,
            category=category,
            source=source,
            confidence=confidence,
        )
        db.add(mem)
        db.commit()
        db.refresh(mem)

        total = db.query(Memory).filter(Memory.user_id == user_id).count()
        if total > max_per_user:
            oldest = (
                db.query(Memory)
                .filter(Memory.user_id == user_id)
                .order_by(Memory.created_at.asc())
                .limit(total - max_per_user)
                .all()
            )
            for old in oldest:
                db.delete(old)
            db.commit()

        return mem

    @staticmethod
    def get_context_summary(db: Session, user_id: int) -> str:
        """Returns relevant user memories as concise context for the LLM prompt."""
        memories = MemoryService.get_user_memories(db, user_id, limit=20)
        if not memories:
            return ""
        lines = [f"- {m.content}" for m in memories if m.content.strip()]
        return "\n".join(lines)
