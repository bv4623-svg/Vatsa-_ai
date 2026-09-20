"""The public addresses of this deployment, in one place.

Each value comes from an environment variable and falls back to the production
address, so a deploy that forgot to set it still points at the live site and
never at a developer's machine. Local development overrides them in .env.

Empty variables count as unset (Render and .env files both produce
`NAME=` for a blank field), and trailing slashes are dropped so a value like
`https://example.com/` cannot produce `//auth/callback`.
"""
import os
from typing import List

PRODUCTION_FRONTEND_URL = "https://vatsaai.netlify.app"
PRODUCTION_BACKEND_URL = "https://vatsa-ai.onrender.com"

DEFAULT_ALLOWED_ORIGINS = f"{PRODUCTION_FRONTEND_URL},{PRODUCTION_BACKEND_URL}"


def _clean(name: str) -> str:
    return (os.getenv(name) or "").strip()


def _url(name: str, default: str) -> str:
    return (_clean(name) or default).rstrip("/")


# Where OAuth logins and account-linking send the browser afterwards.
FRONTEND_URL = _url("FRONTEND_REDIRECT_URL", PRODUCTION_FRONTEND_URL)

# This API's own public origin, used to build absolute links to files/images.
BACKEND_PUBLIC_URL = _url("BACKEND_PUBLIC_URL", PRODUCTION_BACKEND_URL)


def allowed_origins() -> List[str]:
    """CORS origins from ALLOWED_ORIGINS (comma-separated, exact origins only,
    never a wildcard). Read at call time so it always reflects the environment."""
    raw = _clean("ALLOWED_ORIGINS") or DEFAULT_ALLOWED_ORIGINS
    return [o.strip().rstrip("/") for o in raw.split(",") if o.strip()]
