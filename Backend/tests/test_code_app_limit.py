"""POST /api/conversations with workspace="code": the free/pro/business
code-app limit (1/20/200) is enforced here for real, not just advertised
on the pricing page. See app/services/feature_access.py's
check_code_app_limit and app/routers/conversations.py."""


def _create(client, headers, workspace="code"):
    return client.post("/api/conversations", headers=headers, json={"workspace": workspace})


def test_free_user_can_create_exactly_one_code_app(client, make_user):
    _, headers = make_user(tier="free", email="codeapp-free1@example.com")
    res = _create(client, headers)
    assert res.status_code == 200, res.text


def test_free_user_is_blocked_on_the_second_code_app(client, make_user):
    _, headers = make_user(tier="free", email="codeapp-free2@example.com")
    first = _create(client, headers)
    assert first.status_code == 200, first.text

    second = _create(client, headers)
    assert second.status_code == 403, second.text
    body = second.json()["detail"]
    assert body["error"] == "app_limit_reached"
    assert body["used"] == 1
    assert body["limit"] == 1
    assert body["upgrade_url"] == "/pricing"


def test_plain_chat_workspace_is_never_limited(client, make_user):
    """workspace="chat" (the default, regular chat conversations) must not
    be affected by the code-app cap at all."""
    _, headers = make_user(tier="free", email="codeapp-chat-unlimited@example.com")
    for _ in range(5):
        res = _create(client, headers, workspace="chat")
        assert res.status_code == 200, res.text


def test_deleting_a_code_app_frees_a_slot(client, make_user):
    _, headers = make_user(tier="free", email="codeapp-delete@example.com")
    first = _create(client, headers)
    conv_id = first.json()["id"]

    blocked = _create(client, headers)
    assert blocked.status_code == 403

    del_res = client.delete(f"/api/conversations/{conv_id}", headers=headers)
    assert del_res.status_code == 200, del_res.text

    after_delete = _create(client, headers)
    assert after_delete.status_code == 200, after_delete.text


def test_archiving_a_code_app_does_not_free_a_slot(client, make_user):
    """Matches check_project_limit's existing behavior for ChatProject --
    archiving hides an item from view, it isn't the same as deleting it."""
    _, headers = make_user(tier="free", email="codeapp-archive@example.com")
    first = _create(client, headers)
    conv_id = first.json()["id"]

    archive_res = client.patch(f"/api/conversations/{conv_id}", headers=headers, json={"archived": True})
    assert archive_res.status_code == 200, archive_res.text

    still_blocked = _create(client, headers)
    assert still_blocked.status_code == 403


def test_pro_user_gets_twenty_code_apps(client, make_user):
    _, headers = make_user(tier="pro", email="codeapp-pro@example.com")
    for i in range(20):
        res = _create(client, headers)
        assert res.status_code == 200, f"app #{i + 1} failed: {res.text}"

    res = _create(client, headers)
    assert res.status_code == 403
    assert res.json()["detail"]["limit"] == 20


def test_business_user_gets_two_hundred_code_apps_quota(client, make_user, db):
    """Creating 200 real rows is unnecessarily slow for a unit test --
    verify the limit value itself instead by inserting rows directly."""
    from app.models.conversation import Conversation
    import uuid

    user, headers = make_user(tier="business", email="codeapp-business@example.com")
    for i in range(200):
        db.add(Conversation(id=f"conv_test_{uuid.uuid4().hex[:12]}", user_id=user.id, workspace="code"))
    db.commit()

    res = _create(client, headers)
    assert res.status_code == 403
    assert res.json()["detail"]["limit"] == 200
    assert res.json()["detail"]["used"] == 200


def test_direct_api_bypass_is_still_enforced(client, make_user):
    """The limit lives in the endpoint itself, not in any UI -- there is no
    separate "unlimited" path for a direct API call."""
    _, headers = make_user(tier="free", email="codeapp-bypass@example.com")
    _create(client, headers)
    res = _create(client, headers)
    assert res.status_code == 403
