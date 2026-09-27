"""Startup secrets check (app/core/secrets_check.py): the app must refuse to
start with a leaked, malformed or (in production) missing secret, and must
never echo a secret value in its messages."""
import secrets

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient

from app.core import secrets_check as sc

LEAKED_VALUE = "sk-or-v1-" + "0" * 64          # stand-in for a leaked key (not real)
LEAKED = {sc.fingerprint(LEAKED_VALUE): "OPENROUTER_API_KEY"}


def prod_env(**over):
    env = {
        "APP_ENV": "production",
        "JWT_SECRET_KEY": secrets.token_urlsafe(48),
        "DATA_ENCRYPTION_KEY": Fernet.generate_key().decode(),
        "OPENROUTER_API_KEY": "sk-or-v1-" + secrets.token_hex(32),
        "ALLOWED_ORIGINS": "https://vatsaai.netlify.app",
        "BACKEND_PUBLIC_URL": "https://vatsa-ai.onrender.com",
        "FRONTEND_REDIRECT_URL": "https://vatsaai.netlify.app",
    }
    env.update(over)
    return env


def test_a_correct_production_config_passes():
    assert sc.check_secrets(prod_env(), leaked=LEAKED) == []


def test_a_leaked_value_is_refused_and_never_echoed():
    problems = sc.check_secrets(prod_env(OPENROUTER_API_KEY=LEAKED_VALUE), leaked=LEAKED)
    assert len(problems) == 1 and "OPENROUTER_API_KEY" in problems[0] and "leaked" in problems[0]
    assert LEAKED_VALUE not in problems[0]


def test_a_leaked_value_reused_under_another_name_is_refused():
    problems = sc.check_secrets({"TAVILY_API_KEY": LEAKED_VALUE}, leaked=LEAKED)
    assert problems and "TAVILY_API_KEY" in problems[0] and "leaked as OPENROUTER_API_KEY" in problems[0]


def test_old_rotation_keys_are_checked_one_by_one():
    env = {"DATA_ENCRYPTION_KEYS_OLD": f"{Fernet.generate_key().decode()}, {LEAKED_VALUE}"}
    assert any("DATA_ENCRYPTION_KEYS_OLD" in p for p in sc.check_secrets(env, leaked=LEAKED))


def test_leaked_values_are_refused_outside_production_too():
    assert sc.check_secrets({"JWT_SECRET_KEY": LEAKED_VALUE}, leaked={sc.fingerprint(LEAKED_VALUE): "JWT_SECRET_KEY"})


def test_malformed_encryption_key_is_refused():
    problems = sc.check_secrets({"DATA_ENCRYPTION_KEY": "not-a-fernet-key"}, leaked={})
    assert problems and "DATA_ENCRYPTION_KEY" in problems[0] and "not-a-fernet-key" not in problems[0]


@pytest.mark.parametrize("missing", sc.REQUIRED_IN_PRODUCTION)
def test_each_required_variable_is_enforced_in_production(missing):
    env = prod_env()
    env.pop(missing)
    assert sc.check_secrets(env, leaked={}) == [f"{missing} is not set (required in production)"]


def test_required_variables_are_not_enforced_in_development():
    assert sc.check_secrets({"JWT_SECRET_KEY": "dev"}, leaked={}) == []


def test_render_counts_as_production():
    assert sc.is_production({"RENDER": "true"}) and not sc.is_production({})


def test_placeholder_and_short_jwt_are_refused_in_production():
    assert "looks like a placeholder" in " ".join(sc.check_secrets(prod_env(OPENROUTER_API_KEY="your-openrouter-key"), leaked={}))
    assert "shorter than 32" in " ".join(sc.check_secrets(prod_env(JWT_SECRET_KEY="short-secret"), leaked={}))


def test_committed_fingerprints_cover_the_leaked_secrets():
    names = set(sc.load_leaked_fingerprints().values())
    assert {"JWT_SECRET_KEY", "OPENROUTER_API_KEY", "RAZORPAY_KEY_SECRET", "GOOGLE_CLIENT_SECRET", "EMAIL_PASSWORD"} <= names
    # A fresh random value never matches.
    assert sc.fingerprint(secrets.token_urlsafe(32)) not in sc.load_leaked_fingerprints()


def test_the_app_refuses_to_start_with_a_bad_secret(monkeypatch):
    from app.main import app
    monkeypatch.setenv("DATA_ENCRYPTION_KEY", "not-a-fernet-key")
    with pytest.raises(RuntimeError, match="DATA_ENCRYPTION_KEY"):
        with TestClient(app):
            pass
