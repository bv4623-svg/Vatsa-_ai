"""The payments / payment_events ledger: what gets written, when, and what
must never be written. Signatures are real HMACs; only the outbound call to
Razorpay's Orders API is stubbed (see conftest.fake_razorpay)."""
import hashlib
import hmac
import json

from app.database import SessionLocal
from app.models.payment import Payment, PaymentEvent
from app.models.subscription import Subscription
from app.models.user import User
from app.services import payment_service
from app.services.payment_service import PaymentProviderError

from test_payments import WEBHOOK_SECRET, create_order, refresh_tier, sign, verify


def payment_for(db, order_id):
    db.expire_all()
    return db.query(Payment).filter_by(razorpay_order_id=order_id).one()


def events_for(db, payment, event_type=None):
    db.expire_all()
    q = db.query(PaymentEvent).filter_by(payment_id=payment.id)
    if event_type:
        q = q.filter_by(event_type=event_type)
    return q.order_by(PaymentEvent.id).all()


def post_signed(client, body, secret=WEBHOOK_SECRET, event_id=None):
    raw = json.dumps(body).encode()
    headers = {
        "X-Razorpay-Signature": hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest(),
        "Content-Type": "application/json",
    }
    if event_id:
        headers["X-Razorpay-Event-Id"] = event_id
    return client.post("/payment/webhook", content=raw, headers=headers)


def captured_body(order_id, payment_id, user_id, amount, currency, **extra_entity):
    entity = {
        "id": payment_id, "order_id": order_id, "amount": amount, "currency": currency,
        "notes": {"user_id": str(user_id)}, **extra_entity,
    }
    return {"event": "payment.captured", "payload": {"payment": {"entity": entity}}}


def refund_body(payment_id, amount):
    return {
        "event": "refund.processed",
        "payload": {"refund": {"entity": {"id": "rfnd_L1", "payment_id": payment_id, "amount": amount}}},
    }


# ── order creation ───────────────────────────────────────────────────

def test_ledger_row_is_written_before_razorpay_is_called(client, make_user, monkeypatch):
    user, headers = make_user()
    seen = {}

    def spy(key_id, key_secret, amount, currency, receipt, notes):
        other = SessionLocal()  # a separate connection: only committed rows are visible
        try:
            row = other.query(Payment).filter_by(user_id=user.id).one()
            seen.update(status=row.status, order_id=row.razorpay_order_id, email=row.email, amount=row.amount)
        finally:
            other.close()
        return {"id": "order_SPY00001", "amount": amount, "currency": currency, "status": "created"}

    monkeypatch.setattr(payment_service, "_create_razorpay_order", spy)
    assert create_order(client, headers, "pro").status_code == 200
    assert seen == {"status": "created", "order_id": None, "email": user.email, "amount": 2400}


def test_order_row_carries_snapshot_amounts_and_razorpay_response(client, make_user, db, fake_razorpay):
    user, headers = make_user()
    order_id = create_order(client, headers, "business", "INR").json()["order_id"]

    row = payment_for(db, order_id)
    assert (row.user_id, row.email, row.plan, row.currency, row.amount, row.status) == (
        user.id, user.email, "business", "INR", 821700, "created")
    assert row.razorpay_payment_id is None and row.razorpay_signature is None
    assert row.raw_payload["order"]["id"] == order_id
    assert fake_razorpay[-1]["notes"] == {"user_id": str(user.id), "email": user.email, "plan": "business"}
    assert [e.event_type for e in events_for(db, row)] == ["order.created"]


def test_provider_failure_marks_the_row_failed_and_leaves_no_subscription(client, make_user, db, monkeypatch):
    user, headers = make_user()

    def boom(*args, **kwargs):
        raise PaymentProviderError("down")

    monkeypatch.setattr(payment_service, "_create_razorpay_order", boom)
    assert create_order(client, headers, "pro").status_code == 502

    db.expire_all()
    row = db.query(Payment).filter_by(user_id=user.id).one()
    assert row.status == "failed" and row.razorpay_order_id is None
    assert [e.event_type for e in events_for(db, row)] == ["order.failed"]
    assert db.query(Subscription).filter_by(user_id=user.id).count() == 0


# ── browser verification ─────────────────────────────────────────────

def test_valid_signature_captures_stores_ids_and_upgrades(client, make_user, db, fake_razorpay):
    user, headers = make_user()
    order_id = create_order(client, headers, "pro").json()["order_id"]
    assert verify(client, headers, order_id, "pay_LV1").status_code == 200

    row = payment_for(db, order_id)
    assert row.status == "captured" and row.razorpay_payment_id == "pay_LV1"
    assert row.razorpay_signature == sign(order_id, "pay_LV1")
    assert row.raw_payload["verify"] == {"razorpay_order_id": order_id, "razorpay_payment_id": "pay_LV1"}
    assert [e.event_type for e in events_for(db, row)] == ["order.created", "verify.succeeded"]
    assert refresh_tier(db, user) == "pro"


def test_invalid_signature_records_failure_and_never_upgrades(client, make_user, db, fake_razorpay):
    user, headers = make_user()
    order_id = create_order(client, headers, "pro").json()["order_id"]

    assert verify(client, headers, order_id, "pay_LX1", signature="f" * 64).status_code == 400

    row = payment_for(db, order_id)
    assert row.status == "failed"
    assert row.razorpay_payment_id is None and row.razorpay_signature is None
    failed = events_for(db, row, "verify.failed")
    assert len(failed) == 1 and failed[0].payload == {"razorpay_order_id": order_id, "razorpay_payment_id": "pay_LX1"}
    assert refresh_tier(db, user) == "free"
    assert db.query(Subscription).filter_by(order_id=order_id).one().verified is False

    # A real payment afterwards still goes through: failed is not terminal.
    assert verify(client, headers, order_id, "pay_LX2").status_code == 200
    assert payment_for(db, order_id).status == "captured"


def test_bad_signature_after_capture_cannot_undo_it(client, make_user, db, fake_razorpay):
    user, headers = make_user()
    order_id = create_order(client, headers, "pro").json()["order_id"]
    assert verify(client, headers, order_id, "pay_LC1").status_code == 200

    verify(client, headers, order_id, "pay_OTHER", signature="0" * 64)

    row = payment_for(db, order_id)
    assert row.status == "captured" and row.razorpay_payment_id == "pay_LC1"
    assert refresh_tier(db, user) == "pro"


def test_email_snapshot_survives_the_user_changing_email(client, make_user, db, fake_razorpay):
    user, headers = make_user(email="before@example.com")
    order_id = create_order(client, headers, "pro").json()["order_id"]
    assert verify(client, headers, order_id, "pay_LE1").status_code == 200

    db.expire_all()
    db.get(User, user.id).email = "after@example.com"
    db.commit()

    row = payment_for(db, order_id)
    assert row.email == "before@example.com" and row.user_id == user.id


def test_an_order_from_before_the_ledger_existed_gets_a_row_from_its_own_subscription(client, make_user, db, fake_razorpay):
    user, headers = make_user()
    db.add(Subscription(user_id=user.id, plan="pro", order_id="order_LEGACY1", status="pending",
                        verified=False, amount="24.00", currency="USD"))
    db.commit()
    assert db.query(Payment).filter_by(razorpay_order_id="order_LEGACY1").count() == 0

    assert verify(client, headers, "order_LEGACY1", "pay_LG1").status_code == 200

    row = payment_for(db, "order_LEGACY1")
    assert (row.status, row.amount, row.currency, row.plan, row.email) == ("captured", 2400, "USD", "pro", user.email)


# ── webhooks ─────────────────────────────────────────────────────────

def test_captured_webhook_upgrades_and_every_duplicate_is_kept(client, make_user, db, fake_razorpay):
    user, headers = make_user()
    order_id = create_order(client, headers, "pro").json()["order_id"]
    body = captured_body(order_id, "pay_LW1", user.id, 2400, "USD")

    first = post_signed(client, body, event_id="evt_1")
    again = post_signed(client, body, event_id="evt_1")
    assert first.json()["status"] == "processed" and again.json()["status"] == "processed"

    row = payment_for(db, order_id)
    assert row.status == "captured" and row.razorpay_payment_id == "pay_LW1"
    assert row.raw_payload["webhook_payment_captured"]["event"] == "payment.captured"
    captured = events_for(db, row, "payment.captured")
    assert len(captured) == 2 and {e.razorpay_event_id for e in captured} == {"evt_1"}
    assert db.query(Payment).filter_by(razorpay_order_id=order_id).count() == 1
    assert refresh_tier(db, user) == "pro"


def test_webhook_after_browser_verify_still_keeps_razorpays_record(client, make_user, db, fake_razorpay):
    user, headers = make_user()
    order_id = create_order(client, headers, "pro").json()["order_id"]
    assert verify(client, headers, order_id, "pay_LB1").status_code == 200

    assert post_signed(client, captured_body(order_id, "pay_LB1", user.id, 2400, "USD")).status_code == 200

    row = payment_for(db, order_id)
    assert row.status == "captured" and "webhook_payment_captured" in row.raw_payload and "verify" in row.raw_payload


def test_card_and_upi_details_never_reach_the_database(client, make_user, db, fake_razorpay):
    user, headers = make_user()
    order_id = create_order(client, headers, "pro").json()["order_id"]
    body = captured_body(order_id, "pay_LK1", user.id, 2400, "USD",
                         method="card", card={"last4": "4242", "network": "Visa"}, card_id="card_1", vpa="a@upi")
    assert post_signed(client, body).status_code == 200

    row = payment_for(db, order_id)
    stored = json.dumps([row.raw_payload, [e.payload for e in events_for(db, row)]])
    for leaked in ("4242", "card_1", "a@upi", '"card":', "last4"):
        assert leaked not in stored
    assert '"method": "card"' in stored


def test_bad_webhook_signature_is_rejected_and_not_stored(client, make_user, db, fake_razorpay):
    user, headers = make_user()
    order_id = create_order(client, headers, "pro").json()["order_id"]
    db.expire_all()
    before = db.query(PaymentEvent).count()

    res = post_signed(client, captured_body(order_id, "pay_LS1", user.id, 2400, "USD"), secret="wrong")

    assert res.status_code == 400
    db.expire_all()
    assert db.query(PaymentEvent).count() == before
    assert refresh_tier(db, user) == "free"


def test_webhook_for_an_unknown_order_is_recorded_but_grants_nothing(client, make_user, db, fake_razorpay):
    user, _ = make_user()
    db.expire_all()
    before = db.query(PaymentEvent).filter(PaymentEvent.payment_id.is_(None)).count()

    res = post_signed(client, captured_body("order_NOT_OURS_2", "pay_LU1", user.id, 2400, "USD"))

    assert res.json()["status"] == "rejected"
    db.expire_all()
    orphans = db.query(PaymentEvent).filter(PaymentEvent.payment_id.is_(None)).count()
    assert orphans == before + 1
    assert refresh_tier(db, user) == "free"


def test_webhook_naming_a_different_user_is_rejected(client, make_user, db, fake_razorpay):
    owner, headers = make_user()
    other, _ = make_user()
    order_id = create_order(client, headers, "pro").json()["order_id"]

    res = post_signed(client, captured_body(order_id, "pay_LM1", other.id, 2400, "USD"))

    assert res.json()["status"] == "rejected"
    assert refresh_tier(db, owner) == "free" and refresh_tier(db, other) == "free"
    assert payment_for(db, order_id).status == "created"


def test_full_refund_marks_the_row_refunded_and_ends_access(client, make_user, db, fake_razorpay):
    user, headers = make_user()
    order_id = create_order(client, headers, "pro").json()["order_id"]
    assert verify(client, headers, order_id, "pay_LR1").status_code == 200

    assert post_signed(client, refund_body("pay_LR1", 2400)).json()["status"] == "processed"
    assert post_signed(client, refund_body("pay_LR1", 2400)).json()["status"] == "processed"  # duplicate

    row = payment_for(db, order_id)
    assert row.status == "refunded" and "webhook_refund_processed" in row.raw_payload
    assert len(events_for(db, row, "refund.processed")) == 2
    assert refresh_tier(db, user) == "free"


def test_partial_refund_is_logged_but_changes_neither_status_nor_access(client, make_user, db, fake_razorpay):
    user, headers = make_user()
    order_id = create_order(client, headers, "pro").json()["order_id"]
    assert verify(client, headers, order_id, "pay_LP1").status_code == 200

    post_signed(client, refund_body("pay_LP1", 500))

    row = payment_for(db, order_id)
    assert row.status == "captured"
    assert len(events_for(db, row, "refund.processed")) == 1
    assert refresh_tier(db, user) == "pro"


# ── retention ────────────────────────────────────────────────────────

def test_hard_deleting_an_account_keeps_its_payment_history(client, make_user, db, fake_razorpay):
    from datetime import datetime, timedelta, timezone

    from app.services.account.deletion import hard_delete_expired_accounts

    user, headers = make_user()
    order_id = create_order(client, headers, "pro").json()["order_id"]
    assert verify(client, headers, order_id, "pay_LD1").status_code == 200
    email, user_id = user.email, user.id

    db.expire_all()
    account = db.get(User, user_id)
    account.is_deleted = True
    account.is_active = False
    account.deleted_at = datetime.now(timezone.utc) - timedelta(days=31)
    db.commit()

    assert hard_delete_expired_accounts() >= 1

    db.expire_all()
    assert db.query(User).filter_by(id=user_id).count() == 0
    row = payment_for(db, order_id)
    assert (row.user_id, row.email, row.status, row.razorpay_payment_id) == (None, email, "captured", "pay_LD1")
    assert [e.event_type for e in events_for(db, row)] == ["order.created", "verify.succeeded"]
