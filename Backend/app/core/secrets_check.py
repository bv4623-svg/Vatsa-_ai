"""Startup check for configuration secrets.

Runs when the app starts (app/main.py lifespan) and in the pre-deploy check
(scripts/predeploy_check.py). The app refuses to start when it finds a
problem, so a bad deploy fails at once instead of half-working.

Always enforced (any environment):
- no configured secret may equal a value that leaked in git history
  (matched by one-way fingerprint, see LEAKED_FINGERPRINTS_FILE);
- DATA_ENCRYPTION_KEY, if set, must be a valid Fernet key (otherwise every
  2FA setup would crash later).

Enforced in production (APP_ENV=production, or on Render):
- the required variables are set and aren't placeholders;
- JWT_SECRET_KEY is at least 32 characters.

Messages name the variable, never its value.
"""
import hashlib
import json
import os
from pathlib import Path
from typing import Dict, Iterable, List, Mapping, Optional

# Variables whose values are secrets. The check fingerprints each one that
# is set; the list matches SECURITY_ACTIONS.md §4.
SECRET_VARS = (
    "JWT_SECRET_KEY", "SECRET_KEY", "DATA_ENCRYPTION_KEY", "DATA_ENCRYPTION_KEYS_OLD",
    "OPENROUTER_API_KEY",
    "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET",
    "GOOGLE_CLIENT_SECRET", "GITHUB_CLIENT_SECRET", "MICROSOFT_CLIENT_SECRET",
    "EMAIL_PASSWORD",
    "SERPER_API_KEY", "TAVILY_API_KEY", "BRAVE_API_KEY", "GOOGLE_CSE_API_KEY", "SEARXNG_API_KEY",
    "DATABASE_URL",
)

# Must be set in production. Everything else is optional: the feature that
# needs it reports itself as not configured.
REQUIRED_IN_PRODUCTION = (
    "JWT_SECRET_KEY",
    "DATA_ENCRYPTION_KEY",
    "OPENROUTER_API_KEY",
    "ALLOWED_ORIGINS",
    "BACKEND_PUBLIC_URL",
    "FRONTEND_REDIRECT_URL",
)

_PLACEHOLDERS = ("change-me", "changeme", "your-", "your_", "replace-me", "example", "xxx", "todo", "<", "placeholder")

LEAKED_FINGERPRINTS_FILE = Path(__file__).with_name("leaked_secret_fingerprints.json")
_SALT = b"vatsa-leaked-secret-v1"


def fingerprint(value: str) -> str:
    """One-way, deliberately slow fingerprint of a secret value: enough to
    recognise a known leaked value, useless for recovering or guessing one."""
    return hashlib.scrypt(value.strip().encode(), salt=_SALT, n=2**14, r=8, p=1, dklen=16).hex()


def load_leaked_fingerprints(path: Path = LEAKED_FINGERPRINTS_FILE) -> Dict[str, str]:
    """{fingerprint: variable name it leaked under}."""
    if not path.exists():
        return {}
    data = json.loads(path.read_text())
    return {fp: name for name, fps in data.get("fingerprints", {}).items() for fp in fps}


def is_production(env: Mapping[str, str]) -> bool:
    return (env.get("APP_ENV") or "").strip().lower() == "production" or (env.get("RENDER") or "").strip().lower() == "true"


def _values(name: str, raw: str) -> Iterable[str]:
    # DATA_ENCRYPTION_KEYS_OLD is a comma-separated list; check each key.
    parts = raw.split(",") if name == "DATA_ENCRYPTION_KEYS_OLD" else [raw]
    return [p.strip() for p in parts if p.strip()]


def check_secrets(env: Optional[Mapping[str, str]] = None, leaked: Optional[Dict[str, str]] = None) -> List[str]:
    """Problems found, one sentence each. Empty list = OK."""
    env = os.environ if env is None else env
    leaked = load_leaked_fingerprints() if leaked is None else leaked
    problems: List[str] = []

    if leaked:
        for name in SECRET_VARS:
            for value in _values(name, env.get(name) or ""):
                where = leaked.get(fingerprint(value))
                if where:
                    same = "" if where == name else f" (it leaked as {where})"
                    problems.append(f"{name} still has a value that leaked in git history{same}: rotate it (SECURITY_ACTIONS.md §4)")

    key = (env.get("DATA_ENCRYPTION_KEY") or "").strip()
    if key:
        from cryptography.fernet import Fernet
        try:
            Fernet(key.encode())
        except Exception:
            problems.append("DATA_ENCRYPTION_KEY is not a valid Fernet key: generate one with "
                            "python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\"")

    if is_production(env):
        for name in REQUIRED_IN_PRODUCTION:
            value = (env.get(name) or "").strip()
            if not value:
                problems.append(f"{name} is not set (required in production)")
            elif name in SECRET_VARS and any(p in value.lower() for p in _PLACEHOLDERS):
                problems.append(f"{name} looks like a placeholder, not a real value")
        jwt = (env.get("JWT_SECRET_KEY") or env.get("SECRET_KEY") or "").strip()
        if jwt and len(jwt) < 32:
            problems.append("JWT_SECRET_KEY is shorter than 32 characters")
    return problems


def enforce_secrets(env: Optional[Mapping[str, str]] = None) -> None:
    """Raise with every problem listed, so the process exits at startup."""
    problems = check_secrets(env)
    if problems:
        raise RuntimeError("Refusing to start; fix the configuration:\n  - " + "\n  - ".join(problems))
