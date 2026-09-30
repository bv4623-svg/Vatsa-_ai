"""Cloudflare Turnstile check for starting a Google/GitHub sign-in.

That start is the ONLY place the app asks for a CAPTCHA (owner decision,
2026-09-30): login and sign-up share it, so both get the check; chat,
reviews, feedback, 2FA, password reset and everything else never do.

Off unless TURNSTILE_ENABLED is true (startup refuses TURNSTILE_ENABLED
without TURNSTILE_SECRET_KEY, see app/core/secrets_check.py). A token is
single-use, so it is verified exactly once, here. Tokens are never logged:
only the outcome, the IP and the user agent.

Fail-open: if Cloudflare can't be reached or reports its own internal
error, the sign-in goes ahead -- signing in is the critical path, and the
provider (Google/GitHub) still runs its own bot checks. A missing or
rejected token is never let through.
"""
import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger("Captcha")

DEFAULT_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
TIMEOUT_SECONDS = 5.0
# Turnstile's own name for the token field its widget adds to a form.
TOKEN_FIELD = "cf-turnstile-response"


def captcha_enabled() -> bool:
    return (os.getenv("TURNSTILE_ENABLED") or "").strip().lower() in ("1", "true", "yes", "on")


async def _siteverify(payload: dict) -> dict:
    """One POST to Cloudflare, no retry. Raises on network errors and non-2xx."""
    url = os.getenv("TURNSTILE_VERIFY_URL") or DEFAULT_VERIFY_URL
    async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
        res = await client.post(url, data=payload)
        res.raise_for_status()
        return res.json()


async def verify_turnstile(token: str, remote_ip: str, user_agent: str = "") -> bool:
    """True if Cloudflare accepts the token, or can't be asked (fail-open)."""
    where = f"ip={remote_ip} ua={(user_agent or '-')[:120]!r}"
    payload = {"secret": os.getenv("TURNSTILE_SECRET_KEY") or "", "response": token, "remoteip": remote_ip}
    try:
        result = await _siteverify(payload)
    except Exception as exc:  # timeout, DNS, 5xx, bad JSON: Cloudflare is unavailable
        logger.warning("captcha unavailable (%s), allowing sign-in: %s", type(exc).__name__, where)
        return True

    codes = [str(c) for c in (result.get("error-codes") or [])]
    if result.get("success") is True:
        logger.info("captcha passed: %s", where)
        return True
    if "internal-error" in codes:
        logger.warning("captcha unavailable (cloudflare internal-error), allowing sign-in: %s", where)
        return True
    logger.info("captcha failed %s: %s", ",".join(codes) or "no-reason", where)
    return False


def token_from_form(form) -> Optional[str]:
    value = form.get(TOKEN_FIELD) if form is not None else None
    value = (value or "").strip() if isinstance(value, str) else ""
    return value or None
