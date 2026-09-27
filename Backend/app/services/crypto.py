"""At-rest protection for small secrets.

- encrypt_str / decrypt_str: reversible encryption (Fernet: AES-128-CBC +
  HMAC-SHA256) for values the server must read back, e.g. TOTP seeds.
- keyed_hash / keyed_hash_matches: one-way HMAC-SHA256 for values the
  server only compares, e.g. 2FA backup codes. Unlike a plain hash, a
  database copy alone can't be brute-forced without the key.

Keys (read on every call, so tests and rotations take effect immediately):
- DATA_ENCRYPTION_KEY: the primary key, a Fernet key. Generate one with
    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
- DATA_ENCRYPTION_KEYS_OLD: optional, comma-separated previous keys, still
  accepted for decryption/verification during a rotation.
- Fallback: a key derived from JWT_SECRET_KEY (HKDF). It is always accepted
  for decryption, and used as the primary only if DATA_ENCRYPTION_KEY is
  unset. Set DATA_ENCRYPTION_KEY and run scripts/reencrypt_two_factor.py
  BEFORE rotating JWT_SECRET_KEY (see SECURITY_ACTIONS.md).
"""
import base64
import hashlib
import hmac
import os
from typing import List, Optional

from cryptography.fernet import Fernet, InvalidToken, MultiFernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

ENC_PREFIX = "enc:v1:"
HASH_PREFIX = "h1:"


class DecryptionError(Exception):
    """Stored ciphertext can't be decrypted with any configured key."""


def _derive(secret: str, info: bytes) -> bytes:
    raw = HKDF(algorithm=hashes.SHA256(), length=32, salt=None, info=info).derive(secret.encode())
    return base64.urlsafe_b64encode(raw)


def _jwt_derived_key() -> Optional[bytes]:
    jwt_secret = os.getenv("JWT_SECRET_KEY") or os.getenv("SECRET_KEY")
    return _derive(jwt_secret, b"vatsa-data-encryption-v1") if jwt_secret else None


def _keys() -> List[bytes]:
    """Primary first, then old keys, then the JWT-derived fallback."""
    keys: List[bytes] = []
    primary = (os.getenv("DATA_ENCRYPTION_KEY") or "").strip()
    if primary:
        keys.append(primary.encode())
    for old in (os.getenv("DATA_ENCRYPTION_KEYS_OLD") or "").split(","):
        if old.strip():
            keys.append(old.strip().encode())
    derived = _jwt_derived_key()
    if derived and derived not in keys:
        keys.append(derived)
    if not keys:
        raise RuntimeError("No encryption key: set DATA_ENCRYPTION_KEY (or JWT_SECRET_KEY)")
    return keys


def _fernet() -> MultiFernet:
    return MultiFernet([Fernet(k) for k in _keys()])


def is_encrypted(value: Optional[str]) -> bool:
    return bool(value) and value.startswith(ENC_PREFIX)


def encrypt_str(value: Optional[str]) -> Optional[str]:
    if not value:
        return value
    return ENC_PREFIX + _fernet().encrypt(value.encode()).decode()


def decrypt_str(value: Optional[str]) -> Optional[str]:
    """Returns the plaintext. Values without the prefix are legacy plaintext
    and are returned unchanged (callers re-encrypt them)."""
    if not value or not is_encrypted(value):
        return value
    try:
        return _fernet().decrypt(value[len(ENC_PREFIX):].encode()).decode()
    except (InvalidToken, ValueError) as e:
        raise DecryptionError("stored value can't be decrypted with the configured keys") from e


def needs_reencrypt(value: Optional[str]) -> bool:
    """True for legacy plaintext, or ciphertext not under the primary key."""
    if not value:
        return False
    if not is_encrypted(value):
        return True
    token = value[len(ENC_PREFIX):].encode()
    try:
        Fernet(_keys()[0]).decrypt(token)
        return False
    except InvalidToken:
        return True


def _hmac(key: bytes, value: str, purpose: str) -> str:
    subkey = hashlib.sha256(key + b"|" + purpose.encode()).digest()
    return hmac.new(subkey, value.encode(), hashlib.sha256).hexdigest()


def keyed_hash(value: str, purpose: str) -> str:
    return HASH_PREFIX + _hmac(_keys()[0], value, purpose)


def keyed_hash_matches(stored: str, value: str, purpose: str) -> bool:
    if not stored.startswith(HASH_PREFIX):
        return False
    digest = stored[len(HASH_PREFIX):]
    return any(hmac.compare_digest(digest, _hmac(k, value, purpose)) for k in _keys())
