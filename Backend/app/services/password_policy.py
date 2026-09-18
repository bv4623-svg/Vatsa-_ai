"""Password strength policy: length, a small deny-list of the most-guessed
passwords, and a live check against Have I Been Pwned's breach corpus.

HIBP's k-anonymity API (https://haveibeenpwned.com/API/v3#PwnedPasswords)
only ever receives the first 5 hex characters of the password's SHA-1 --
the full password (and its full hash) never leaves this server."""
import hashlib
import logging

import httpx
from fastapi import HTTPException

logger = logging.getLogger("PasswordPolicy")

MIN_LENGTH = 12

# A short list of the passwords real breach corpora show guessed first --
# not a substitute for the HIBP check below, just an instant, offline
# rejection for the most obvious cases (also our fallback if HIBP is
# unreachable).
_COMMON_PASSWORDS = {
    "password", "password1", "password123", "123456789012", "qwertyuiop123",
    "letmein12345", "welcome12345", "administrator", "changeme12345",
    "iloveyou1234", "princess1234", "sunshine1234", "12345678901234",
}

_HIBP_RANGE_URL = "https://api.pwnedpasswords.com/range/{prefix}"


def _check_have_i_been_pwned(password: str) -> bool:
    """True if the password appears in a known breach. Fails open (returns
    False) on any network/timeout error -- an unreachable third-party API
    must never block someone from creating or resetting an account."""
    sha1 = hashlib.sha1(password.encode("utf-8")).hexdigest().upper()
    prefix, suffix = sha1[:5], sha1[5:]
    try:
        res = httpx.get(_HIBP_RANGE_URL.format(prefix=prefix), timeout=3.0)
        res.raise_for_status()
        return any(line.split(":")[0] == suffix for line in res.text.splitlines())
    except Exception as e:
        logger.warning("HaveIBeenPwned check unavailable, failing open: %s", e)
        return False


def validate_password_strength(password: str) -> None:
    if len(password) < MIN_LENGTH:
        raise HTTPException(status_code=400, detail=f"Password must be at least {MIN_LENGTH} characters.")
    if not any(c.isalpha() for c in password) or not any(c.isdigit() for c in password):
        raise HTTPException(status_code=400, detail="Password must contain at least one letter and one number.")
    if password.lower() in _COMMON_PASSWORDS:
        raise HTTPException(status_code=400, detail="That password is too common. Choose a stronger one.")
    if _check_have_i_been_pwned(password):
        raise HTTPException(status_code=400, detail="That password has appeared in a known data breach. Choose a different one.")
