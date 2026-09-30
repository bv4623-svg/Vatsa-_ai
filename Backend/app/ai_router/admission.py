"""Admission control: backpressure instead of unbounded queues.

When too many AI calls are already running in this process, new ones are
refused at once (the API turns that into a 503 with a retry hint) rather than
piling up in memory. Lower-priority work is refused earlier, so interactive
chat keeps headroom while batch work is shed first.

Priorities are numbers, 1 = most important. The share of capacity each may
use is configurable; unlisted priorities get the smallest share.
"""
from __future__ import annotations

import threading
from contextlib import contextmanager
from typing import Dict, Iterator, Mapping, Optional

from app.ai_router.errors import RouterOverloaded

DEFAULT_PRIORITY_SHARES: Mapping[int, float] = {1: 1.0, 2: 0.9, 3: 0.7, 4: 0.5}


class AdmissionController:
    def __init__(self, max_inflight: int, priority_shares: Optional[Mapping[int, float]] = None) -> None:
        self._max = max_inflight
        self._shares: Dict[int, float] = dict(priority_shares or DEFAULT_PRIORITY_SHARES)
        self._inflight = 0
        self._lock = threading.Lock()

    def _limit_for(self, priority: int) -> int:
        share = self._shares.get(priority, min(self._shares.values()))
        return max(1, int(self._max * share))

    def try_acquire(self, priority: int = 1) -> bool:
        with self._lock:
            if self._inflight >= self._limit_for(priority):
                return False
            self._inflight += 1
            return True

    def has_capacity(self, priority: int = 1) -> bool:
        """Non-reserving check, for callers that want to answer 503 before they
        start a streaming response (once headers are sent it is too late)."""
        with self._lock:
            return self._inflight < self._limit_for(priority)

    def release(self) -> None:
        with self._lock:
            self._inflight = max(0, self._inflight - 1)

    @property
    def inflight(self) -> int:
        with self._lock:
            return self._inflight

    @contextmanager
    def slot(self, priority: int = 1) -> Iterator[None]:
        if not self.try_acquire(priority):
            raise RouterOverloaded()
        try:
            yield
        finally:
            self.release()
