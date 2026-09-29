from app.ai_router.sanitize import StreamingRedactor


def _feed_words(redactor, text, chunk_words=1):
    """Feeds `text` through the redactor `chunk_words` words at a time
    (with the trailing space attached), collecting every emitted piece."""
    words = text.split(" ")
    out = []
    for i in range(0, len(words), chunk_words):
        chunk = " ".join(words[i:i + chunk_words])
        if i + chunk_words < len(words):
            chunk += " "
        piece = redactor.feed(chunk)
        if piece:
            out.append(piece)
    tail = redactor.flush()
    if tail:
        out.append(tail)
    return "".join(out)


def test_single_word_leak_caught_even_one_word_per_chunk():
    r = StreamingRedactor()
    out = _feed_words(r, "I am powered by Claude for this conversation", chunk_words=1)
    assert "claude" not in out.lower()
    assert out.startswith("I am powered by")


def test_compound_leak_split_across_chunks_is_still_caught():
    r = StreamingRedactor()
    out = _feed_words(r, "You could also reach me through Google's Gemini model", chunk_words=1)
    assert "gemini" not in out.lower()
    assert "google" not in out.lower()  # the compound match consumed it


def test_reassembled_text_matches_original_length_class_and_order():
    r = StreamingRedactor()
    out = _feed_words(r, "The weather today is sunny and warm outside", chunk_words=1)
    assert out == "The weather today is sunny and warm outside"  # nothing to redact, nothing dropped


def test_flush_releases_a_leak_that_never_gets_a_following_chunk():
    r = StreamingRedactor()
    r.feed("My provider is ")
    out = r.feed("OpenAI")  # fewer than hold_back_words tokens total so far -> held back
    out += r.flush()
    assert "openai" not in out.lower()


def test_two_word_chunks_still_catch_the_compound_pattern():
    r = StreamingRedactor()
    out = _feed_words(r, "Ask me about Google's Gemini and Anthropic's Claude", chunk_words=2)
    for leaked in ("google", "gemini", "anthropic", "claude"):
        assert leaked not in out.lower()


def test_ordinary_google_mention_survives_streaming_untouched():
    r = StreamingRedactor()
    out = _feed_words(r, "You can sign in with Google to sync your settings", chunk_words=1)
    assert out == "You can sign in with Google to sync your settings"
