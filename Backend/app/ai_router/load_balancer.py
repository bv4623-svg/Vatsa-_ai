"""Tracks how many calls are currently in flight per model, so load-aware
strategies can spread traffic. Process-local by design: it measures this
instance's own load, which is what this instance can act on."""
from __future__ import annotations

import threading
from typing import Dict


class InFlightTracker:
    def __init__(self) -> None:
        self._counts: Dict[str, int] = {}
        self._lock = threading.Lock()

    def begin(self, model_id: str) -> None:
        with self._lock:
            self._counts[model_id] = self._counts.get(model_id, 0) + 1

    def end(self, model_id: str) -> None:
        with self._lock:
            self._counts[model_id] = max(0, self._counts.get(model_id, 0) - 1)

    def count(self, model_id: str) -> int:
        with self._lock:
            return self._counts.get(model_id, 0)

    def total(self) -> int:
        with self._lock:
            return sum(self._counts.values())
