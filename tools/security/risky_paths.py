"""Shared rules for which file names must never be committed.

Used by forbidden_files.py (pre-commit + CI) and scan_history.py (git
history audit). Pure functions, standard library only.
"""
import re
from pathlib import PurePosixPath

# Env files that are meant to be committed. Example files may hold only
# empty values for secret-looking keys; the public frontend file may hold
# only NEXT_PUBLIC_* keys (they are inlined into the browser bundle anyway).
EXAMPLE_ENV_SUFFIXES = (".env.example",)
PUBLIC_ENV_FILES = {"frontend/.env.production"}

_FORBIDDEN_SUFFIXES = (
    ".db", ".sqlite", ".sqlite3", ".db-journal",
    ".zip", ".tar", ".tar.gz", ".tgz", ".7z", ".rar",
    ".pem", ".key", ".p12", ".pfx", ".kdbx", ".keystore", ".jks",
)
_FORBIDDEN_NAMES = re.compile(r"^(id_rsa|id_dsa|id_ecdsa|id_ed25519)(\.pub)?$|^\.npmrc$|^\.pypirc$|^credentials(\.json)?$", re.I)
SECRET_KEY_NAME = re.compile(r"(SECRET|PASSWORD|PASSWD|TOKEN|PRIVATE|API_KEY|_KEY$|^KEY$)", re.I)


def normalise(path: str) -> str:
    """Git paths use '/', but archives made on Windows use '\\'."""
    return path.replace("\\", "/").lstrip("./") if path.startswith("./") else path.replace("\\", "/")


def is_env_file(path: str) -> bool:
    name = PurePosixPath(normalise(path)).name
    return name == ".env" or name.startswith(".env.") or name.endswith(".env")


def forbidden_reason(path: str) -> str | None:
    """Why `path` must not be committed, or None if its name is fine."""
    p = normalise(path)
    name = PurePosixPath(p).name
    lower = name.lower()
    if is_env_file(p):
        if lower.endswith(EXAMPLE_ENV_SUFFIXES) or p in PUBLIC_ENV_FILES:
            return None
        return "environment file (may contain secrets); commit a .env.example instead"
    if lower.endswith(_FORBIDDEN_SUFFIXES):
        return "database, archive or key material"
    if _FORBIDDEN_NAMES.search(name):
        return "credential file"
    return None


def env_content_problems(path: str, text: str) -> list[str]:
    """For committed env files: example files must leave secret-looking keys
    empty; the public frontend file may only set NEXT_PUBLIC_* keys."""
    problems = []
    p = normalise(path)
    for n, raw in enumerate(text.splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = (s.strip() for s in line.split("=", 1))
        key = key.removeprefix("export ").strip()
        value = value.strip().strip('"').strip("'")
        if p in PUBLIC_ENV_FILES:
            if not key.startswith("NEXT_PUBLIC_"):
                problems.append(f"{p}:{n}: only NEXT_PUBLIC_* variables belong in this public file ({key})")
        elif SECRET_KEY_NAME.search(key) and value:
            problems.append(f"{p}:{n}: {key} must be empty in an example file")
    return problems
