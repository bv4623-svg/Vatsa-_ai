"""Circuit breaker state enum and the transition-hook callback type."""
from __future__ import annotations

from enum import Enum
from typing import Callable


class BreakerState(str, Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


TransitionHook = Callable[[str, BreakerState, BreakerState], None]
