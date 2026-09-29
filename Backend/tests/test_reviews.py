"""Reviews + wall API (PRD part 2), end to end through the real routes."""
import uuid
from datetime import date

import pytest

from app.models.review import Review
from app.models.usage_daily import UsageDaily
from app.models.user import User

_admins = {"n": 0}


def body(text="Really useful for coding help and the answers come back fast."):
    # Unique per call: identical text from another account counts as spam.
    return f"{text} Ref {uuid.uuid4().hex[:10]}."


def review(**overrides):
    return {"rating": 5, "title": "Great assistant", "body": body(), "pros": ["Fast"], "cons": [], "tags": [], **overrides}


@pytest.fixture(autouse=True)
def fresh_limits():
    from app.utils import rate_limit
    for key in [k for k in rate_limit._buckets if k.startswith(("review-", "admin-reviews:"))]:
        rate_limit.reset_rate_limit(key)


@pytest.fixture()
def trusted(make_user):
    """A paying customer: a verified reviewer, so published without the queue."""
    return lambda: make_user(tier="pro")


@pytest.fixture()
def admin(db, make_user, monkeypatch):
    _admins["n"] += 1
    user, headers = make_user(email=f"reviews-admin{_admins['n']}@example.com")
    monkeypatch.setenv("ADMIN_EMAILS", user.email)
    db.expire_all()
    db.get(User, user.id).two_factor_enabled = True
    db.commit()
    return user, headers


def post(client, headers, **overrides):
    res = client.post("/api/reviews", json=review(**overrides), headers=headers)
    assert res.status_code == 201, res.text
    return res.json()


def public_ids(client, **params):
    res = client.get("/api/reviews", params={"limit": 50, **params})
    assert res.status_code == 200, res.text
    return [r["id"] for r in res.json()["items"]]


# ── creating and moderation ──────────────────────────────────────────

def test_trusted_review_is_published_with_derived_fields(client, trusted):
    user, headers = trusted()
    created = post(client, headers)
    assert created["status"] == "approved" and created["is_verified"] is True
    assert created["sentiment"] == "positive" and {"coding", "speed", "quality"} <= set(created["tags"])
    assert created["author"] == {"id": user.id, "name": "Test U."}

    listed = client.get("/api/reviews", params={"q": created["body"][-16:]}).json()["items"]
    assert [r["id"] for r in listed] == [created["id"]]
    assert "status" not in listed[0] and "email" not in str(listed[0])


def test_new_free_account_waits_in_the_queue(client, make_user):
    _, headers = make_user()
    created = post(client, headers)
    assert created["status"] == "pending" and created["is_verified"] is False
    assert created["id"] not in public_ids(client)
    assert client.get(f"/api/reviews/{created['id']}").status_code == 404
    assert client.get(f"/api/reviews/{created['id']}", headers=headers).json()["status"] == "pending"
    mine = client.get("/api/reviews/mine", headers=headers).json()["items"]
    assert [r["id"] for r in mine] == [created["id"]]


def test_real_usage_earns_the_verified_badge(client, db, make_user):
    user, headers = make_user()
    db.add(UsageDaily(user_id=user.id, feature="chat_messages", date=date.today(), count=10))
    db.commit()
    created = post(client, headers)
    assert created["is_verified"] is True and created["status"] == "approved"


def test_abusive_and_spam_reviews_are_rejected_with_a_reason(client, trusted):
    _, headers = trusted()
    toxic = post(client, headers, body=body("This is garbage, fuck you devs, total waste of time."))
    assert toxic["status"] == "rejected" and "abusive" in toxic["moderation_note"]
    spam = post(client, headers, body=body("Promo code SAVE50 click here www.deals.shop whatsapp me 9876543210"))
    assert spam["status"] == "rejected" and "spam" in spam["moderation_note"]
    assert not {toxic["id"], spam["id"]} & set(public_ids(client))


def test_copied_text_goes_to_the_queue_and_self_repeat_is_refused(client, trusted):
    _, first = trusted()
    _, second = trusted()
    text = body()
    assert post(client, first, body=text)["status"] == "approved"
    assert post(client, second, body=text)["status"] == "pending"
    assert client.post("/api/reviews", json=review(body=text), headers=first).status_code == 409


@pytest.mark.parametrize("patch", [
    {"body": "too short"},
    {"body": "x" * 5001},
    {"rating": 0},
    {"rating": 6},
    {"tags": ["nonsense"]},
    {"pros": ["a", "b", "c", "d", "e", "f"]},
    {"cons": ["x" * 121]},
    {"title": "t" * 201},
])
def test_invalid_reviews_are_refused(client, make_user, patch):
    _, headers = make_user()
    assert client.post("/api/reviews", json=review(**patch), headers=headers).status_code == 422


def test_signing_in_is_required_and_three_a_day_is_the_limit(client, make_user):
    assert client.post("/api/reviews", json=review()).status_code in (401, 403)
    _, headers = make_user()
    for _ in range(3):
        post(client, headers)
    assert client.post("/api/reviews", json=review(), headers=headers).status_code == 429


def test_a_review_can_only_link_your_own_conversation(client, make_user):
    _, mine = make_user()
    other, _ = make_user()
    from app.database import SessionLocal
    from app.models.conversation import Conversation
    with SessionLocal() as s:
        s.add(Conversation(id=f"conv-{uuid.uuid4().hex[:8]}", user_id=other.id, title="x", messages=[]))
        s.commit()
        conv_id = s.query(Conversation).filter(Conversation.user_id == other.id).first().id
    assert client.post("/api/reviews", json=review(conversation_id=conv_id), headers=mine).status_code == 404


def test_editing_reruns_moderation_and_takedowns_cannot_be_edited(client, trusted):
    _, headers = trusted()
    created = post(client, headers)
    res = client.patch(f"/api/reviews/{created['id']}", json=review(body=body("Changed my mind, fuck you all.")), headers=headers)
    assert res.status_code == 200 and res.json()["status"] == "rejected"
    assert client.patch(f"/api/reviews/{created['id']}", json=review(), headers=headers).status_code == 409


def test_only_the_author_can_delete(client, trusted):
    _, author = trusted()
    _, stranger = trusted()
    created = post(client, author)
    assert client.delete(f"/api/reviews/{created['id']}", headers=stranger).status_code == 404
    assert client.delete(f"/api/reviews/{created['id']}", headers=author).status_code == 204
    assert client.get(f"/api/reviews/{created['id']}", headers=author).status_code == 404


# ── votes, reports, replies ──────────────────────────────────────────

def test_votes_toggle_switch_and_rank_most_helpful(client, trusted):
    _, author = trusted()
    marker = uuid.uuid4().hex[:8]
    low = post(client, author, body=body(f"Solid tool for daily coding work, marker {marker}"))
    high = post(client, author, body=body(f"Great for research and quick answers, marker {marker}"))
    voters = [trusted()[1] for _ in range(3)]

    url = f"/api/reviews/{high['id']}/vote"
    assert client.post(url, json={"vote_type": "helpful"}, headers=voters[0]).json() == {"helpful_count": 1, "not_helpful_count": 0, "my_vote": "helpful"}
    assert client.post(url, json={"vote_type": "helpful"}, headers=voters[0]).json()["my_vote"] is None
    assert client.post(url, json={"vote_type": "not_helpful"}, headers=voters[0]).json()["not_helpful_count"] == 1
    assert client.post(url, json={"vote_type": "helpful"}, headers=voters[0]).json() == {"helpful_count": 1, "not_helpful_count": 0, "my_vote": "helpful"}
    for v in voters[1:]:
        client.post(url, json={"vote_type": "helpful"}, headers=v)

    assert client.post(url, json={"vote_type": "helpful"}, headers=author).status_code == 400
    assert client.post(url, json={"vote_type": "helpful"}).status_code in (401, 403)
    assert public_ids(client, q=marker, sort="helpful")[:2] == [high["id"], low["id"]]
    seen = client.get(f"/api/reviews/{high['id']}", headers=voters[1]).json()
    assert seen["my_vote"] == "helpful" and seen["helpful_count"] == 3


def test_three_reports_send_an_untrusted_review_back_to_the_queue(client, make_user, admin):
    _, author = make_user()
    created = post(client, author)
    client.patch(f"/api/admin/reviews/{created['id']}/status", json={"status": "approved"}, headers=admin[1])
    assert created["id"] in public_ids(client)

    reporters = [make_user()[1] for _ in range(3)]
    url = f"/api/reviews/{created['id']}/report"
    assert client.post(url, json={"reason": "spam"}, headers=author).status_code == 400
    assert client.post(url, json={"reason": "spam", "details": "ad"}, headers=reporters[0]).status_code == 201
    assert client.post(url, json={"reason": "spam"}, headers=reporters[0]).status_code == 409
    for r in reporters[1:]:
        assert client.post(url, json={"reason": "fake"}, headers=r).status_code == 201

    assert created["id"] not in public_ids(client)
    mine = client.get(f"/api/reviews/{created['id']}", headers=author).json()
    assert mine["status"] == "pending" and "reports" in mine["moderation_note"]
    queued = client.get("/api/admin/reviews", headers=admin[1]).json()
    item = next(i for i in queued["items"] if i["id"] == created["id"])
    assert item["report_count"] == 3 and len(item["open_reports"]) == 3


def test_replies_are_between_the_team_and_the_reviewer(client, trusted, admin):
    _, author = trusted()
    _, stranger = trusted()
    created = post(client, author)
    url = f"/api/reviews/{created['id']}/reply"
    team = client.post(url, json={"body": "Thanks! Glad it helps."}, headers=admin[1]).json()["replies"]
    assert team[-1]["is_owner"] is True and team[-1]["author_name"] == "Vatsa AI team"
    back = client.post(url, json={"body": "Keep it up!"}, headers=author).json()["replies"]
    assert back[-1]["is_owner"] is False and len(back) == 2
    assert client.post(url, json={"body": "Me too"}, headers=stranger).status_code == 403


# ── walls ────────────────────────────────────────────────────────────

def test_pin_to_my_wall_share_reorder_and_unpin(client, trusted, make_user):
    _, author = trusted()
    first, second = post(client, author), post(client, author)
    me, headers = make_user()

    assert client.post(f"/api/reviews/{first['id']}/pin", headers=headers).json() == {"pinned": True, "is_public": False}
    client.post(f"/api/reviews/{second['id']}/pin", json={"is_public": True}, headers=headers)
    wall = client.get("/api/wall/me", headers=headers).json()["items"]
    assert [p["review_id"] for p in wall] == [first["id"], second["id"]] and wall[0]["review"]["pinned"] is True

    public = client.get(f"/api/users/{me.id}/wall").json()
    assert public["user"]["name"] == "Test U." and [r["id"] for r in public["items"]] == [second["id"]]

    assert client.put("/api/wall/me/order", json={"review_ids": [second["id"], first["id"]]}, headers=headers).status_code == 200
    assert [p["review_id"] for p in client.get("/api/wall/me", headers=headers).json()["items"]] == [second["id"], first["id"]]
    assert client.put("/api/wall/me/order", json={"review_ids": [999999]}, headers=headers).status_code == 400

    assert client.delete(f"/api/reviews/{first['id']}/pin", headers=headers).status_code == 204
    assert [p["review_id"] for p in client.get("/api/wall/me", headers=headers).json()["items"]] == [second["id"]]


def test_only_published_reviews_can_be_pinned(client, make_user):
    _, author = make_user()
    pending = post(client, author)
    _, headers = make_user()
    assert client.post(f"/api/reviews/{pending['id']}/pin", headers=headers).status_code == 404


def test_filters_search_and_cursor_pagination(client, trusted):
    marker = uuid.uuid4().hex[:8]
    ids = {}
    for rating in (5, 4, 3, 5, 2):
        _, h = trusted()
        created = post(client, h, rating=rating, body=body(f"Honest take on the images feature, marker {marker}"))
        ids[created["id"]] = rating

    assert set(public_ids(client, q=marker)) == set(ids)
    assert set(public_ids(client, q=marker, rating=5)) == {i for i, r in ids.items() if r == 5}
    assert set(public_ids(client, q=marker, tag="images")) == set(ids)
    assert public_ids(client, q=marker, tag="price") == []
    assert set(public_ids(client, q=marker, verified=True)) == set(ids)

    seen, cursor = [], None
    while True:
        params = {"q": marker, "sort": "top", "limit": 2, **({"cursor": cursor} if cursor else {})}
        page = client.get("/api/reviews", params=params).json()
        seen += [r["rating"] for r in page["items"]]
        cursor = page["next_cursor"]
        if not cursor:
            break
    assert seen == sorted(ids.values(), reverse=True)
    assert client.get("/api/reviews", params={"cursor": "garbage"}).status_code == 400
    assert client.get("/api/reviews", params={"tag": "nope"}).status_code == 422


def test_public_wall_first_page_has_featured_and_stats(client, trusted, admin):
    _, h = trusted()
    created = post(client, h)
    client.patch(f"/api/admin/reviews/{created['id']}/status", json={"featured": True}, headers=admin[1])
    first = client.get("/api/wall/public").json()
    assert created["id"] in [r["id"] for r in first["featured"]]
    assert first["stats"]["count"] >= 1 and set(first["stats"]["distribution"]) == {"1", "2", "3", "4", "5"}
    if first["next_cursor"]:
        later = client.get("/api/wall/public", params={"cursor": first["next_cursor"]}).json()
        assert "featured" not in later and "stats" not in later


def test_summary_uses_stats_without_a_key_and_the_llm_with_one(client, trusted, monkeypatch):
    from app.routers.reviews import public
    from app.services.ai_service import AIService

    _, h = trusted()
    for _ in range(3):
        post(client, h, pros=["Fast answers"], cons=["Pricey"])
    public._summary_cache.clear()
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    plain = client.get("/api/reviews/summary").json()
    assert plain["generated_by"] == "stats" and plain["text"].startswith("Based on")
    assert plain["stats"]["count"] >= 1 and plain["top_pros"]

    async def fake_llm(messages, model, max_tokens=1500, temperature=0.7):
        assert "reviews" in messages[0]["content"].lower()
        return {"content": "People love the speed; some find it pricey."}

    public._summary_cache.clear()
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setattr(AIService, "call_openrouter", staticmethod(fake_llm))
    posted = client.get("/api/reviews/summary").json()
    assert posted["generated_by"] == "ai" and posted["text"] == "People love the speed; some find it pricey."
    assert posted["top_cons"][0]["text"] == "Pricey"


def test_similar_reviews_rank_by_content(client, trusted):
    marker = uuid.uuid4().hex[:8]
    _, h = trusted()
    target = post(client, h, body=body(f"Python debugging help is superb {marker} python debugging traceback fixes"))
    near = post(client, h, body=body(f"Superb python debugging, it explained my traceback {marker}"))
    _, h2 = trusted()
    far = post(client, h2, body=body("Lovely watercolor landscapes from the picture generator"))
    items = [r["id"] for r in client.get(f"/api/reviews/{target['id']}/similar").json()["items"]]
    assert items and items[0] == near["id"] and far["id"] not in items[:1]


# ── moderation queue, appeals, bans ──────────────────────────────────

def test_queue_needs_an_admin_and_approval_publishes(client, make_user, admin):
    _, author = make_user()
    created = post(client, author)
    assert client.get("/api/admin/reviews", headers=author).status_code == 403
    queue = client.get("/api/admin/reviews", headers=admin[1]).json()
    item = next(i for i in queue["items"] if i["id"] == created["id"])
    assert item["author_email"] and "spam_score" in item and queue["counts"]["pending"] >= 1

    res = client.patch(f"/api/admin/reviews/{created['id']}/status", json={"status": "approved"}, headers=admin[1])
    assert res.status_code == 200 and created["id"] in public_ids(client)
    assert client.patch("/api/admin/reviews/999999/status", json={"status": "approved"}, headers=admin[1]).status_code == 404


def test_rejection_note_and_a_single_appeal(client, make_user, admin):
    _, author = make_user()
    created = post(client, author)
    client.patch(f"/api/admin/reviews/{created['id']}/status", json={"status": "rejected", "note": "Off-topic."}, headers=admin[1])
    seen = client.get(f"/api/reviews/{created['id']}", headers=author).json()
    assert seen["status"] == "rejected" and seen["moderation_note"] == "Off-topic."

    url = f"/api/reviews/{created['id']}/appeal"
    res = client.post(url, json={"message": "It is about the product, please look again."}, headers=author)
    assert res.status_code == 200 and res.json()["status"] == "pending" and res.json()["appealed"] is True
    client.patch(f"/api/admin/reviews/{created['id']}/status", json={"status": "rejected"}, headers=admin[1])
    assert client.post(url, json={"message": "Please, one more time now."}, headers=author).status_code == 409
    queued = client.get("/api/admin/reviews", params={"status": "rejected"}, headers=admin[1]).json()["items"]
    assert next(i for i in queued if i["id"] == created["id"])["appeal_message"].startswith("It is about")


def test_shadow_ban_hides_reviews_from_everyone_but_the_author(client, trusted, admin):
    user, headers = trusted()
    before = post(client, headers)
    assert client.post(f"/api/admin/users/{user.id}/ban", json={"mode": "shadow", "reason": "spam ring"}, headers=admin[1]).status_code == 200

    during = post(client, headers)
    assert during["status"] == "approved"
    assert not {before["id"], during["id"]} & set(public_ids(client))
    assert client.get(f"/api/reviews/{during['id']}", headers=headers).status_code == 200

    assert client.delete(f"/api/admin/users/{user.id}/ban", headers=admin[1]).status_code == 204
    assert before["id"] in public_ids(client)
    assert client.get(f"/api/reviews/{during['id']}", headers=headers).json()["status"] == "pending"


def test_full_ban_signs_the_user_out_and_hides_their_reviews(client, db, trusted, admin):
    user, headers = trusted()
    created = post(client, headers)
    assert client.post(f"/api/admin/users/{user.id}/ban", json={"mode": "full"}, headers=admin[1]).status_code == 200
    assert client.get("/auth/me", headers=headers).status_code in (400, 401, 403)  # deactivated -> 400 "Inactive user"
    assert created["id"] not in public_ids(client)
    db.expire_all()
    assert db.get(Review, created["id"]).status == "hidden"

    assert client.delete(f"/api/admin/users/{user.id}/ban", headers=admin[1]).status_code == 204
    db.expire_all()
    assert db.get(User, user.id).is_active is True


def test_admins_cannot_be_banned(client, admin):
    assert client.post(f"/api/admin/users/{admin[0].id}/ban", json={"mode": "full"}, headers=admin[1]).status_code == 400
