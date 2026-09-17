import base64
import hashlib
import io
import secrets
from typing import List, Optional

import pyotp
import qrcode

from app.models.user import User

ISSUER = "Vatsa AI"
BACKUP_CODE_COUNT = 8


def generate_totp_secret() -> str:
    return pyotp.random_base32()


def generate_qr_data_uri(secret: str, email: str) -> str:
    """A base64 PNG data URI rendered entirely server-side -- the TOTP
    secret is never sent to any third-party QR-generation service."""
    uri = pyotp.totp.TOTP(secret).provisioning_uri(name=email, issuer_name=ISSUER)
    img = qrcode.make(uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}"


def verify_totp_code(secret: str, code: str) -> bool:
    if not secret or not code:
        return False
    return pyotp.TOTP(secret).verify(code.strip(), valid_window=1)


def _hash_backup_code(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


def generate_backup_codes() -> List[str]:
    """Returns the PLAINTEXT codes, shown to the user exactly once. Only
    their hashes are ever persisted (see hashed list below)."""
    return [secrets.token_hex(4) for _ in range(BACKUP_CODE_COUNT)]


def hash_backup_codes(codes: List[str]) -> List[str]:
    return [_hash_backup_code(c) for c in codes]


def consume_backup_code(user: User, code: str) -> bool:
    """Real one-time-use check: removes the matching hash on success so
    the same backup code can never be replayed."""
    if not user.backup_codes or not code:
        return False
    target = _hash_backup_code(code.strip())
    hashes = list(user.backup_codes)
    if target not in hashes:
        return False
    hashes.remove(target)
    user.backup_codes = hashes
    return True
