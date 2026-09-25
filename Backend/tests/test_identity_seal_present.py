"""The model can only refuse to reveal its identity if the instruction
telling it to actually reaches it on every request. This checks the code
guarantee (the seal is in the system prompt sent to the router for both
workspaces); it cannot test how a real model responds to that instruction,
which depends on the live provider."""
from app.services.ai_service import AIService, IDENTITY_SEAL


def test_identity_seal_is_in_every_system_prompt(db, make_user):
    user, _ = make_user()
    for workspace in ("chat", "code"):
        messages = AIService._build_messages(
            user, db, "hello", conversation_history=[], is_code=(workspace == "code"),
        )
        system_msg = next(m for m in messages if m["role"] == "system")
        assert IDENTITY_SEAL.strip() in system_msg["content"]


def test_identity_seal_is_the_last_thing_in_the_system_prompt(db, make_user):
    """Appended last so it has the highest priority and can't be pushed out
    of context or diluted by project instructions / response style / search
    context earlier in the same prompt."""
    user, _ = make_user()
    messages = AIService._build_messages(
        user, db, "hello", conversation_history=[], is_code=False,
        project_instructions="Always answer in French.",
        response_style_instructions="Be extremely verbose.",
        search_context="Some live web results.",
    )
    system_msg = next(m for m in messages if m["role"] == "system")
    assert system_msg["content"].rstrip().endswith(IDENTITY_SEAL.strip())
