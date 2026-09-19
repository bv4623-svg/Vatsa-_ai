"""scripts/create_verified_user.py: same password policy as signup, only a hash
is stored, existing users are never touched, and the account can really sign in."""
import secrets

import pytest

from app.auth.jwt import verify_password
from app.models.token import TokenAccount
from app.models.user import User
from app.services import password_policy
from scripts.create_verified_user import create_verified_user


@pytest.fixture(autouse=True)
def offline_breach_check(monkeypatch):
    # The policy also asks Have I Been Pwned; keep tests off the network.
    monkeypatch.setattr(password_policy, "_check_have_i_been_pwned", lambda password: False)


def random_password() -> str:
    return "Aa1-" + secrets.token_urlsafe(18)


def test_creates_a_confirmed_user_and_stores_only_a_hash(client, db):
    password = random_password()
    user = create_verified_user(db, "  New.Owner@Example.com ", password)

    db.expire_all()
    stored = db.query(User).filter_by(id=user.id).one()
    assert stored.email == "new.owner@example.com"
    assert stored.is_verified and stored.is_active and stored.tier == "free" and not stored.two_factor_enabled
    assert stored.hashed_password != password and password not in stored.hashed_password
    assert verify_password(password, stored.hashed_password)
    assert db.query(TokenAccount).filter_by(user_id=user.id).one().balance == 50000


def test_created_user_signs_in_through_the_real_login_endpoint(client, db):
    password = random_password()
    user = create_verified_user(db, "signin.check@example.com", password)

    res = client.post("/auth/login", json={"email": user.email, "password": password})
    assert res.status_code == 200 and res.json()["access_token"]
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {res.json()['access_token']}"})
    assert me.status_code == 200 and me.json()["email"] == "signin.check@example.com"

    wrong = client.post("/auth/login", json={"email": user.email, "password": random_password()})
    assert wrong.status_code == 400


def test_the_signup_password_policy_is_not_weakened(client, db):
    for weak in ("short1", "alllettersnodigits", "1234567890123", "password123"):
        with pytest.raises(ValueError, match="Password rejected"):
            create_verified_user(db, "weak.password@example.com", weak)
    assert db.query(User).filter_by(email="weak.password@example.com").count() == 0


def test_an_existing_email_is_refused_and_left_unchanged(client, db):
    original = random_password()
    create_verified_user(db, "already.here@example.com", original)

    with pytest.raises(ValueError, match="already exists"):
        create_verified_user(db, "ALREADY.HERE@example.com", random_password())

    db.expire_all()
    assert verify_password(original, db.query(User).filter_by(email="already.here@example.com").one().hashed_password)


def test_error_messages_never_contain_the_password(client, db):
    password = "Zz9" + secrets.token_hex(2)  # too short on purpose
    with pytest.raises(ValueError) as excinfo:
        create_verified_user(db, "leak.check@example.com", password)
    assert password not in str(excinfo.value)
