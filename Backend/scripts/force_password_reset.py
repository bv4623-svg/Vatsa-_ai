"""Operator command: force a password reset for accounts exposed by the
leaked database copy (created before 2026-09-16; see SECURITY_ACTIONS.md §3).

    cd Backend
    python -m scripts.force_password_reset                  # dry run: list affected accounts
    python -m scripts.force_password_reset --apply          # sign out + lock the old password
    python -m scripts.force_password_reset --apply --notify # ...and email each user how to reset

--apply, for each affected account:
  - bumps token_version, which ends every session and 2FA-pending login;
  - replaces the password hash with the hash of a random 32-byte secret
    nobody knows, so the leaked hash (and the old password) stop working
    and the only way back in is /forgot-password (email code -> new password).
    Google/GitHub/Microsoft sign-in keeps working for linked accounts.
--notify sends each affected user an email with the reset link.

Prints emails and counts only; never a password or hash.
"""
import argparse
import secrets
import sys
from datetime import datetime
from pathlib import Path
from typing import Callable, List, Optional

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(BACKEND_DIR / ".env")

from app.auth.jwt import get_password_hash  # noqa: E402
from app.models.user import User  # noqa: E402

LEAK_CUTOFF = datetime(2026, 9, 16)  # the leaked database copy is from 2026-09-15
RESET_URL_PATH = "/forgot-password"
NOTICE_TITLE = "Please reset your password"


def affected_users(db, before: datetime = LEAK_CUTOFF) -> List[User]:
    # created_at is stored as naive UTC in SQLite; compare naive to naive.
    return db.query(User).filter(User.created_at < before).order_by(User.id).all()


def notice_text(frontend_url: str) -> str:
    return (
        "As a security precaution we have signed you out and disabled your current password. "
        f"Set a new one at {frontend_url.rstrip('/')}{RESET_URL_PATH} (we'll email you a one-time code). "
        "If you used the same password on other sites, change it there too."
    )


def force_reset(db, users: List[User], notify: Optional[Callable[[str, str, str], bool]] = None,
                frontend_url: str = "https://vatsaai.netlify.app") -> dict:
    notified = failed = 0
    for user in users:
        user.token_version = (user.token_version or 0) + 1
        if user.hashed_password:
            user.hashed_password = get_password_hash(secrets.token_urlsafe(32))
    db.commit()
    if notify:
        for user in users:
            if notify(user.email, NOTICE_TITLE, notice_text(frontend_url)):
                notified += 1
            else:
                failed += 1
    return {"reset": len(users), "notified": notified, "notify_failed": failed}


def main(argv=None) -> int:
    import os
    from app.database import SessionLocal, init_db
    from app.utils.email import send_notification_email

    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--before", default=LEAK_CUTOFF.strftime("%Y-%m-%d"), help="accounts created before this date (UTC), default %(default)s")
    ap.add_argument("--apply", action="store_true", help="write changes (default: dry run)")
    ap.add_argument("--notify", action="store_true", help="with --apply: email each affected user")
    args = ap.parse_args(argv)

    init_db()
    db = SessionLocal()
    try:
        users = affected_users(db, datetime.strptime(args.before, "%Y-%m-%d"))
        print(f"{len(users)} account(s) created before {args.before}:")
        for u in users:
            print(f"  {u.id}\t{u.email}\t{u.created_at}\t2FA={'on' if u.two_factor_enabled else 'off'}")
        if not args.apply:
            print("Dry run: nothing changed. Re-run with --apply (and --notify to email them).")
            return 0
        frontend = (os.getenv("FRONTEND_REDIRECT_URL") or "https://vatsaai.netlify.app").split(",")[0]
        result = force_reset(db, users, send_notification_email if args.notify else None, frontend)
        print(f"Signed out and locked {result['reset']} account(s); emailed {result['notified']}, email failed for {result['notify_failed']}.")
        return 1 if result["notify_failed"] else 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
