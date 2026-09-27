"""Key handling for at-rest encryption: rotation, fallback, and the
re-encryption tool that must run before JWT_SECRET_KEY is rotated."""
import hashlib

import pyotp
from cryptography.fernet import Fernet

from app.models.user import User
from app.services import crypto
from scripts.reencrypt_two_factor import reencrypt

KEY_A = Fernet.generate_key().decode()
KEY_B = Fernet.generate_key().decode()


def test_rotation_old_key_still_decrypts_and_is_flagged(monkeypatch):
    monkeypatch.setenv("DATA_ENCRYPTION_KEY", KEY_A)
    sealed = crypto.encrypt_str("JBSWY3DPEHPK3PXP")
    tag = crypto.keyed_hash("abcd1234", "p")
    assert not crypto.needs_reencrypt(sealed)

    monkeypatch.setenv("DATA_ENCRYPTION_KEY", KEY_B)
    monkeypatch.setenv("DATA_ENCRYPTION_KEYS_OLD", KEY_A)
    assert crypto.decrypt_str(sealed) == "JBSWY3DPEHPK3PXP"
    assert crypto.needs_reencrypt(sealed)
    assert crypto.keyed_hash_matches(tag, "abcd1234", "p")
    assert not crypto.keyed_hash_matches(tag, "wrong", "p")


def test_without_the_old_key_decryption_fails_closed(monkeypatch):
    monkeypatch.setenv("DATA_ENCRYPTION_KEY", KEY_A)
    sealed = crypto.encrypt_str("secret")
    monkeypatch.setenv("DATA_ENCRYPTION_KEY", KEY_B)
    monkeypatch.setenv("JWT_SECRET_KEY", "a-completely-different-jwt-secret")
    try:
        crypto.decrypt_str(sealed)
        raise AssertionError("must not decrypt")
    except crypto.DecryptionError:
        pass


def test_jwt_derived_fallback_is_used_without_a_primary_key(monkeypatch):
    monkeypatch.delenv("DATA_ENCRYPTION_KEY", raising=False)
    sealed = crypto.encrypt_str("value")
    monkeypatch.setenv("DATA_ENCRYPTION_KEY", KEY_A)  # operator adds a primary later
    assert crypto.decrypt_str(sealed) == "value"      # derived key still accepted
    assert crypto.needs_reencrypt(sealed)


def test_reencrypt_tool_moves_everything_to_the_primary_key(client, make_user, db, monkeypatch):
    monkeypatch.delenv("DATA_ENCRYPTION_KEY", raising=False)
    user, _ = make_user()
    legacy_user, _ = make_user()
    secret = pyotp.random_base32()
    db.query(User).filter_by(id=user.id).first().totp_secret = crypto.encrypt_str(secret)  # JWT-derived
    row = db.query(User).filter_by(id=legacy_user.id).first()
    row.totp_secret = secret  # legacy plaintext
    row.backup_codes = [hashlib.sha256(b"abcd1234").hexdigest()]
    db.commit()

    monkeypatch.setenv("DATA_ENCRYPTION_KEY", KEY_A)
    dry = reencrypt(db, apply=False)
    assert dry["reencrypted"] >= 2 and dry["backup_codes_to_regenerate"] >= 1
    db.expire_all()
    assert db.query(User).filter_by(id=legacy_user.id).first().totp_secret == secret, "dry run must not write"

    reencrypt(db, apply=True)
    db.expire_all()
    for uid in (user.id, legacy_user.id):
        stored = db.query(User).filter_by(id=uid).first().totp_secret
        assert stored.startswith("enc:v1:") and not crypto.needs_reencrypt(stored)

    # Now the JWT secret can rotate without breaking 2FA.
    monkeypatch.setenv("JWT_SECRET_KEY", "rotated-jwt-secret")
    for uid in (user.id, legacy_user.id):
        assert crypto.decrypt_str(db.query(User).filter_by(id=uid).first().totp_secret) == secret
