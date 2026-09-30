"""No prompt sent to an AI model contains the user's email address, or
anything built from it (Phase 0 Fix 2; owner decision 2026-09-30: drop it,
don't mask it). The model gets the name the person gave, nothing else that
identifies them. See AIService._build_messages."""
import json
import re
import uuid
from pathlib import Path

import pytest

from app.models.user import User
from app.services.ai_service import AIService
from llm_fakes import fake_llm  # noqa: F401  (fixture)

DOMAIN = "privacy-example.org"
APP = Path(__file__).resolve().parent.parent / "app"


def assert_no_email(sent, email, *also_absent):
    text = json.dumps(sent)
    for needle in (email, email.split("@")[0], DOMAIN, *also_absent):
        assert needle not in text, f"{needle!r} reached the model"


@pytest.fixture()
def person(db, make_user):
    """A signed-in user with a distinctive email; returns (user, headers, email)."""
    email = f"zyx.leakcheck.{uuid.uuid4().hex[:8]}@{DOMAIN}"
    user, headers = make_user(email=email)
    return db.get(User, user.id), headers, email


def test_the_system_prompt_has_the_name_but_never_the_email(db, person):
    user, _, email = person
    user.full_name = "Asha Rao"
    db.commit()
    messages = AIService._build_messages(user, db, "Who am I?", [], False)
    assert_no_email(messages, email)
    assert "Asha Rao" in messages[0]["content"]


def test_without_a_name_nothing_email_derived_stands_in(db, person):
    """Google/GitHub usernames are built from the email (e.g.
    zyx.leakcheck_google), so neither may be used as a fallback name."""
    user, _, email = person
    user.full_name = None
    user.username = email.split("@")[0] + "_google"
    db.commit()
    messages = AIService._build_messages(user, db, "Who am I?", [], False)
    assert_no_email(messages, email, user.username)
    assert "Name: not set" in messages[0]["content"]


@pytest.mark.parametrize("stream", [False, True])
def test_what_chat_actually_sends_to_the_model(client, person, fake_llm, stream):
    _, headers, email = person
    res = client.post("/api/chat", json={"message": "Who am I?", "stream": stream}, headers=headers)
    assert res.status_code == 200, res.text
    assert fake_llm["messages"], "the model was never called"
    assert_no_email(fake_llm["messages"], email)


# Everything that builds a request to a model, found by what it calls, plus
# the helpers whose output goes into those prompts.
PROMPT_HELPERS = ["services/memory_service.py"]
EMAIL_USE = re.compile(r"""\.email\b|\[\s*["']email["']\s*\]|\.get\(\s*["']email["']""")


def prompt_building_files():
    files = {p for p in APP.rglob("*.py") if "ai_router" not in p.parts and "RouteRequest(" in p.read_text(encoding="utf-8")}
    return sorted(files | {APP / h for h in PROMPT_HELPERS})


def test_prompt_building_code_never_touches_an_email():
    files = prompt_building_files()
    names = {f.relative_to(APP).as_posix() for f in files}
    # The scan must actually cover the known prompt builders.
    assert {"services/ai_service.py", "services/research_service.py", "routers/vision.py", "routers/reviews/public.py"} <= names
    offenders = [
        f"{f.relative_to(APP).as_posix()}:{n}: {line.strip()}"
        for f in files
        for n, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1)
        if EMAIL_USE.search(line)
    ]
    assert offenders == [], "email used in prompt-building code:\n" + "\n".join(offenders)
