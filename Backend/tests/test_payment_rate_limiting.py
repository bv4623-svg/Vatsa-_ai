"""POST /payment/create-order and /payment/verify were unrate-limited --
a user (or a spoofed-IP script) could hammer Razorpay's real Orders API
for free, or brute-force-probe verify. See app/routers/payment.py."""


def test_create_order_is_rate_limited_per_user(client, make_user, fake_razorpay):
    _, headers = make_user()
    last = None
    for _ in range(11):
        last = client.post("/payment/create-order", json={"plan_id": "pro", "currency": "USD"}, headers=headers)
    assert last.status_code == 429
    assert "Retry-After" in last.headers


def test_verify_payment_is_rate_limited_per_user(client, make_user):
    _, headers = make_user()
    last = None
    for _ in range(21):
        last = client.post(
            "/payment/verify",
            json={"razorpay_order_id": "order_x", "razorpay_payment_id": "pay_x", "razorpay_signature": "bad"},
            headers=headers,
        )
    assert last.status_code == 429
