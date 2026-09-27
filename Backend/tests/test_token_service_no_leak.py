"""Regression test for a real leak found while building the AI Router:
TokenService.check_allowance used to return
    f"Model '{model}' is a Pro model. Upgrade to Pro or maintain..."
which put the raw provider/model string (e.g. "anthropic/claude-3.5-sonnet")
directly in a message returned to the client -- a violation of the
provider-confidentiality requirement. See app/services/token_service.py."""
from app.services.token_service import TokenService


def test_premium_gate_message_never_names_a_model(db, make_user):
    user, _ = make_user(tier="free")
    acc = TokenService.get_or_create_account(db, user.id)
    acc.balance = 500  # below the 10,000-token premium-access floor
    db.commit()

    allowed, reason = TokenService.check_allowance(
        db, user, estimated_tokens=100, premium=True,
    )
    assert allowed is False
    for leaked in ("anthropic", "claude", "sonnet", "gpt-4o", "openai", "Model '"):
        assert leaked.lower() not in reason.lower()
    assert "Pro" in reason  # still tells the user *why*, just not *which model*


def test_premium_gate_legacy_fallback_still_gates_by_name_when_premium_not_given(db, make_user):
    user, _ = make_user(tier="free")
    acc = TokenService.get_or_create_account(db, user.id)
    acc.balance = 500
    db.commit()

    allowed, _ = TokenService.check_allowance(
        db, user, estimated_tokens=100, model="anthropic/claude-3.5-sonnet",
    )
    assert allowed is False  # legacy substring rule still recognizes "claude"


def test_non_premium_route_is_not_gated_by_balance_floor(db, make_user):
    user, _ = make_user(tier="free")
    acc = TokenService.get_or_create_account(db, user.id)
    acc.balance = 500
    db.commit()

    allowed, _ = TokenService.check_allowance(db, user, estimated_tokens=100, premium=False)
    assert allowed is True
