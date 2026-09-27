"""One-off operator tool: re-encrypt every stored TOTP secret under the
primary DATA_ENCRYPTION_KEY.

    cd Backend
    python -m scripts.reencrypt_two_factor          # dry run: counts only
    python -m scripts.reencrypt_two_factor --apply  # write changes

Run it after setting DATA_ENCRYPTION_KEY and BEFORE rotating JWT_SECRET_KEY:
secrets that are still plaintext, or sealed with the JWT-derived fallback
key, would otherwise become unreadable once the JWT secret changes (see
SECURITY_ACTIONS.md). Backup codes are one-way hashes and can't be
re-keyed; the report counts users who should regenerate them.

Never prints a secret, a code or a hash.
"""
import argparse
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv

load_dotenv(BACKEND_DIR / ".env")

from app.database import SessionLocal, init_db  # noqa: E402
from app.models.user import User  # noqa: E402
from app.services.crypto import DecryptionError, decrypt_str, encrypt_str, needs_reencrypt  # noqa: E402


def reencrypt(db, apply: bool) -> dict:
    report = {"users_with_secret": 0, "reencrypted": 0, "undecryptable": 0, "backup_codes_to_regenerate": 0}
    for user in db.query(User).filter(User.totp_secret.isnot(None)).all():
        report["users_with_secret"] += 1
        if needs_reencrypt(user.totp_secret):
            try:
                plaintext = decrypt_str(user.totp_secret)
            except DecryptionError:
                report["undecryptable"] += 1
                continue
            report["reencrypted"] += 1
            if apply:
                user.totp_secret = encrypt_str(plaintext)
        codes = user.backup_codes or []
        # Legacy plain SHA-256 hashes, or keyed hashes not under the primary key.
        if any(not c.startswith("h1:") for c in codes):
            report["backup_codes_to_regenerate"] += 1
    if apply:
        db.commit()
    return report


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--apply", action="store_true", help="write changes (default: dry run)")
    args = ap.parse_args(argv)
    init_db()
    db = SessionLocal()
    try:
        report = reencrypt(db, args.apply)
    finally:
        db.close()
    mode = "APPLIED" if args.apply else "DRY RUN"
    print(f"{mode}: {report}")
    if report["undecryptable"]:
        print("Some secrets can't be decrypted with the configured keys: add the old key to "
              "DATA_ENCRYPTION_KEYS_OLD (or restore the old JWT_SECRET_KEY) and run again.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
