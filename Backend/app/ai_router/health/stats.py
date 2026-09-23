"""Per-model rolling health stats, kept by HealthTracker."""
from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from typing import Deque, Optional


@dataclass
class _ModelStats:
    ewma_latency_ms: Optional[float] = None
    successes: int = 0
    failures: int = 0
    recent: Deque[bool] = field(default_factory=lambda: deque(maxlen=50))
    last_error: Optional[str] = None
    last_success_at: Optional[float] = None
    last_failure_at: Optional[float] = None
