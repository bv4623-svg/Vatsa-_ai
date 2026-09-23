"""One breaker per model id, created on first use with shared settings."""
from __future__ import annotations

import threading
import time
from typing import Callable, Dict, Optional

from app.ai_router.circuit_breaker.breaker import CircuitBreaker
from app.ai_router.circuit_breaker.state import BreakerState, TransitionHook


class BreakerBoard:
    def __init__(
        self,
        *,
        failure_threshold: int = 5,
        cooldown_s: float = 30.0,
        half_open_max_calls: int = 1,
        clock: Callable[[], float] = time.monotonic,
        on_transition: Optional[TransitionHook] = None,
    ) -> None:
        self._kwargs = dict(
            failure_threshold=failure_threshold,
            cooldown_s=cooldown_s,
            half_open_max_calls=half_open_max_calls,
            clock=clock,
            on_transition=on_transition,
        )
        self._breakers: Dict[str, CircuitBreaker] = {}
        self._lock = threading.Lock()

    def get(self, model_id: str) -> CircuitBreaker:
        with self._lock:
            breaker = self._breakers.get(model_id)
            if breaker is None:
                breaker = self._breakers[model_id] = CircuitBreaker(model_id, **self._kwargs)
            return breaker

    def states(self) -> Dict[str, BreakerState]:
        with self._lock:
            breakers = list(self._breakers.values())
        return {b.name: b.peek() for b in breakers}
