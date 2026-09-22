import os
import tempfile

# Set before anything imports app.*, so the app boots against a throwaway
# database and known Razorpay credentials instead of the developer's own.
_tmp = tempfile.mkdtemp(prefix="vatsa-test-")
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["JWT_SECRET_KEY"] = "test-secret-not-used-anywhere-else"
os.environ["RAZORPAY_KEY_ID"] = "rzp_test_unit"
os.environ["RAZORPAY_KEY_SECRET"] = "unit-test-secret"
os.environ["RAZORPAY_WEBHOOK_SECRET"] = "unit-test-webhook-secret"

import pytest
from fastapi.testclient import TestClient

# Importing app.main runs load_dotenv(Backend/.env) as a side effect. A real
# developer .env sitting there can carry real third-party credentials, and
# load_dotenv's default `override=False` only protects a var that's already
# set -- popping one beforehand doesn't stop this load from setting it right
# back. So these are cleared AFTER the import instead. Without this, a test
# that reaches an under-tested code path -- e.g. POST /auth/otp/send actually
# calling send_otp_email -- silently makes a live network call using them
# instead of failing fast and deterministically. Found the hard way: the OTP
# resend-cooldown tests were making real SMTP connections to Gmail with this
# machine's real (rejected) app password. Add to this list if a new
# external-credential env var is introduced.
from app.main import app

_LEAKY_ENV_VARS = (
    "EMAIL_USERNAME", "EMAIL_PASSWORD",
    "OPENROUTER_API_KEY",
    "GOOGLE_CLIENT_SECRET", "GITHUB_CLIENT_SECRET", "MICROSOFT_CLIENT_SECRET",
    "SERPER_API_KEY", "TAVILY_API_KEY", "BRAVE_API_KEY", "GOOGLE_CSE_API_KEY",
)


def _clear_leaky_env() -> None:
    for name in _LEAKY_ENV_VARS:
        os.environ.pop(name, None)


_clear_leaky_env()


@pytest.fixture(autouse=True)
def _no_real_external_credentials():
    """Re-clears _LEAKY_ENV_VARS before every test, not just once at import
    time. Needed because scripts/create_verified_user.py (imported by
    tests/test_create_verified_user.py) calls load_dotenv() again on its own
    -- python-dotenv's default override=False only protects a var that's
    already set, so once something pops these, a later load_dotenv() call
    anywhere in the process puts the developer's real Backend/.env values
    right back via os.environ.setdefault(). Found the hard way: with only a
    one-time clear at collection time, tests that ran later in the full
    suite (alphabetically after test_create_verified_user.py) were making
    real SMTP calls to Gmail with this machine's real credentials."""
    _clear_leaky_env()
    yield


from app.database import SessionLocal
from app.auth.jwt import get_password_hash
from app.models.user import User
from app.services import payment_service

TEST_PASSWORD = "a-long-test-password-1"


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


_counter = {"n": 0}


@pytest.fixture()
def make_user(db, client):
    """Creates a throwaway user in the test database and signs in through the
    real POST /auth/login (password check, rate limiter, token issue) -- no
    token is ever minted by the tests themselves."""

    def _make(tier="free", email=None):
        _counter["n"] += 1
        user = User(
            email=email or f"user{_counter['n']}@example.com",
            username=f"user{_counter['n']}",
            full_name="Test User",
            hashed_password=get_password_hash(TEST_PASSWORD),
            is_active=True,
            is_verified=True,
            tier=tier,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        res = client.post("/auth/login", json={"email": user.email, "password": TEST_PASSWORD})
        assert res.status_code == 200, res.text
        return user, {"Authorization": f"Bearer {res.json()['access_token']}"}

    return _make


@pytest.fixture()
def fake_razorpay(monkeypatch):
    """Stands in for the network call to Razorpay's Orders API only --
    everything else (order bookkeeping, signatures, fulfilment) is real.
    Returns an order object shaped like Razorpay's response."""
    issued = []

    def _create(key_id, key_secret, amount, currency, receipt, notes):
        # Real Razorpay order ids are globally unique and the test database
        # outlives a single test, so the counter must too.
        _counter["orders"] = _counter.get("orders", 0) + 1
        order_id = f"order_UNIT{_counter['orders']:05d}"
        issued.append({"order_id": order_id, "amount": amount, "currency": currency, "notes": notes})
        return {
            "id": order_id, "entity": "order", "amount": amount, "currency": currency,
            "receipt": receipt, "status": "created", "notes": notes,
        }

    monkeypatch.setattr(payment_service, "_create_razorpay_order", _create)
    return issued
