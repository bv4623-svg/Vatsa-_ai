"""Unit tests for the heuristic review checks (no database, no network)."""
import pytest

from app.services import review_moderation as m


@pytest.mark.parametrize("text", [
    "Fuck you and this app", "what a bitch of a team", "you retard", "kill yourself",
    "ye chutiya app hai", "madarchod developers", "behenchod slow", "saala haramzade",
])
def test_abuse_is_found(text):
    assert m.find_toxic(text)


@pytest.mark.parametrize("text", [
    "I graduated summa cum laude and still needed help", "damn good tool", "a hell of a lot faster",
    "Randi from support was lovely", "the classic scunthorpe problem", "it assessed my code",
])
def test_ordinary_text_is_not_toxic(text):
    assert m.find_toxic(text) is None


def test_spam_signals_add_up():
    assert m.spam_score("Works well for my daily coding and research tasks.") == 0.0
    assert m.spam_score("great tool.In the end I kept using it") == 0.0  # missing space, not a link
    assert m.spam_score("see https://cheap.example for more") >= 0.35
    assert m.spam_score("call me at 98765 43210 for deals") >= 0.3
    assert m.spam_score("Use promo code SAVE50, click here, whatsapp me on 9876543210 www.x.shop") == 1.0
    assert m.spam_score("THIS IS THE BEST APP EVER MADE FOR ANYONE") == 0.2
    assert m.spam_score("normal words here", duplicate=True) == 0.6


def test_sentiment_follows_rating_and_words():
    assert m.sentiment(5, "love it") == "positive"
    assert m.sentiment(1, "fine") == "negative"
    assert m.sentiment(3, "it is okay") == "neutral"
    assert m.sentiment(3, "amazing, fast, reliable and accurate") == "positive"
    assert m.sentiment(3, "slow, buggy, useless and confusing") == "negative"


def test_auto_tags_match_whole_words_only():
    assert m.auto_tags("quick build guide, just start it") == ["speed"]
    assert "ui" not in m.auto_tags("quick build guide")
    assert "images" not in m.auto_tags("a smart article")
    assert m.auto_tags("Accurate answers, fast, clean UI, fair pricing") == ["quality", "speed", "price", "ui"]
    assert m.auto_tags("fast code", chosen=["support"]) == ["support", "speed", "coding"]
    assert len(m.auto_tags("fast code images research price support accurate ui")) == 5


def test_most_helpful_ranking_prefers_evidence():
    assert m.wilson_lower_bound(0, 0) == 0.0
    assert m.wilson_lower_bound(40, 2) > m.wilson_lower_bound(1, 0)
    assert m.wilson_lower_bound(10, 0) > m.wilson_lower_bound(10, 5)


def test_moderation_verdicts():
    clean = "Really useful for coding help and the answers are fast."
    assert m.moderate(rating=5, text=clean, chosen_tags=[], duplicate=False, trusted=True).status == "approved"
    assert m.moderate(rating=5, text=clean, chosen_tags=[], duplicate=False, trusted=False).status == "pending"

    toxic = m.moderate(rating=1, text="fuck you devs", chosen_tags=[], duplicate=False, trusted=True)
    assert toxic.status == "rejected" and "abusive" in toxic.note

    spam = m.moderate(rating=5, text="promo code X, click here, www.a.shop, whatsapp me", chosen_tags=[], duplicate=False, trusted=True)
    assert spam.status == "rejected" and "spam" in spam.note

    copied = m.moderate(rating=5, text=clean, chosen_tags=[], duplicate=True, trusted=True)
    assert copied.status == "pending" and copied.spam_score == 0.6
