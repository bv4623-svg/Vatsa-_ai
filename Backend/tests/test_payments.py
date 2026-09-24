import hashlib
import hmac
import json
from datetime import datetime, timedelta

from app.models.subscription import Subscription
from app.models.user import User
from app.services.payment_service import PLANS, resolve_plan
from app.services.subscription_expiry import expire_subscriptions

KEY_SECRET = "unit-test-secret"
WEBHOOK_SECRET = "unit-test-webhook-secret"


def sign(order_id, payment_id):
    return hmac.new(KEY_SECRET.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()


def create_order(client, headers, plan_id="pro", currency="USD", **extra):
    return client.post("/payment/create-order", json={"plan_id": plan_id, "currency": currency, **extra}, headers=headers)


def verify(client, headers, order_id, payment_id, signature=None):
    return client.post("/payment/verify", headers=headers, json={
        "razorpay_order_id": order_id,
        "razorpay_payment_id": payment_id,
        "razorpay_signature": signature if signature is not None else sign(order_id, payment_id),
    })


def refresh_tier(db, user):
    db.expire_all()
    return db.get(User, user.id).tier


def test_catalog_is_exactly_the_two_prices_in_both_currencies():
    # USD is the fixed catalog (PLANS); INR is resolved fresh per call from
    # the live/cached exchange rate (see app/services/exchange_rate.py and
    # the autouse _deterministic_exchange_rate fixture, which pins it to
    # the historical 83 rate here), rounded to the nearest ten rupees --
    # 24*83=1992 -> 1990, 99*83=8217 -> 8220.
    assert {k: v["amount_paise"] for k, v in PLANS.items()} == {
        "pro:USD": 24 * 100,
        "business:USD": 99 * 100,
    }
    assert resolve_plan("pro", "INR")["amount_paise"] == 1990 * 100
    assert resolve_plan("business", "INR")["amount_paise"] == 8220 * 100


def test_order_amounts_match_catalog(client, make_user, fake_razorpay):
    _, headers = make_user()
    cases = [("pro", "USD", 2400), ("business", "USD", 9900), ("pro", "INR", 199000), ("business", "INR", 822000)]
    for plan_id, currency, expected in cases:
        res = create_order(client, headers, plan_id, currency)
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["amount"] == expected and body["currency"] == currency
        assert body["key_id"] == "rzp_test_unit"
    assert [o["amount"] for o in fake_razorpay] == [c[2] for c in cases]


def test_client_cannot_choose_the_price_or_a_plan_we_dont_sell(client, make_user, fake_razorpay):
    _, headers = make_user()
    assert create_order(client, headers, "pro", "USD", amount=1, billing_period="annual").json()["amount"] == 2400
    for bad in ("ultra", "enterprise", "pro_monthly", ""):
        assert create_order(client, headers, bad).status_code == 400
    assert len(fake_razorpay) == 1


def test_valid_payment_upgrades_and_is_idempotent(client, make_user, db, fake_razorpay):
    user, headers = make_user()
    order_id = create_order(client, headers, "pro").json()["order_id"]

    res = verify(client, headers, order_id, "pay_A1")
    assert res.status_code == 200, res.text
    assert res.json()["tier"] == "pro"
    assert refresh_tier(db, user) == "pro"

    sub = db.query(Subscription).filter_by(order_id=order_id).one()
    assert sub.verified and sub.status == "active" and sub.amount == "24.00"
    days = (sub.expires_at - datetime.utcnow()).total_seconds() / 86400
    assert 29.9 < days <= 30

    again = verify(client, headers, order_id, "pay_A1")
    assert again.status_code == 200 and again.json()["message"] == "Payment already verified"


def test_business_payment_grants_business_not_pro(client, make_user, db, fake_razorpay):
    user, headers = make_user()
    order_id = create_order(client, headers, "business", "INR").json()["order_id"]
    assert verify(client, headers, order_id, "pay_B1").json()["tier"] == "business"
    assert refresh_tier(db, user) == "business"


def test_bad_signature_grants_nothing(client, make_user, db, fake_razorpay):
    user, headers = make_user()
    order_id = create_order(client, headers, "pro").json()["order_id"]
    res = verify(client, headers, order_id, "pay_X", signature="0" * 64)
    assert res.status_code == 400
    assert refresh_tier(db, user) == "free"
    assert not db.query(Subscription).filter_by(order_id=order_id).one().verified


def test_someone_elses_order_cannot_be_claimed(client, make_user, db, fake_razorpay):
    _, owner_headers = make_user()
    thief, thief_headers = make_user()
    order_id = create_order(client, owner_headers, "pro").json()["order_id"]
    res = verify(client, thief_headers, order_id, "pay_S1")
    assert res.status_code == 400
    assert refresh_tier(db, thief) == "free"


def test_signature_for_an_unknown_order_does_not_fall_back_to_a_pending_one(client, make_user, db, fake_razorpay):
    user, headers = make_user()
    create_order(client, headers, "business")
    res = verify(client, headers, "order_NOT_OURS", "pay_Z1")
    assert res.status_code == 400
    assert refresh_tier(db, user) == "free"


def post_webhook(client, order_id, payment_id, user_id, amount, currency, secret=WEBHOOK_SECRET):
    body = json.dumps({
        "event": "payment.captured",
        "payload": {"payment": {"entity": {
            "id": payment_id, "order_id": order_id, "amount": amount,
            "currency": currency, "notes": {"user_id": str(user_id)},
        }}},
    }).encode()
    sig = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return client.post("/payment/webhook", content=body, headers={"X-Razorpay-Signature": sig, "Content-Type": "application/json"})


def test_webhook_fulfils_when_the_browser_never_reported_back(client, make_user, db, fake_razorpay):
    user, headers = make_user()
    order_id = create_order(client, headers, "pro").json()["order_id"]
    res = post_webhook(client, order_id, "pay_W1", user.id, 2400, "USD")
    assert res.status_code == 200 and res.json()["status"] == "processed"
    assert refresh_tier(db, user) == "pro"


def test_webhook_rejects_wrong_amount_and_bad_signature(client, make_user, db, fake_razorpay):
    user, headers = make_user()
    order_id = create_order(client, headers, "business").json()["order_id"]

    assert post_webhook(client, order_id, "pay_W2", user.id, 100, "USD").json()["status"] == "rejected"
    assert refresh_tier(db, user) == "free"

    assert post_webhook(client, order_id, "pay_W2", user.id, 9900, "USD", secret="wrong").status_code == 400
    assert refresh_tier(db, user) == "free"


def test_repeat_payment_extends_instead_of_overlapping(client, make_user, db, fake_razorpay):
    user, headers = make_user()
    for n in (1, 2):
        order_id = create_order(client, headers, "pro").json()["order_id"]
        assert verify(client, headers, order_id, f"pay_R{n}").status_code == 200
    latest = db.query(Subscription).filter_by(user_id=user.id).order_by(Subscription.expires_at.desc()).first()
    days = (latest.expires_at - datetime.utcnow()).total_seconds() / 86400
    assert 59.9 < days <= 60


def test_lapsed_access_is_downgraded_and_active_access_is_not(client, make_user, db, fake_razorpay):
    lapsed, lapsed_headers = make_user()
    active, active_headers = make_user()
    comped, _ = make_user(tier="pro")  # assigned by hand, never paid

    for headers, pay in ((lapsed_headers, "pay_L1"), (active_headers, "pay_L2")):
        order_id = create_order(client, headers, "pro").json()["order_id"]
        verify(client, headers, order_id, pay)

    db.query(Subscription).filter_by(user_id=lapsed.id).update({"expires_at": datetime.utcnow() - timedelta(days=1)})
    db.commit()

    expire_subscriptions()

    assert refresh_tier(db, lapsed) == "free"
    assert refresh_tier(db, active) == "pro"
    assert refresh_tier(db, comped) == "pro"
    assert db.query(Subscription).filter_by(user_id=lapsed.id).one().status == "expired"


def post_refund_webhook(client, payment_id, amount, secret=WEBHOOK_SECRET):
    body = json.dumps({
        "event": "refund.processed",
        "payload": {"refund": {"entity": {"id": "rfnd_1", "payment_id": payment_id, "amount": amount}}},
    }).encode()
    sig = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return client.post("/payment/webhook", content=body, headers={"X-Razorpay-Signature": sig, "Content-Type": "application/json"})


def test_full_refund_ends_access_and_is_idempotent(client, make_user, db, fake_razorpay):
    user, headers = make_user()
    order_id = create_order(client, headers, "pro").json()["order_id"]
    assert verify(client, headers, order_id, "pay_RF1").status_code == 200
    assert refresh_tier(db, user) == "pro"

    res = post_refund_webhook(client, "pay_RF1", 2400)
    assert res.status_code == 200 and res.json()["status"] == "processed"
    assert refresh_tier(db, user) == "free"
    assert db.query(Subscription).filter_by(payment_id="pay_RF1").one().status == "refunded"

    again = post_refund_webhook(client, "pay_RF1", 2400)
    assert again.status_code == 200 and again.json()["result"]["already"] is True
    assert refresh_tier(db, user) == "free"


def test_partial_refund_leaves_access_alone(client, make_user, db, fake_razorpay):
    user, headers = make_user()
    order_id = create_order(client, headers, "pro").json()["order_id"]
    assert verify(client, headers, order_id, "pay_RF2").status_code == 200

    res = post_refund_webhook(client, "pay_RF2", 500)
    assert res.status_code == 200
    assert refresh_tier(db, user) == "pro"
    assert db.query(Subscription).filter_by(payment_id="pay_RF2").one().status == "active"


def test_refund_webhook_needs_a_valid_signature_and_a_known_payment(client, make_user, db, fake_razorpay):
    user, headers = make_user()
    order_id = create_order(client, headers, "pro").json()["order_id"]
    assert verify(client, headers, order_id, "pay_RF3").status_code == 200

    assert post_refund_webhook(client, "pay_RF3", 2400, secret="wrong").status_code == 400
    assert refresh_tier(db, user) == "pro"

    unknown = post_refund_webhook(client, "pay_NOPE", 2400)
    assert unknown.json()["status"] == "rejected"
    assert refresh_tier(db, user) == "pro"
