"""Cross-user security checks not already covered by tests/test_payments.py
or tests/test_authorization_isolation.py:

- User B cannot verify/claim User A's Razorpay order by submitting A's real
  order id with B's own auth token (would either credit B's account for A's
  order, or worse, silently do nothing while looking like it worked).
- There is no endpoint that lets a client set/modify a token balance
  directly -- every credit/debit happens server-side only, from a verified
  payment or a completed AI request.
"""
import hashlib
import hmac

KEY_SECRET = "unit-test-secret"


def _sign(order_id, payment_id):
    return hmac.new(KEY_SECRET.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()


def test_user_b_cannot_verify_user_as_order(client, make_user, fake_razorpay, db):
    owner, owner_headers = make_user()
    attacker, attacker_headers = make_user()

    created = client.post("/payment/create-order", json={"plan_id": "pro", "currency": "USD"}, headers=owner_headers)
    assert created.status_code == 200
    order_id = created.json()["order_id"]

    # The attacker never had this order -- they'd need to have observed it
    # somehow (e.g. it leaked in a log) -- but even with a correctly forged
    # signature, ownership must still be enforced by user_id, not order_id alone.
    forged_signature = _sign(order_id, "pay_ATTACKER_1")
    res = client.post(
        "/payment/verify",
        json={"razorpay_order_id": order_id, "razorpay_payment_id": "pay_ATTACKER_1", "razorpay_signature": forged_signature},
        headers=attacker_headers,
    )
    assert res.status_code == 400
    assert "not found" in res.json()["detail"].lower()

    db.expire_all()
    from app.models.user import User
    attacker_row = db.query(User).filter_by(id=attacker.id).first()
    assert (attacker_row.tier or "free") == "free"  # never upgraded

    # The real owner can still verify it themselves afterwards.
    real = client.post(
        "/payment/verify",
        json={"razorpay_order_id": order_id, "razorpay_payment_id": "pay_REAL_1", "razorpay_signature": _sign(order_id, "pay_REAL_1")},
        headers=owner_headers,
    )
    assert real.status_code == 200
    assert real.json()["success"] is True


def test_no_endpoint_accepts_a_client_supplied_token_balance(client, make_user):
    """/api/tokens is read-only: GET /balance and GET /transactions. There is
    no POST/PATCH that takes a balance or amount from the client."""
    user, headers = make_user()
    for method, path in (("post", "/api/tokens/balance"), ("patch", "/api/tokens/balance"), ("put", "/api/tokens/balance")):
        res = getattr(client, method)(path, json={"balance": 999999999}, headers=headers)
        assert res.status_code in (404, 405), f"{method.upper()} {path} should not exist"


def test_balance_get_ignores_a_user_id_query_param(client, make_user):
    """GET /api/tokens/balance must always return the AUTHENTICATED user's
    balance -- a user_id query param, if the client adds one anyway, must be
    silently ignored, not used to look up someone else's account."""
    owner, owner_headers = make_user()
    other, other_headers = make_user()

    mine = client.get(f"/api/tokens/balance?user_id={other.id}", headers=owner_headers)
    assert mine.status_code == 200
    assert mine.json()["user_id"] == owner.id  # not other.id
