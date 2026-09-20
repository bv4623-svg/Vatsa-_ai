"""One-off admin tool: create a user whose email is already confirmed, then
prove the account works by signing in through the real POST /auth/login.

    cd Backend
    venv\\Scripts\\python.exe -m scripts.create_verified_user someone@example.com

Why this exists: normal signup requires an emailed one-time code. This is the
operator's equivalent of an auth provider's "create user, email confirmed"
admin action. It changes no application code and no auth check.

Handling of the password:
  * It is NEVER a command-line argument (that would land in shell history and
    the process list). It is read from a hidden prompt, or from the
    VATSA_NEW_USER_PASSWORD environment variable for non-interactive use.
  * It must pass the same policy as signup (length, letter+digit, common
    list, breach check) -- this tool does not weaken it.
  * It is hashed with the app's own bcrypt hasher; only the hash is stored.
  * It is never printed, logged or written to a file, and the sign-in check
    below sends it only to the login endpoint.

The account is created exactly like a self-signup: free tier, profile not yet
completed (the app asks for it on first login), 50,000 starter tokens.
Refuses to touch an email that already exists.
"""
import argparse
import getpass
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv

# Same .env the server loads, so this writes to the database the server reads.
load_dotenv(BACKEND_DIR / ".env")

import httpx
from fastapi import HTTPException

from app.auth.jwt import get_password_hash
from app.config.urls import BACKEND_PUBLIC_URL
from app.database import SessionLocal, init_db
from app.models.token import TokenAccount, TokenTransaction
from app.models.user import User
from app.services.password_policy import validate_password_strength

PASSWORD_ENV = "VATSA_NEW_USER_PASSWORD"
STARTER_TOKENS = 50000  # what POST /auth/signup grants


def create_verified_user(db, email: str, password: str, full_name: str | None = None) -> User:
    """Inserts the user with a confirmed email. Raises ValueError with a
    message that never contains the password."""
    email = email.lower().strip()
    if "@" not in email or email.startswith("@") or email.endswith("@"):
        raise ValueError("That does not look like an email address.")
    if db.query(User).filter(User.email == email).first():
        raise ValueError("A user with this email already exists; nothing was changed.")

    try:
        validate_password_strength(password)
    except HTTPException as e:
        raise ValueError(f"Password rejected: {e.detail}") from None

    base_username = email.split("@")[0]
    username, counter = base_username, 1
    while db.query(User).filter(User.username == username).first():
        username = f"{base_username}{counter}"
        counter += 1

    user = User(
        email=email,
        full_name=full_name or base_username,
        username=username,
        hashed_password=get_password_hash(password),
        is_active=True,
        is_verified=True,
        profile_completed=False,
        tier="free",
    )
    db.add(user)
    db.flush()
    db.add(TokenAccount(user_id=user.id, balance=STARTER_TOKENS, total_purchased=0, total_used=0))
    db.add(TokenTransaction(
        user_id=user.id, type="bonus", amount=STARTER_TOKENS,
        balance_after=STARTER_TOKENS, reason="Welcome starter token bonus",
    ))
    db.commit()
    db.refresh(user)
    return user


def check_login(api_base: str, email: str, password: str) -> tuple[bool, str]:
    """Signs in through the real endpoint, then uses the returned token on
    /auth/me. Returns (ok, one-line summary); the token is not exposed."""
    base = api_base.rstrip("/")
    try:
        res = httpx.post(f"{base}/auth/login", json={"email": email, "password": password}, timeout=15)
    except httpx.HTTPError as e:
        return False, f"could not reach {base} ({type(e).__name__}). Start the backend and run the sign-in check again."

    if res.status_code != 200:
        return False, f"/auth/login returned {res.status_code}: {_detail(res)}"
    data = res.json()
    token = data.get("access_token")
    if not token:
        return False, "/auth/login answered 200 but returned no access token."

    me = httpx.get(f"{base}/auth/me", headers={"Authorization": f"Bearer {token}"}, timeout=15)
    if me.status_code != 200 or (me.json().get("email") or "").lower() != email:
        return False, f"token was issued but /auth/me returned {me.status_code}."
    return True, f"/auth/login returned a session token ({len(token)} chars) and /auth/me accepted it for {email}."


def _detail(res: httpx.Response) -> str:
    try:
        return str(res.json().get("detail", "no detail"))
    except ValueError:
        return "no detail"


def read_password() -> str:
    from_env = os.environ.get(PASSWORD_ENV)
    if from_env:
        return from_env
    first = getpass.getpass("Password (hidden): ")
    if first != getpass.getpass("Repeat password: "):
        raise ValueError("The two passwords did not match.")
    return first


def main() -> int:
    parser = argparse.ArgumentParser(description="Create a user with a confirmed email and check that they can sign in.")
    parser.add_argument("email")
    parser.add_argument("--name", help="display name (default: the part of the email before @)")
    parser.add_argument("--api", default=os.environ.get("VATSA_API_URL") or BACKEND_PUBLIC_URL,
                        help="backend to sign in against (default: %(default)s)")
    parser.add_argument("--no-login-check", action="store_true", help="only create the user")
    args = parser.parse_args()

    try:
        password = read_password()
        init_db()
        db = SessionLocal()
        try:
            user = create_verified_user(db, args.email, password, args.name)
            email = user.email
        finally:
            db.close()
    except ValueError as e:
        print(f"FAILED: {e}")
        return 1

    print(f"CREATED: {email} (email confirmed, free tier, {STARTER_TOKENS:,} starter tokens).")
    if args.no_login_check:
        return 0

    ok, summary = check_login(args.api, email, password)
    print(("LOGIN OK: " if ok else "LOGIN FAILED: ") + summary)
    return 0 if ok else 2


if __name__ == "__main__":
    sys.exit(main())
