"""Backs the "Priority queue" line on the pricing page (Pro/Business only).
Free-tier requests get a lower router priority than paid ones -- see
app/services/ai_service.py:_priority_for and app/ai_router/admission.py."""
from app.services.ai_service import _priority_for


class _FakeUser:
    def __init__(self, tier):
        self.tier = tier


def test_free_tier_gets_the_lowest_priority():
    assert _priority_for(_FakeUser("free"), is_code=False) == 3
    assert _priority_for(_FakeUser("free"), is_code=True) == 3


def test_pro_and_business_get_real_priority():
    for tier in ("pro", "business", "paid", "premium"):  # premium/paid are legacy aliases for pro
        assert _priority_for(_FakeUser(tier), is_code=False) == 1
        assert _priority_for(_FakeUser(tier), is_code=True) == 2


def test_paid_tiers_always_beat_free():
    free = _priority_for(_FakeUser("free"), is_code=False)
    paid_chat = _priority_for(_FakeUser("pro"), is_code=False)
    paid_code = _priority_for(_FakeUser("pro"), is_code=True)
    assert paid_chat < free
    assert paid_code < free
