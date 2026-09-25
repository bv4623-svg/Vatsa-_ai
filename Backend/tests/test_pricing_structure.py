"""Task 3 (new pricing structure): chat is unlimited on every tier, image
generation and web search have new numbers, and project count is a new,
now-actually-enforced limit (previously defined but never checked -- see
app/services/feature_access.py, app/routers/chat_projects/crud.py)."""
import uuid

from app.models.chat_project import ChatProject
from app.services.feature_access import check_daily_limit, check_project_limit


def test_chat_messages_is_unlimited_on_every_tier(db, make_user):
    for tier in ("free", "pro", "business"):
        user, _ = make_user(tier=tier, email=f"chat-{tier}@example.com")
        allowed, used, limit = check_daily_limit(db, user, "chat_messages")
        assert (allowed, used, limit) == (True, 0, 0)


def test_code_messages_is_unlimited_on_every_tier(db, make_user):
    for tier in ("free", "pro", "business"):
        user, _ = make_user(tier=tier, email=f"code-{tier}@example.com")
        allowed, used, limit = check_daily_limit(db, user, "code_messages")
        assert (allowed, used, limit) == (True, 0, 0)


def test_image_gen_limits_match_the_new_plan_numbers(db, make_user):
    expected = {"free": 5, "pro": 100, "business": 500}
    for tier, limit in expected.items():
        user, _ = make_user(tier=tier, email=f"image-{tier}@example.com")
        _, _, reported_limit = check_daily_limit(db, user, "image_gen")
        assert reported_limit == limit


def test_web_search_is_capped_on_free_but_unlimited_on_pro_and_business(db, make_user):
    free_user, _ = make_user(tier="free", email="search-free@example.com")
    allowed, used, limit = check_daily_limit(db, free_user, "web_search")
    assert limit == 5

    for tier in ("pro", "business"):
        user, _ = make_user(tier=tier, email=f"search-{tier}@example.com")
        allowed, used, limit = check_daily_limit(db, user, "web_search")
        assert (allowed, used, limit) == (True, 0, 0)


def test_project_limit_matches_the_new_plan_numbers_and_counts_real_rows(db, make_user):
    user, _ = make_user(tier="free", email="projects-free@example.com")
    allowed, used, limit = check_project_limit(db, user)
    assert (allowed, used, limit) == (True, 0, 1)

    db.add(ChatProject(id=uuid.uuid4().hex, user_id=user.id, name="Only project"))
    db.commit()

    allowed, used, limit = check_project_limit(db, user)
    assert (allowed, used, limit) == (False, 1, 1)


def test_project_limit_is_not_a_daily_counter(db, make_user):
    """Unlike image_gen/web_search (UsageDaily, resets at midnight),
    project count is real standing rows -- nothing about "today" frees up
    a slot; only deleting a project does."""
    user, _ = make_user(tier="free", email="projects-standing@example.com")
    db.add(ChatProject(id=uuid.uuid4().hex, user_id=user.id, name="P1"))
    db.commit()

    allowed, used, limit = check_project_limit(db, user)
    assert not allowed and used == 1

    # No UsageDaily row exists for this at all -- it's a live COUNT query,
    # confirmed by checking again without touching any date/usage table.
    allowed_again, used_again, _ = check_project_limit(db, user)
    assert (allowed_again, used_again) == (allowed, used)


def test_create_project_endpoint_enforces_the_free_tier_limit(client, make_user):
    _, headers = make_user(tier="free", email="projects-api@example.com")

    first = client.post("/api/projects", json={"name": "First"}, headers=headers)
    assert first.status_code == 200, first.text

    second = client.post("/api/projects", json={"name": "Second"}, headers=headers)
    assert second.status_code == 403, second.text
    body = second.json()["detail"]
    assert body["error"] == "project_limit_reached"
    assert body["used"] == 1 and body["limit"] == 1


def test_create_project_endpoint_allows_pro_up_to_twenty(client, make_user):
    _, headers = make_user(tier="pro", email="projects-pro@example.com")
    for i in range(20):
        res = client.post("/api/projects", json={"name": f"Project {i}"}, headers=headers)
        assert res.status_code == 200, res.text

    over_limit = client.post("/api/projects", json={"name": "One too many"}, headers=headers)
    assert over_limit.status_code == 403
    assert over_limit.json()["detail"]["limit"] == 20


def test_auth_me_usage_reflects_the_new_shape(client, make_user):
    _, headers = make_user(tier="free", email="me-usage@example.com")
    res = client.get("/auth/me", headers=headers)
    assert res.status_code == 200, res.text
    usage = res.json()["usage"]

    # chat_messages/code_messages no longer appear at all -- unlimited,
    # nothing meaningful to report.
    assert "chat_messages" not in usage
    assert "code_messages" not in usage

    assert usage["image_gen"] == {"used": 0, "limit": 5}
    assert usage["web_search"] == {"used": 0, "limit": 5}
    assert usage["code_apps"] == {"used": 0, "limit": 1}
