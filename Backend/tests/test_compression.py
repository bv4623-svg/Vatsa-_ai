"""Responses are gzip-compressed for clients that accept it, except the
server-sent event streams, which must reach the browser chunk by chunk."""
from llm_fakes import fake_llm, sse_events  # noqa: F401  (fixture)
from app.database import SessionLocal
from app.models.conversation import Conversation

GZIP = {"Accept-Encoding": "gzip"}


def _seed_conversations(user_id, n=20):
    db = SessionLocal()
    try:
        text = "The quick brown fox jumps over the lazy dog while the answer explains recursion. " * 8
        for i in range(n):
            db.add(Conversation(id=f"conv_gz{user_id}_{i}", user_id=user_id, title=f"Chat {i}", workspace="chat",
                                messages=[{"role": "user", "content": text}, {"role": "assistant", "content": text}]))
        db.commit()
    finally:
        db.close()


def test_json_responses_are_gzipped(client, make_user):
    user, headers = make_user()
    _seed_conversations(user.id)
    plain = client.get("/api/conversations", headers={**headers, "Accept-Encoding": "identity"})
    zipped = client.get("/api/conversations", headers={**headers, **GZIP})
    assert plain.status_code == zipped.status_code == 200
    assert "content-encoding" not in plain.headers
    assert zipped.headers["content-encoding"] == "gzip"
    assert zipped.json() == plain.json(), "compression must not change the payload"
    with client.stream("GET", "/api/conversations", headers={**headers, **GZIP}) as res:
        wire_bytes = sum(len(chunk) for chunk in res.iter_raw())
    assert wire_bytes < len(plain.content) / 5, (wire_bytes, len(plain.content))


def test_chat_stream_is_not_compressed(client, make_user, fake_llm):  # noqa: F811
    _, headers = make_user()
    conv_id = client.post("/api/conversations", json={"title": "t"}, headers=headers).json()["id"]
    res = client.post("/api/chat", json={"message": "hello", "conversation_id": conv_id, "stream": True}, headers={**headers, **GZIP})
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/event-stream")
    assert "content-encoding" not in res.headers, "a gzipped SSE stream is buffered and arrives all at once"
    assert "".join(e.get("delta", "") for e in sse_events(res.text)) == "Hello there."
