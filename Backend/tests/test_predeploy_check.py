"""scripts/predeploy_check.py: passes on a good configuration and fails (exit
1, variable names only) on each kind of problem."""
import secrets

from cryptography.fernet import Fernet

from app.core import secrets_check as sc
from scripts import predeploy_check as pdc

PROD = {
    "APP_ENV": "production",
    "JWT_SECRET_KEY": secrets.token_urlsafe(48),
    "DATA_ENCRYPTION_KEY": Fernet.generate_key().decode(),
    "OPENROUTER_API_KEY": "sk-or-v1-" + secrets.token_hex(32),
    "ALLOWED_ORIGINS": "https://vatsaai.netlify.app",
    "BACKEND_PUBLIC_URL": "https://vatsa-ai.onrender.com",
    "FRONTEND_REDIRECT_URL": "https://vatsaai.netlify.app",
}


def _env(monkeypatch, tmp_path, **over):
    for k, v in {**PROD, "DATA_DIR": str(tmp_path), "DATABASE_URL": f"sqlite:///{tmp_path}/db.sqlite3", **over}.items():
        if v is None:
            monkeypatch.delenv(k, raising=False)
        else:
            monkeypatch.setenv(k, v)


def test_passes_on_a_good_production_config(monkeypatch, tmp_path, capsys):
    _env(monkeypatch, tmp_path)
    assert pdc.main() == 0
    assert "passed (production)" in capsys.readouterr().out


def test_fails_when_a_required_secret_is_missing(monkeypatch, tmp_path, capsys):
    _env(monkeypatch, tmp_path, OPENROUTER_API_KEY=None)
    assert pdc.main() == 1
    assert "OPENROUTER_API_KEY is not set" in capsys.readouterr().err


def test_fails_on_a_leaked_secret_without_printing_it(monkeypatch, tmp_path, capsys):
    leaked = "rzp_live_" + "L" * 24
    monkeypatch.setattr(sc, "load_leaked_fingerprints", lambda path=None: {sc.fingerprint(leaked): "RAZORPAY_KEY_SECRET"})
    _env(monkeypatch, tmp_path, RAZORPAY_KEY_SECRET=leaked)
    assert pdc.main() == 1
    err = capsys.readouterr().err
    assert "RAZORPAY_KEY_SECRET still has a value that leaked" in err and leaked not in err


def test_fails_when_the_database_is_unreachable(monkeypatch, tmp_path, capsys):
    _env(monkeypatch, tmp_path, DATABASE_URL=f"sqlite:///{tmp_path}/missing-dir/db.sqlite3")
    assert pdc.main() == 1
    assert "database is not reachable" in capsys.readouterr().err


def test_fails_when_the_data_dir_is_missing(monkeypatch, tmp_path, capsys):
    _env(monkeypatch, tmp_path, DATA_DIR=str(tmp_path / "not-mounted"))
    assert pdc.main() == 1
    assert "does not exist" in capsys.readouterr().err
