"""Retry policy: bounded, jittered, and selective. Never retries blindly.

Which errors are retried, and how long we wait, is decided here and nowhere else.
A timeout is not retried by default: the attempt already spent its whole
timeout waiting, so trying the next model is cheaper than trying that one again.
"""
from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import Dict, FrozenSet, Mapping, Optional

from app.ai_router.errors import ErrorKind

DEFAULT_RETRYABLE = frozenset({ErrorKind.CONNECTION, ErrorKind.SERVER_ERROR, ErrorKind.RATE_LIMITED})


@dataclass(frozen=True)
class RetryPolicy:
    max_attempts: int = 2  # attempts per model, including the first
    base_delay_s: float = 0.25
    max_delay_s: float = 2.0
    multiplier: float = 2.0
    retryable: FrozenSet[ErrorKind] = DEFAULT_RETRYABLE
    #: A provider that asks us to wait longer than this (429 Retry-After) is
    #: skipped, not waited for.
    max_retry_after_s: float = 5.0

    def should_retry(self, kind: ErrorKind, attempt: int, retry_after: Optional[float] = None) -> bool:
        if attempt >= self.max_attempts or kind not in self.retryable:
            return False
        if retry_after is not None and retry_after > self.max_retry_after_s:
            return False
        return True

    def delay_s(self, attempt: int, retry_after: Optional[float] = None, rng: Optional[random.Random] = None) -> float:
        """Exponential backoff with full jitter, never shorter than a provider's
        explicit Retry-After. The jitter spreads simultaneous retries apart so a
        brief outage does not turn into a synchronized retry storm."""
        rng = rng or random
        ceiling = min(self.max_delay_s, self.base_delay_s * (self.multiplier ** (attempt - 1)))
        delay = rng.uniform(0, ceiling)
        if retry_after is not None:
            delay = max(delay, retry_after)
        return delay


@dataclass(frozen=True)
class RetryPolicies:
    """A default policy plus optional per-provider overrides."""

    default: RetryPolicy = field(default_factory=RetryPolicy)
    per_provider: Mapping[str, RetryPolicy] = field(default_factory=dict)

    def for_provider(self, provider: str) -> RetryPolicy:
        return self.per_provider.get(provider, self.default)
