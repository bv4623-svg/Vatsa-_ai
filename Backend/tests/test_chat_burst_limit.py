"""app/routers/chat.py's short-window burst guard (CHAT_BURST_LIMIT per
CHAT_BURST_WINDOW_SECONDS, per user) -- independent of and in addition to
the per-day chat_messages/code_messages caps in feature_access.py, which
alone don't stop a script from burning through a whole day's allowance in
a few seconds."""
from app.ai_router import reset_router, set_router
from app.ai_router.config import RouterConfig, builtin_registry
from app.ai_router.engine import RouterEngine
from app.ai_router.providers.base import ProviderAdapter, ProviderResult
from app.ai_router.types import Usage
from app.routers.chat import CHAT_BURST_LIMIT
import pytest


class _FastAdapter(ProviderAdapter):
    name = "openrouter"

    async def generate(self, model, messages, *, max_tokens, temperature, timeout_s):
        return ProviderResult(content="ok", usage=Usage(5, 5))

    async def stream(self, model, messages, *, max_tokens, temperature, timeout_s):
        return
        yield  # pragma: no cover

    async def health_check(self, timeout_s=5.0):
        return True


@pytest.fixture()
def fast_router():
    config = RouterConfig.from_env({"AI_MAX_RETRIES": "0"})
    engine = RouterEngine(builtin_registry({}, "auto"), {"openrouter": _FastAdapter()}, config)
    set_router(engine)
    try:
        yield engine
    finally:
        reset_router()


def test_chat_burst_over_the_limit_is_rejected_with_429(client, make_user, fast_router):
    user, headers = make_user(tier="pro")  # pro: high enough daily cap that it's not what trips first
    for i in range(CHAT_BURST_LIMIT):
        res = client.post("/api/chat", json={"message": f"msg {i}"}, headers=headers)
        assert res.status_code == 200, res.text

    over_limit = client.post("/api/chat", json={"message": "one too many"}, headers=headers)
    assert over_limit.status_code == 429
    assert "Retry-After" in over_limit.headers


def test_chat_burst_limit_is_scoped_per_user(client, make_user, fast_router):
    user_a, headers_a = make_user(tier="pro")
    user_b, headers_b = make_user(tier="pro")
    for i in range(CHAT_BURST_LIMIT):
        client.post("/api/chat", json={"message": f"msg {i}"}, headers=headers_a)

    # user A is now over their own burst limit...
    assert client.post("/api/chat", json={"message": "x"}, headers=headers_a).status_code == 429
    # ...but user B is unaffected.
    assert client.post("/api/chat", json={"message": "hello"}, headers=headers_b).status_code == 200
