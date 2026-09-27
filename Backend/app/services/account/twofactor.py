import base64
import binascii
import hashlib
import io
import re
import secrets
from typing import List, Optional

import pyotp
import qrcode

from app.models.user import User
from app.services.crypto import (
    DecryptionError, decrypt_str, encrypt_str, keyed_hash, keyed_hash_matches, needs_reencrypt,
)

BACKUP_CODE_PURPOSE = "2fa-backup-code"
_LEGACY_SHA256 = re.compile(r"^[0-9a-f]{64}$")

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


def seal_totp_secret(secret: str) -> str:
    """The form stored in users.totp_secret: encrypted at rest, so a copy of
    the database alone can't generate 2FA codes."""
    return encrypt_str(secret)


def verify_totp_code(stored_secret: Optional[str], code: str) -> bool:
    """`stored_secret` is the users.totp_secret value (encrypted, or legacy
    plaintext). Fails closed if it can't be decrypted or decoded."""
    if not stored_secret or not code:
        return False
    try:
        secret = decrypt_str(stored_secret)
        return pyotp.TOTP(secret).verify(code.strip(), valid_window=1)
    except (DecryptionError, binascii.Error, ValueError):
        return False


def upgrade_totp_secret(user: User) -> None:
    """After a successful verification: re-encrypt a legacy plaintext secret,
    or one sealed under an old key, under the primary key."""
    if user.totp_secret and needs_reencrypt(user.totp_secret):
        user.totp_secret = encrypt_str(decrypt_str(user.totp_secret))


def _legacy_hash(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


def generate_backup_codes() -> List[str]:
    """Returns the PLAINTEXT codes, shown to the user exactly once. Only
    keyed hashes are ever persisted (see hash_backup_codes)."""
    return [secrets.token_hex(4) for _ in range(BACKUP_CODE_COUNT)]


def hash_backup_codes(codes: List[str]) -> List[str]:
    """HMAC with the server's data key: an 8-hex-char code has only 2^32
    possibilities, so a plain hash is reversed from a DB dump in seconds."""
    return [keyed_hash(c, BACKUP_CODE_PURPOSE) for c in codes]


def _matches(stored: str, code: str) -> bool:
    if _LEGACY_SHA256.match(stored):  # written before keyed hashing existed
        return secrets.compare_digest(stored, _legacy_hash(code))
    return keyed_hash_matches(stored, code, BACKUP_CODE_PURPOSE)


def consume_backup_code(user: User, code: str) -> bool:
    """Real one-time-use check: removes the matching hash on success so
    the same backup code can never be replayed."""
    if not user.backup_codes or not code:
        return False
    code = code.strip()
    hashes = list(user.backup_codes)
    for stored in hashes:
        if _matches(stored, code):
            hashes.remove(stored)
            user.backup_codes = hashes
            return True
    return False
