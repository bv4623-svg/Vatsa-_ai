"""Per provider/model circuit breaker.

    CLOSED --(N consecutive failures)--> OPEN --(cooldown)--> HALF_OPEN
       ^                                                          |
       +---------------(probe succeeds)---------------------------+
                        (probe fails: back to OPEN, cooldown restarts)

State is kept in this process. A deployment with several instances therefore
has an independent breaker per instance, which is safe (each learns quickly on
its own) but not shared; moving it to Redis is a change to this file only.

Split into state.py/breaker.py/board.py; every public name is re-exported
here so `from app.ai_router.circuit_breaker import X` keeps working exactly
as it did when this was one file.
"""
from app.ai_router.circuit_breaker.state import BreakerState, TransitionHook
from app.ai_router.circuit_breaker.breaker import CircuitBreaker
from app.ai_router.circuit_breaker.board import BreakerBoard

__all__ = ["BreakerState", "TransitionHook", "CircuitBreaker", "BreakerBoard"]
