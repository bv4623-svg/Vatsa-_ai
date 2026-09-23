"""B13: Sentry is entirely opt-in via SENTRY_DSN, and must be a true
no-op (no import attempted, nothing sent) when it's unset -- see
app/utils/sentry_integration.py."""
import app.utils.sentry_integration as sentry_integration


def test_init_is_a_noop_when_sentry_dsn_is_unset(monkeypatch):
    monkeypatch.delenv("SENTRY_DSN", raising=False)
    monkeypatch.setattr(sentry_integration, "_enabled", False)
    assert sentry_integration.init_sentry() is False


def test_capture_exception_is_a_noop_when_not_enabled(monkeypatch):
    monkeypatch.setattr(sentry_integration, "_enabled", False)
    # Must not raise, and must not require sentry_sdk to be importable.
    sentry_integration.capture_exception(ValueError("should be ignored"))


def test_init_reports_missing_package_gracefully_instead_of_crashing(monkeypatch):
    monkeypatch.setenv("SENTRY_DSN", "https://fake@example.ingest.sentry.io/1")
    monkeypatch.setattr(sentry_integration, "_enabled", False)

    import builtins
    real_import = builtins.__import__

    def fake_import(name, *args, **kwargs):
        if name == "sentry_sdk":
            raise ImportError("simulated: sentry-sdk not installed")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", fake_import)
    assert sentry_integration.init_sentry() is False


def test_full_app_still_works_with_sentry_dsn_set_but_package_missing(monkeypatch):
    """The whole point of the ImportError guard: a deployer who sets
    SENTRY_DSN without installing sentry-sdk must get a working app with a
    log warning, not a crashed startup."""
    monkeypatch.setenv("SENTRY_DSN", "https://fake@example.ingest.sentry.io/1")
    monkeypatch.setattr(sentry_integration, "_enabled", False)

    import builtins
    real_import = builtins.__import__

    def fake_import(name, *args, **kwargs):
        if name == "sentry_sdk":
            raise ImportError("simulated: sentry-sdk not installed")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", fake_import)
    result = sentry_integration.init_sentry()
    assert result is False
    sentry_integration.capture_exception(RuntimeError("still must not raise"))
