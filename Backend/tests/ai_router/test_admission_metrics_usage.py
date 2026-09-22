import pytest

from app.ai_router.admission import AdmissionController
from app.ai_router.errors import RouterOverloaded
from app.ai_router.metrics import RouterMetrics
from app.ai_router.types import ModelSpec, Capability, Usage
from app.ai_router.usage import InMemoryUsageSink, UsageRecord, estimate_cost


def test_admission_blocks_once_full_and_releases_the_slot():
    adm = AdmissionController(max_inflight=1)
    assert adm.try_acquire(1) is True
    assert adm.try_acquire(1) is False
    adm.release()
    assert adm.try_acquire(1) is True


def test_admission_slot_context_manager_raises_and_cleans_up():
    adm = AdmissionController(max_inflight=1)
    with adm.slot(1):
        assert adm.inflight == 1
        with pytest.raises(RouterOverloaded):
            with adm.slot(1):
                pass  # never reached
    assert adm.inflight == 0  # the outer slot released cleanly despite the inner failure


def test_admission_lower_priority_is_shed_first():
    # share for priority 4 is smaller than for priority 1 by default
    adm = AdmissionController(max_inflight=10, priority_shares={1: 1.0, 4: 0.2})
    for _ in range(2):
        assert adm.try_acquire(4) is True
    assert adm.try_acquire(4) is False  # priority-4 capacity (2 of 10) is used up
    assert adm.try_acquire(1) is True  # priority-1 still has room


def test_has_capacity_does_not_reserve():
    adm = AdmissionController(max_inflight=1)
    assert adm.has_capacity(1) is True
    assert adm.inflight == 0
    adm.try_acquire(1)
    assert adm.has_capacity(1) is False


def test_metrics_counters_and_histogram():
    m = RouterMetrics()
    m.incr("router_requests_total", provider="openrouter", model="gpt-4o", status="ok")
    m.incr("router_requests_total", provider="openrouter", model="gpt-4o", status="ok")
    m.incr("router_requests_total", provider="openrouter", model="sonnet", status="error")
    assert m.counter("router_requests_total", model="gpt-4o") == 2
    assert m.counter("router_requests_total", status="error") == 1

    m.observe_latency(120.0, provider="openrouter", model="gpt-4o")
    m.observe_latency(9000.0, provider="openrouter", model="gpt-4o")
    snap = m.snapshot()
    hist = next(h for h in snap["latency"] if h["labels"]["model"] == "gpt-4o")
    assert hist["count"] == 2

    text = m.prometheus()
    assert "ai_router_router_requests_total" in text
    assert "ai_router_latency_ms_bucket" in text


def test_estimate_cost_is_none_without_price_or_usage():
    priced = ModelSpec("m", "p", "p/m", frozenset({Capability.CHAT}), input_cost_per_mtok=2.0, output_cost_per_mtok=6.0)
    unpriced = ModelSpec("u", "p", "p/u", frozenset({Capability.CHAT}))
    usage = Usage(prompt_tokens=1_000_000, completion_tokens=500_000)

    assert estimate_cost(priced, None) is None
    assert estimate_cost(unpriced, usage) is None
    assert estimate_cost(priced, usage) == pytest.approx(2.0 * 1 + 6.0 * 0.5)


def test_in_memory_usage_sink_records():
    sink = InMemoryUsageSink()
    rec = UsageRecord(
        request_id="r1", user_id=1, provider="openrouter", model="gpt-4o",
        input_tokens=10, output_tokens=5, total_tokens=15, duration_ms=42.0,
        status="ok", error=None, estimated_cost=None, tokens_estimated=False,
    )
    sink.record(rec)
    assert sink.records == [rec]
