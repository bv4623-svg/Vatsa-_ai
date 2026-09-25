"""B6: confirms StreamingRedactor doesn't buffer an unbounded amount of text
for a long stream -- it should only ever hold back a small, fixed-size tail
(hold_back_words), regardless of how many chunks/words have already passed
through it. This is what actually prevents an OOM on a very long or
slow-consumer stream; it isn't something a memory profiler is needed to
prove, since the buffer's own size is directly inspectable."""
from app.ai_router.sanitize import StreamingRedactor


def test_streaming_redactor_pending_buffer_stays_small_over_a_long_stream():
    r = StreamingRedactor(hold_back_words=6)
    max_pending_len = 0
    for i in range(20_000):  # a long stream: 20k one-word chunks
        r.feed(f"word{i} ")
        max_pending_len = max(max_pending_len, len(r._pending))
    r.flush()
    # A handful of short words plus trailing space, never the whole stream.
    assert max_pending_len < 200, f"pending buffer grew to {max_pending_len} chars -- not bounded"


def test_streaming_redactor_handles_a_paused_then_resumed_consumer_without_dropping_text():
    """Feeding chunks with gaps in between (simulating a slow/paused
    consumer on the OTHER end of the stream, which doesn't affect this
    class at all since it holds no reference to the consumer) must not
    lose or duplicate any word."""
    r = StreamingRedactor()
    words = [f"tok{i}" for i in range(50)]
    out = []
    for i, w in enumerate(words):
        piece = r.feed(w + " ")
        if piece:
            out.append(piece)
        # Simulate a pause: no time-based state in StreamingRedactor, so
        # nothing here needs to "wait" -- the point is calling feed() with
        # gaps produces the same result as calling it back-to-back.
    out.append(r.flush())
    reconstructed = "".join(out).split()
    assert reconstructed == words
