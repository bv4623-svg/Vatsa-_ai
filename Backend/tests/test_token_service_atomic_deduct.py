"""Regression test for a real critical bug found by code review:
TokenService.deduct_tokens/credit_tokens used to compute
`new_balance = acc.balance +/- tokens` in Python and write that back.
Because app/database.py's SessionLocal has expire_on_commit=False, an
`acc` object loaded earlier in a request (e.g. by check_allowance, before
a slow AI stream) keeps its in-memory balance even after a *different*
session commits a change to the same row -- a classic lost update. Worst
case: a user pays for tokens mid-stream, the stream's own deduct_tokens
call then overwrites the balance using its stale pre-payment value,
silently erasing the purchase. Fixed with an atomic SQL UPDATE (see
app/services/token_service.py), same pattern as
app/services/feature_access.py's increment_usage."""
from app.database import SessionLocal
from app.services.token_service import TokenService


def test_deduct_tokens_does_not_lose_a_concurrent_credit(db, make_user):
    user, _ = make_user()
    acc = TokenService.get_or_create_account(db, user.id)
    assert acc.balance == 50000  # loaded into `db`'s identity map now

    # A different session -- standing in for a concurrent request/webhook
    # -- credits the account with a real purchase AFTER `acc` above was
    # already loaded into `db`.
    other_db = SessionLocal()
    try:
        TokenService.credit_tokens(other_db, user.id, 500000, reason="test purchase")
    finally:
        other_db.close()

    # `db`'s own copy of `acc` still reads 50000 (expire_on_commit=False).
    # Deducting through `db` must not silently overwrite the concurrent
    # +500000 credit with a value computed from that stale balance.
    TokenService.deduct_tokens(db, user.id, 1000, reason="test usage")

    verify_db = SessionLocal()
    try:
        final_balance = TokenService.get_balance(verify_db, user.id)
    finally:
        verify_db.close()

    assert final_balance == 50000 + 500000 - 1000


def test_credit_tokens_does_not_lose_a_concurrent_deduction(db, make_user):
    user, _ = make_user()
    acc = TokenService.get_or_create_account(db, user.id)
    assert acc.balance == 50000

    other_db = SessionLocal()
    try:
        TokenService.deduct_tokens(other_db, user.id, 20000, reason="test usage")
    finally:
        other_db.close()

    TokenService.credit_tokens(db, user.id, 100, reason="test bonus")

    verify_db = SessionLocal()
    try:
        final_balance = TokenService.get_balance(verify_db, user.id)
    finally:
        verify_db.close()

    assert final_balance == 50000 - 20000 + 100


def test_deduct_tokens_floors_at_zero():
    db = SessionLocal()
    try:
        from app.models.user import User
        user = User(email="floor-test@example.com", username="floortest", full_name="Floor Test",
                    hashed_password="x", is_active=True, is_verified=True, tier="free")
        db.add(user)
        db.commit()
        db.refresh(user)

        TokenService.get_or_create_account(db, user.id)
        tx = TokenService.deduct_tokens(db, user.id, 999999999, reason="test overshoot")
        assert tx.balance_after == 0
        assert TokenService.get_balance(db, user.id) == 0
    finally:
        db.close()


def test_deduct_tokens_returns_the_correct_balance_after():
    db = SessionLocal()
    try:
        from app.models.user import User
        user = User(email="balance-after-test@example.com", username="balanceaftertest", full_name="Balance After",
                    hashed_password="x", is_active=True, is_verified=True, tier="free")
        db.add(user)
        db.commit()
        db.refresh(user)

        TokenService.get_or_create_account(db, user.id)
        tx = TokenService.deduct_tokens(db, user.id, 1500, reason="test usage")
        assert tx.balance_after == 50000 - 1500
    finally:
        db.close()
