from app.ai_router.circuit_breaker import BreakerBoard, BreakerState, CircuitBreaker


def test_opens_after_threshold_consecutive_failures():
    clock = {"t": 0.0}
    b = CircuitBreaker("m", failure_threshold=3, cooldown_s=10, clock=lambda: clock["t"])
    assert b.allow() is True
    b.record_failure()
    assert b.peek() == BreakerState.CLOSED
    b.record_failure()
    assert b.peek() == BreakerState.CLOSED
    b.record_failure()
    assert b.peek() == BreakerState.OPEN
    assert b.allow() is False


def test_success_resets_the_failure_count():
    clock = {"t": 0.0}
    b = CircuitBreaker("m", failure_threshold=2, cooldown_s=10, clock=lambda: clock["t"])
    b.record_failure()
    b.record_success()
    b.record_failure()
    assert b.peek() == BreakerState.CLOSED  # the earlier failure was forgotten


def test_half_open_after_cooldown_then_closes_on_success():
    clock = {"t": 0.0}
    b = CircuitBreaker("m", failure_threshold=1, cooldown_s=30, half_open_max_calls=1, clock=lambda: clock["t"])
    b.record_failure()
    assert b.peek() == BreakerState.OPEN
    assert b.allow() is False

    clock["t"] = 31.0
    assert b.peek() == BreakerState.HALF_OPEN
    assert b.allow() is True  # the one probe slot
    assert b.allow() is False  # no second concurrent probe
    b.record_success()
    assert b.peek() == BreakerState.CLOSED


def test_half_open_probe_failure_reopens_and_restarts_cooldown():
    clock = {"t": 0.0}
    b = CircuitBreaker("m", failure_threshold=1, cooldown_s=30, clock=lambda: clock["t"])
    b.record_failure()
    clock["t"] = 31.0
    assert b.allow() is True
    b.record_failure()
    assert b.peek() == BreakerState.OPEN
    clock["t"] = 40.0  # still within the new cooldown window
    assert b.peek() == BreakerState.OPEN
    clock["t"] = 62.0
    assert b.peek() == BreakerState.HALF_OPEN


def test_cancel_returns_the_probe_slot_without_counting():
    clock = {"t": 0.0}
    b = CircuitBreaker("m", failure_threshold=1, cooldown_s=30, half_open_max_calls=1, clock=lambda: clock["t"])
    b.record_failure()
    clock["t"] = 31.0
    assert b.allow() is True
    b.cancel()
    assert b.peek() == BreakerState.HALF_OPEN  # neither closed nor reopened
    assert b.allow() is True  # the slot is free again


def test_on_transition_hook_fires():
    events = []
    b = CircuitBreaker("m", failure_threshold=1, on_transition=lambda name, old, new: events.append((name, old, new)))
    b.record_failure()
    assert events == [("m", BreakerState.CLOSED, BreakerState.OPEN)]


def test_breaker_board_is_per_model_and_lazy():
    board = BreakerBoard(failure_threshold=1)
    a = board.get("model-a")
    b = board.get("model-b")
    assert a is not b
    assert board.get("model-a") is a  # same instance on second call
    a.record_failure()
    states = board.states()
    assert states["model-a"] == BreakerState.OPEN
    assert states["model-b"] == BreakerState.CLOSED  # created lazily, never failed
