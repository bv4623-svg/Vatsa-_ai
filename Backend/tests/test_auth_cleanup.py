"""Task 1 (email/OTP auth cleanup): new email/password sign-up is retired,
Microsoft OAuth is gone entirely, Google/GitHub OAuth and existing-user
password login both still work, and oauth_linked tracks which accounts
have a proven Google/GitHub identity. See app/routers/auth/core.py,
app/routers/auth/oauth/, app/models/user.py."""
from app.auth.jwt import get_password_hash
from app.models.user import User


def test_new_email_signup_is_blocked_with_a_clear_message(client):
    for path in ("/auth/register", "/api/auth/register", "/api/auth/signup"):
        res = client.post(path, json={"email": "new@example.com", "password": "whatever-12345", "verification_token": "x"})
        assert res.status_code == 410, res.text
        assert "google" in res.json()["detail"].lower()
        assert "github" in res.json()["detail"].lower()


def test_no_account_was_created_by_the_blocked_signup_attempt(client, db):
    client.post("/api/auth/register", json={"email": "should-not-exist@example.com", "password": "whatever-12345"})
    assert db.query(User).filter_by(email="should-not-exist@example.com").first() is None


def test_microsoft_oauth_routes_are_gone(client):
    for path in ("/auth/microsoft/login", "/api/auth/microsoft/login", "/auth/microsoft/callback"):
        res = client.get(path, follow_redirects=False)
        assert res.status_code == 404, f"{path} -> {res.status_code}"


def test_google_and_github_oauth_login_routes_still_redirect(client):
    for provider in ("google", "github"):
        res = client.get(f"/api/auth/{provider}/login", follow_redirects=False)
        # Redirects either to the real provider (creds configured) or back
        # to the frontend with a "*_not_configured" error (creds absent in
        # this test env) -- either way it's a live route, not a 404/500.
        assert res.status_code in (302, 307), f"{provider} -> {res.status_code}"


def test_existing_password_user_can_still_log_in(client, make_user):
    user, _ = make_user()
    res = client.post("/auth/login", json={"email": user.email, "password": "a-long-test-password-1"})
    assert res.status_code == 200, res.text
    assert res.json()["access_token"]


def test_oauth_linked_is_false_for_a_legacy_password_only_account(db, make_user):
    user, _ = make_user()
    db.refresh(user)
    assert user.oauth_linked is False


def test_oauth_linked_is_true_for_a_brand_new_oauth_signup(db):
    from app.routers.auth.oauth.shared import get_or_create_oauth_user

    user = get_or_create_oauth_user(db, "fresh-oauth-user@example.com", "Fresh User", "google")
    assert user.oauth_linked is True


def test_oauth_login_marks_a_matching_legacy_account_as_linked(db, make_user):
    from app.routers.auth.oauth.shared import get_or_create_oauth_user

    user, _ = make_user()
    db.refresh(user)
    assert user.oauth_linked is False

    same_user = get_or_create_oauth_user(db, user.email, user.full_name, "github")
    assert same_user.id == user.id
    assert same_user.oauth_linked is True


def test_logout_requires_a_valid_token(client):
    res = client.post("/api/auth/logout")
    assert res.status_code == 401


def test_logout_succeeds_for_an_authenticated_user_and_clears_the_cookie(client, make_user):
    _, headers = make_user(email="logout-test@example.com")
    res = client.post("/api/auth/logout", headers=headers)
    assert res.status_code == 200, res.text
    assert res.json() == {"success": True}
    set_cookie = res.headers.get("set-cookie", "")
    assert "vatsa_session=" in set_cookie
    assert "Max-Age=0" in set_cookie


def test_logout_does_not_bump_token_version(db, client, make_user):
    """Logout must not invalidate the account's other active sessions --
    that's a separate, deliberate action (sign-out-other-devices), not
    what a routine logout should do."""
    user, headers = make_user(email="logout-scope@example.com")
    version_before = user.token_version
    client.post("/api/auth/logout", headers=headers)
    db.refresh(user)
    assert user.token_version == version_before
