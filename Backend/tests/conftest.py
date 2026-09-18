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

from app.main import app
from app.database import SessionLocal
from app.auth.jwt import create_access_token, get_password_hash
from app.models.user import User
from app.services import payment_service


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
def make_user(db):
    def _make(tier="free"):
        _counter["n"] += 1
        user = User(
            email=f"user{_counter['n']}@example.com",
            username=f"user{_counter['n']}",
            full_name="Test User",
            hashed_password=get_password_hash("a-long-test-password-1"),
            is_active=True,
            is_verified=True,
            tier=tier,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        token = create_access_token({"sub": str(user.id), "email": user.email, "tv": user.token_version})
        return user, {"Authorization": f"Bearer {token}"}
    return _make


@pytest.fixture()
def fake_razorpay(monkeypatch):
    """Stands in for the network call to Razorpay's Orders API only --
    everything else (order bookkeeping, signatures, fulfilment) is real."""
    issued = []

    def _create(key_id, key_secret, amount, currency, receipt, notes):
        # Real Razorpay order ids are globally unique and the test database
        # outlives a single test, so the counter must too.
        _counter["orders"] = _counter.get("orders", 0) + 1
        order_id = f"order_UNIT{_counter['orders']:05d}"
        issued.append({"order_id": order_id, "amount": amount, "currency": currency, "notes": notes})
        return order_id

    monkeypatch.setattr(payment_service, "_create_razorpay_order", _create)
    return issued
