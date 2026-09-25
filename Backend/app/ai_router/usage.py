"""Usage accounting, independent of how a model was chosen.

The router emits one UsageRecord per finished request to a UsageSink. The
sink decides where it goes. The default writes a structured log line; a
database-backed sink can replace it without touching the router.

The user's token balance is a separate concern (TokenService) and is not
changed here.
"""
from __future__ import annotations

import json
import logging
from dataclasses import asdict, dataclass
from typing import List, Optional, Protocol

from app.ai_router.types import ModelSpec, Usage

logger = logging.getLogger("AIRouter.usage")


@dataclass(frozen=True)
class UsageRecord:
    request_id: str
    user_id: Optional[int]
    provider: str
    model: str
    input_tokens: int
    output_tokens: int
    total_tokens: int
    duration_ms: float
    status: str  # "ok" | "truncated" | "error"
    error: Optional[str]  # an ErrorKind value or router error code, never provider text
    estimated_cost: Optional[float]  # USD; None when the model has no configured price
    tokens_estimated: bool  # True when the provider reported no usage and we counted by length


class UsageSink(Protocol):
    def record(self, record: UsageRecord) -> None: ...


class LoggingUsageSink:
    """One JSON line per request on the "AIRouter.usage" logger. These lines
    name providers and models, so they are internal logs, not user output."""

    def record(self, record: UsageRecord) -> None:
        logger.info("ai_usage %s", json.dumps(asdict(record), separators=(",", ":")))


class InMemoryUsageSink:
    """For tests and local inspection."""

    def __init__(self) -> None:
        self.records: List[UsageRecord] = []

    def record(self, record: UsageRecord) -> None:
        self.records.append(record)


def estimate_cost(spec: ModelSpec, usage: Optional[Usage]) -> Optional[float]:
    """USD for this call, or None if either price or usage is unknown."""
    if usage is None or spec.input_cost_per_mtok is None or spec.output_cost_per_mtok is None:
        return None
    return (
        usage.prompt_tokens * spec.input_cost_per_mtok + usage.completion_tokens * spec.output_cost_per_mtok
    ) / 1_000_000
