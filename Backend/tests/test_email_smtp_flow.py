"""Real test of app/utils/email/core.py's _send() -- the actual SMTP client
code path (host/port/TLS-mode selection, login, message send, error
handling) -- using the real smtplib exception types against a fake SMTP
connection object standing in for the network socket.

This is NOT a live-network test against Gmail: no working Gmail app
password exists in this environment (see .env's placeholder value and
Backend/DEPLOYMENT.md). It verifies the code correctly:
  - Never attempts to connect at all when unconfigured.
  - Picks SMTP_SSL for port 465 and STARTTLS SMTP for everything else,
    matching what EMAIL_SMTP_PORT's docstring in .env.example promises.
  - Performs the full realistic call sequence (ehlo/starttls/ehlo/login/send
    for STARTTLS; login/send for SSL).
  - Returns False (not an exception) on auth failure or any other SMTP
    error, and never includes the configured password in anything it
    returns or would log.
"""
import smtplib

import pytest

from app.utils.email.core import _send


class _FakeSMTP:
    """Stands in for smtplib.SMTP / smtplib.SMTP_SSL as a context manager."""

    instances = []

    def __init__(self, host, port, timeout=None):
        self.host, self.port, self.timeout = host, port, timeout
        self.calls = []
        self.login_result = None
        self.raise_on = None
        _FakeSMTP.instances.append(self)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def ehlo(self):
        self.calls.append("ehlo")

    def starttls(self):
        self.calls.append("starttls")

    def login(self, user, password):
        self.calls.append(("login", user, password))
        if self.raise_on == "auth":
            raise smtplib.SMTPAuthenticationError(535, b"5.7.8 Username and Password not accepted")
        if self.raise_on == "smtp":
            raise smtplib.SMTPException("relay refused")

    def send_message(self, msg):
        self.calls.append(("send_message", msg["To"], msg["Subject"]))


@pytest.fixture(autouse=True)
def _reset_fake():
    _FakeSMTP.instances.clear()
    yield
    _FakeSMTP.instances.clear()


def test_unconfigured_never_attempts_a_connection(monkeypatch):
    monkeypatch.delenv("EMAIL_USERNAME", raising=False)
    monkeypatch.delenv("EMAIL_PASSWORD", raising=False)
    monkeypatch.setattr(smtplib, "SMTP", _FakeSMTP)
    monkeypatch.setattr(smtplib, "SMTP_SSL", _FakeSMTP)

    assert _send("user@example.com", "subject", "<p>body</p>") is False
    assert _FakeSMTP.instances == []  # no socket ever opened


def test_port_587_uses_starttls_with_the_full_real_sequence(monkeypatch):
    monkeypatch.setenv("EMAIL_USERNAME", "bot@example.com")
    monkeypatch.setenv("EMAIL_PASSWORD", "app-password-value")
    monkeypatch.setenv("EMAIL_SMTP_PORT", "587")
    monkeypatch.setattr(smtplib, "SMTP", _FakeSMTP)

    ok = _send("user@example.com", "Verify your email", "<p>123456</p>")
    assert ok is True
    smtp = _FakeSMTP.instances[0]
    assert smtp.port == 587
    assert smtp.calls[0] == "ehlo"
    assert smtp.calls[1] == "starttls"
    assert smtp.calls[2] == "ehlo"
    assert smtp.calls[3] == ("login", "bot@example.com", "app-password-value")
    assert smtp.calls[4] == ("send_message", "user@example.com", "Verify your email")


def test_port_465_uses_ssl_without_starttls(monkeypatch):
    monkeypatch.setenv("EMAIL_USERNAME", "bot@example.com")
    monkeypatch.setenv("EMAIL_PASSWORD", "app-password-value")
    monkeypatch.setenv("EMAIL_SMTP_PORT", "465")
    monkeypatch.setattr(smtplib, "SMTP_SSL", _FakeSMTP)

    ok = _send("user@example.com", "subject", "<p>body</p>")
    assert ok is True
    smtp = _FakeSMTP.instances[0]
    assert smtp.port == 465
    assert "starttls" not in smtp.calls
    assert ("login", "bot@example.com", "app-password-value") in smtp.calls


def test_auth_failure_returns_false_not_an_exception(monkeypatch, capsys):
    monkeypatch.setenv("EMAIL_USERNAME", "bot@example.com")
    monkeypatch.setenv("EMAIL_PASSWORD", "wrong-password")
    monkeypatch.setenv("EMAIL_SMTP_PORT", "587")

    def make(host, port, timeout=None):
        s = _FakeSMTP(host, port, timeout)
        s.raise_on = "auth"
        return s

    monkeypatch.setattr(smtplib, "SMTP", make)
    assert _send("user@example.com", "subject", "<p>body</p>") is False
    # The password itself must never appear in what gets printed/logged.
    assert "wrong-password" not in capsys.readouterr().out


def test_generic_smtp_exception_returns_false(monkeypatch):
    monkeypatch.setenv("EMAIL_USERNAME", "bot@example.com")
    monkeypatch.setenv("EMAIL_PASSWORD", "app-password-value")
    monkeypatch.setenv("EMAIL_SMTP_PORT", "587")

    def make(host, port, timeout=None):
        s = _FakeSMTP(host, port, timeout)
        s.raise_on = "smtp"
        return s

    monkeypatch.setattr(smtplib, "SMTP", make)
    assert _send("user@example.com", "subject", "<p>body</p>") is False


def test_default_port_is_587_and_default_host_is_gmail(monkeypatch):
    monkeypatch.setenv("EMAIL_USERNAME", "bot@example.com")
    monkeypatch.setenv("EMAIL_PASSWORD", "app-password-value")
    monkeypatch.delenv("EMAIL_SMTP_HOST", raising=False)
    monkeypatch.delenv("EMAIL_SMTP_PORT", raising=False)
    monkeypatch.setattr(smtplib, "SMTP", _FakeSMTP)

    assert _send("user@example.com", "subject", "<p>body</p>") is True
    smtp = _FakeSMTP.instances[0]
    assert smtp.host == "smtp.gmail.com"
    assert smtp.port == 587
