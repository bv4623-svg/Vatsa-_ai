"""Per provider/model circuit breaker.

    CLOSED --(N consecutive failures)--> OPEN --(cooldown)--> HALF_OPEN
       ^                                                          |
       +---------------(probe succeeds)---------------------------+
                        (probe fails: back to OPEN, cooldown restarts)

State is kept in this process. A deployment with several instances therefore
has an independent breaker per instance, which is safe (each learns quickly on
its own) but not shared; moving it to Redis is a change to this file only.
"""
from __future__ import annotations

import threading
import time
from typing import Callable, Optional

from app.ai_router.circuit_breaker.state import BreakerState, TransitionHook


class CircuitBreaker:
    def __init__(
        self,
        name: str,
        *,
        failure_threshold: int = 5,
        cooldown_s: float = 30.0,
        half_open_max_calls: int = 1,
        clock: Callable[[], float] = time.monotonic,
        on_transition: Optional[TransitionHook] = None,
    ) -> None:
        self.name = name
        self._threshold = failure_threshold
        self._cooldown_s = cooldown_s
        self._half_open_max = half_open_max_calls
        self._clock = clock
        self._on_transition = on_transition
        self._lock = threading.Lock()
        self._state = BreakerState.CLOSED
        self._consecutive_failures = 0
        self._opened_at = 0.0
        self._probes = 0

    # -- state ---------------------------------------------------------
    def _set(self, new: BreakerState) -> None:
        old, self._state = self._state, new
        if old != new and self._on_transition:
            self._on_transition(self.name, old, new)

    def _refresh(self) -> BreakerState:
        if self._state == BreakerState.OPEN and self._clock() - self._opened_at >= self._cooldown_s:
            self._probes = 0
            self._set(BreakerState.HALF_OPEN)
        return self._state

    def peek(self) -> BreakerState:
        """Current state without reserving a probe slot. For ordering and reporting."""
        with self._lock:
            return self._refresh()

    # -- use -----------------------------------------------------------
    def allow(self) -> bool:
        """Ask permission for one call. In HALF_OPEN this reserves a probe slot,
        which the caller returns through record_success/record_failure/cancel."""
        with self._lock:
            state = self._refresh()
            if state == BreakerState.CLOSED:
                return True
            if state == BreakerState.OPEN:
                return False
            if self._probes < self._half_open_max:
                self._probes += 1
                return True
            return False

    def record_success(self) -> None:
        with self._lock:
            self._probes = max(0, self._probes - 1)
            self._consecutive_failures = 0
            if self._state == BreakerState.HALF_OPEN:
                self._set(BreakerState.CLOSED)

    def record_failure(self) -> None:
        with self._lock:
            if self._state == BreakerState.HALF_OPEN:
                self._probes = 0
                self._opened_at = self._clock()
                self._set(BreakerState.OPEN)
                return
            self._consecutive_failures += 1
            if self._state == BreakerState.CLOSED and self._consecutive_failures >= self._threshold:
                self._opened_at = self._clock()
                self._set(BreakerState.OPEN)

    def cancel(self) -> None:
        """A call that was allowed never finished (client went away). Neither
        a success nor a failure, so just hand back the probe slot."""
        with self._lock:
            self._probes = max(0, self._probes - 1)
