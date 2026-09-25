"""GET /auth/me and GET /payment/plans are cached; settings/onboarding
writes invalidate the profile cache. See app/routers/auth/core.py and
app/services/payment_service.py."""
import app.utils.cache as cache


def test_profile_served_from_cache_on_second_call(client, make_user, monkeypatch):
    monkeypatch.setattr(cache, "CACHE_ENABLED", True)
    user, headers = make_user()

    first = client.get("/auth/me", headers=headers).json()

    # Mutate directly in the DB, bypassing the app -- the cached response
    # must still be served, proving the second call didn't re-query.
    from app.database import SessionLocal
    from app.models.user import User
    db = SessionLocal()
    try:
        db.query(User).filter_by(id=user.id).update({"full_name": "Someone Else"})
        db.commit()
    finally:
        db.close()

    second = client.get("/auth/me", headers=headers).json()
    assert second["full_name"] == first["full_name"]


def test_update_settings_invalidates_the_profile_cache(client, make_user, monkeypatch):
    monkeypatch.setattr(cache, "CACHE_ENABLED", True)
    _, headers = make_user()

    client.get("/auth/me", headers=headers)  # populate cache
    client.patch("/auth/settings", json={"theme": "dark"}, headers=headers)

    profile = client.get("/auth/me", headers=headers).json()
    assert profile["settings"]["theme"] == "dark"


def test_complete_onboarding_invalidates_the_profile_cache(client, make_user, monkeypatch):
    monkeypatch.setattr(cache, "CACHE_ENABLED", True)
    _, headers = make_user()

    client.get("/auth/me", headers=headers)  # populate cache
    client.post("/auth/onboarding", json={"birth_month": 5, "birth_year": 1995}, headers=headers)

    profile = client.get("/auth/me", headers=headers).json()
    assert profile["profile_completed"] is True
    assert profile["birth_month"] == 5


def test_plans_are_cached(client, monkeypatch):
    monkeypatch.setattr(cache, "CACHE_ENABLED", True)
    first = client.get("/payment/plans").json()
    second = client.get("/payment/plans").json()
    assert first == second
    assert "pro:USD" in first["plans"]
