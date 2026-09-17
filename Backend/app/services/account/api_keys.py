import hashlib
import secrets
import uuid
from datetime import datetime, timezone
from typing import Optional, Tuple

from sqlalchemy.orm import Session

from app.models.api_key import ApiKey
from app.models.user import User

KEY_PREFIX = "vsk_"


def _hash_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode()).hexdigest()


def generate_api_key(db: Session, user_id: int, name: str) -> Tuple[ApiKey, str]:
    """Returns (row, plaintext_key) -- the plaintext is never stored and
    never retrievable again after this call returns."""
    raw = KEY_PREFIX + secrets.token_urlsafe(32)
    row = ApiKey(
        id=uuid.uuid4().hex,
        user_id=user_id,
        name=name,
        key_prefix=raw[: len(KEY_PREFIX) + 6],
        key_hash=_hash_key(raw),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row, raw


def verify_api_key(db: Session, raw_key: str) -> Optional[User]:
    """Real auth path: looks up the key by hash, rejects revoked keys,
    and records real usage -- not a decorative lastUsedAt."""
    if not raw_key or not raw_key.startswith(KEY_PREFIX):
        return None
    row = db.query(ApiKey).filter(ApiKey.key_hash == _hash_key(raw_key)).first()
    if not row or row.revoked:
        return None
    row.last_used_at = datetime.now(timezone.utc)
    db.commit()
    return db.query(User).filter(User.id == row.user_id).first()
