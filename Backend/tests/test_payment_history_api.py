"""GET /api/payments/me, /api/payments/me/events and /api/admin/payments:
ownership on every query, and an admin route that fails closed."""

from app.auth.jwt import create_access_token
from app.models.user import User

from test_payment_ledger import captured_body, post_signed
from test_payments import create_order, verify

PRIVATE_FIELDS = {"razorpay_signature", "raw_payload", "payload"}


def paid(client, headers, plan="pro", currency="USD", payment_id="pay_H0"):
    order_id = create_order(client, headers, plan, currency).json()["order_id"]
    assert verify(client, headers, order_id, payment_id).status_code == 200
    return order_id


_admins = {"n": 0}


def make_admin(db, make_user, monkeypatch, two_factor=True):
    _admins["n"] += 1
    address = f"boss{_admins['n']}@example.com"  # the test database outlives a single test
    admin, headers = make_user(email=address)
    monkeypatch.setenv("ADMIN_EMAILS", f"{address.upper()} , other@example.com")
    if two_factor:
        db.expire_all()
        db.get(User, admin.id).two_factor_enabled = True
        db.commit()
    return admin, headers


# ── the caller's own history ─────────────────────────────────────────

def test_history_requires_a_login(client):
    for path in ("/api/payments/me", "/api/payments/me/events", "/api/admin/payments?email=a@example.com"):
        assert client.get(path).status_code == 401


def test_me_returns_only_the_callers_rows(client, make_user, fake_razorpay):
    alice, alice_h = make_user()
    bob, bob_h = make_user()
    a_order = paid(client, alice_h, "pro", "USD", "pay_HA1")
    b_order = paid(client, bob_h, "business", "INR", "pay_HB1")

    mine = client.get("/api/payments/me", headers=alice_h).json()
    assert [p["razorpay_order_id"] for p in mine["items"]] == [a_order]
    assert mine["total"] == 1
    row = mine["items"][0]
    assert (row["email"], row["razorpay_payment_id"], row["amount"], row["currency"], row["plan"], row["status"]) == (
        alice.email, "pay_HA1", 2400, "USD", "pro", "captured")
    assert row["created_at"].endswith("Z") and row["updated_at"].endswith("Z")
    assert not PRIVATE_FIELDS & set(row)

    theirs = client.get("/api/payments/me", headers=bob_h).json()
    assert [p["razorpay_order_id"] for p in theirs["items"]] == [b_order]


def test_me_includes_unpaid_and_failed_orders_newest_first(client, make_user, fake_razorpay):
    user, headers = make_user()
    abandoned = create_order(client, headers, "pro").json()["order_id"]
    failed = create_order(client, headers, "business").json()["order_id"]
    verify(client, headers, failed, "pay_HF1", signature="0" * 64)
    done = paid(client, headers, "pro", "USD", "pay_HF2")

    items = client.get("/api/payments/me", headers=headers).json()["items"]
    assert [(i["razorpay_order_id"], i["status"]) for i in items] == [
        (done, "captured"), (failed, "failed"), (abandoned, "created")]

    page = client.get("/api/payments/me?limit=1&offset=1", headers=headers).json()
    assert page["total"] == 3 and [i["razorpay_order_id"] for i in page["items"]] == [failed]
    assert client.get("/api/payments/me?limit=0", headers=headers).status_code == 422


def test_me_events_are_only_the_callers_and_never_orphans(client, make_user, fake_razorpay):
    alice, alice_h = make_user()
    bob, bob_h = make_user()
    a_order = paid(client, alice_h, "pro", "USD", "pay_EA1")
    paid(client, bob_h, "pro", "USD", "pay_EB1")
    post_signed(client, captured_body(a_order, "pay_EA1", alice.id, 2400, "USD"))
    post_signed(client, captured_body("order_NOBODYS", "pay_ZZ9", alice.id, 2400, "USD"))  # orphan event

    body = client.get("/api/payments/me/events", headers=alice_h).json()
    assert {e["razorpay_order_id"] for e in body["items"]} == {a_order}
    assert {e["event_type"] for e in body["items"]} == {"order.created", "verify.succeeded", "payment.captured"}
    assert all(not PRIVATE_FIELDS & set(e) for e in body["items"])
    assert "order_NOBODYS" not in str(body)


# ── admin lookup ─────────────────────────────────────────────────────

def test_admin_lookup_refuses_everyone_who_is_not_a_fully_qualified_admin(client, make_user, db, monkeypatch, fake_razorpay):
    plain, plain_h = make_user()
    paid(client, plain_h, "pro", "USD", "pay_AD1")
    url = f"/api/admin/payments?email={plain.email}"

    # Not listed in ADMIN_EMAILS.
    monkeypatch.setenv("ADMIN_EMAILS", "someone-else@example.com")
    assert client.get(url, headers=plain_h).status_code == 403

    # Nobody is an admin when the setting is empty.
    monkeypatch.setenv("ADMIN_EMAILS", "")
    assert client.get(url, headers=plain_h).status_code == 403

    # Listed, but without two-factor authentication.
    _, no_2fa_h = make_admin(db, make_user, monkeypatch, two_factor=False)
    res = client.get(url, headers=no_2fa_h)
    assert res.status_code == 403 and "two-factor" in res.json()["detail"]


def test_admin_lookup_refuses_a_token_that_cannot_be_revoked(client, make_user, db, monkeypatch, fake_razorpay):
    admin, _ = make_admin(db, make_user, monkeypatch)
    old_style = create_access_token({"sub": str(admin.id), "email": admin.email})  # no "tv" claim
    res = client.get("/api/admin/payments?email=x@example.com", headers={"Authorization": f"Bearer {old_style}"})
    assert res.status_code == 403


def test_admin_finds_payments_by_email_and_by_the_address_used_at_the_time(client, make_user, db, monkeypatch, fake_razorpay):
    _, admin_h = make_admin(db, make_user, monkeypatch)
    customer, customer_h = make_user(email="customer@example.com")
    order_id = paid(client, customer_h, "business", "USD", "pay_AC1")

    def lookup(address):
        res = client.get("/api/admin/payments", params={"email": address}, headers=admin_h)
        assert res.status_code == 200, res.text
        return res.json()

    found = lookup("CUSTOMER@Example.com")  # case-insensitive
    assert [p["razorpay_order_id"] for p in found["items"]] == [order_id]
    item = found["items"][0]
    assert item["user_id"] == customer.id and item["amount"] == 9900 and item["status"] == "captured"
    assert [e["event_type"] for e in item["events"]] == ["order.created", "verify.succeeded"]
    assert not PRIVATE_FIELDS & set(item)

    # The customer changes address: both the old and the new one still resolve.
    db.expire_all()
    db.get(User, customer.id).email = "renamed@example.com"
    db.commit()
    assert [p["razorpay_order_id"] for p in lookup("customer@example.com")["items"]] == [order_id]
    assert [p["razorpay_order_id"] for p in lookup("renamed@example.com")["items"]] == [order_id]


def test_admin_lookup_is_exact_match_and_requires_an_email(client, make_user, db, monkeypatch, fake_razorpay):
    _, admin_h = make_admin(db, make_user, monkeypatch)
    _, someone_h = make_user()
    paid(client, someone_h, "pro", "USD", "pay_AW1")

    for pattern in ("%%%", "%@example.com", "user%", "_@example.com"):
        res = client.get("/api/admin/payments", params={"email": pattern}, headers=admin_h)
        assert res.status_code == 200 and res.json()["items"] == []
    assert client.get("/api/admin/payments", headers=admin_h).status_code == 422
