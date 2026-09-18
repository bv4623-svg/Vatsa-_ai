import os
import hashlib
import secrets
import bcrypt
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Union
from jose import jwt, JWTError

SECRET_KEY = os.getenv('JWT_SECRET_KEY') or os.getenv('SECRET_KEY')
if not SECRET_KEY:
    raise RuntimeError(
        "JWT_SECRET_KEY is not set. Refusing to start with no signing secret "
        "(there is no hardcoded fallback -- see .env.example). Generate one "
        "with: python -c \"import secrets; print(secrets.token_urlsafe(64))\""
    )
ALGORITHM = os.getenv('JWT_ALGORITHM', 'HS256')
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv('ACCESS_TOKEN_EXPIRE_MINUTES', 60 * 24 * 7))  # 7 days

def get_password_hash(password: str) -> str:
    """bcrypt, cost 12. Older accounts hashed with the previous pbkdf2_sha256
    scheme keep working (verify_password below still checks that format) --
    they're upgraded to bcrypt automatically the next time they log in via
    verify_password's rehash-on-verify path."""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password:
        return False
    try:
        if hashed_password.startswith('pbkdf2_sha256$'):
            parts = hashed_password.split('$')
            if len(parts) == 4:
                algorithm, iterations, salt, hash_hex = parts
                dk = hashlib.pbkdf2_hmac('sha256', plain_password.encode(), salt.encode(), int(iterations))
                return dk.hex() == hash_hex
            return False
        return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())
    except Exception:
        return False

def needs_rehash(hashed_password: str) -> bool:
    """True for the legacy pbkdf2_sha256 format, so callers that just
    verified a password successfully can upgrade the stored hash to bcrypt
    without forcing every existing user to reset their password."""
    return bool(hashed_password) and hashed_password.startswith('pbkdf2_sha256$')

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if "sub" in to_encode and to_encode["sub"] is not None:
        to_encode["sub"] = str(to_encode["sub"])
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({'exp': expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None


def create_media_token(user_id: int) -> str:
    """
    A token for <img src="..."> URLs, where no Authorization header can
    be attached. Scoped to "media" so it's useless against any other
    endpoint (only app.auth.dependencies.get_user_for_media checks for
    this scope) even if it leaks via browser history or referrer headers.
    Matches the main session token's lifetime so images stay viewable
    for as long as a normal session would.
    """
    return create_access_token({"sub": str(user_id), "scope": "media"})
