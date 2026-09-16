"""
One-off, idempotent backfill: ensure every existing user has a TokenAccount.

Safe to run multiple times. Never deletes or modifies existing users,
accounts, or transactions -- it only INSERTs a TokenAccount (+ a matching
"bonus" TokenTransaction) for users who don't have one yet.

Usage:
    venv/Scripts/python.exe scripts/backfill_token_accounts.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal, init_db
from app.models.user import User
from app.models.token import TokenAccount, TokenTransaction

STARTER_BALANCE = 50000


def main():
    init_db()
    db = SessionLocal()
    try:
        users = db.query(User).all()
        created = 0
        for user in users:
            existing = db.query(TokenAccount).filter_by(user_id=user.id).first()
            if existing:
                continue
            db.add(TokenAccount(
                user_id=user.id,
                balance=STARTER_BALANCE,
                total_purchased=0,
                total_used=0,
            ))
            db.add(TokenTransaction(
                user_id=user.id,
                type="bonus",
                amount=STARTER_BALANCE,
                balance_after=STARTER_BALANCE,
                reason="Backfilled starter token bonus",
            ))
            created += 1
        db.commit()
        print(f"Checked {len(users)} users, created {created} missing token account(s).")
    finally:
        db.close()


if __name__ == "__main__":
    main()
