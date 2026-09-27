from app.ai_router.errors import (
    AllProvidersFailed, ErrorKind, HEALTH_AFFECTING, ProviderError,
    RouterOverloaded, PUBLIC_BUSY, PUBLIC_UNAVAILABLE,
)
from app.ai_router.sanitize import contains_identity, redact_identity


def test_provider_error_str_never_contains_detail():
    err = ProviderError(ErrorKind.SERVER_ERROR, status=500, detail="Anthropic API key sk-ant-secret123 invalid")
    assert "sk-ant" not in str(err)
    assert "Anthropic" not in str(err)
    assert err.detail == "Anthropic API key sk-ant-secret123 invalid"  # kept, for server logs only


def test_router_error_public_message_is_the_str():
    err = AllProvidersFailed()
    assert str(err) == PUBLIC_UNAVAILABLE
    assert err.public_message == PUBLIC_UNAVAILABLE


def test_router_overloaded_defaults():
    err = RouterOverloaded()
    assert str(err) == PUBLIC_BUSY
    assert err.code == "ai_busy"
    assert err.retry_after == 2.0


def test_bad_request_and_content_policy_are_not_health_affecting():
    assert ErrorKind.BAD_REQUEST not in HEALTH_AFFECTING
    assert ErrorKind.CONTENT_POLICY not in HEALTH_AFFECTING
    assert ErrorKind.TIMEOUT in HEALTH_AFFECTING
    assert ErrorKind.SERVER_ERROR in HEALTH_AFFECTING


def test_redact_identity_hides_family_terms():
    text = "I'm running on Claude 3.5 Sonnet via OpenRouter, powered by Anthropic."
    out = redact_identity(text)
    for leaked in ("claude", "sonnet", "openrouter", "anthropic"):
        assert leaked not in out.lower()
    assert contains_identity(text)


def test_redact_identity_leaves_ordinary_text_alone():
    text = "Sign in with Google to sync your settings. Mini golf is fun."
    assert redact_identity(text) == text
    assert not contains_identity(text)


def test_redact_identity_uses_extra_terms_for_registry_ids():
    text = "internal id gpt-4o-custom-route-9000 leaked"
    assert "gpt-4o-custom-route-9000" not in redact_identity(text, extra_terms=["gpt-4o-custom-route-9000"])


def test_contains_identity_empty_text():
    assert contains_identity("") is False
    assert redact_identity("") == ""
