"""What the router hands back for a buffered (non-streaming) call. No
behaviour, no I/O."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from app.ai_router.types.usage import Usage


@dataclass(frozen=True)
class RouteMeta:
    """Internal facts about how a request was served. For logs and metrics
    only; the application layer must not forward it to a client."""

    request_id: str
    provider: str
    model: str
    latency_ms: float
    attempts: int
    fallbacks: int


@dataclass
class GenerateResult:
    content: str
    reasoning: str
    usage: Optional[Usage]
    meta: RouteMeta
