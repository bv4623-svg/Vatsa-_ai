"""Plain data types shared by every part of the router. No behaviour, no I/O."""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, FrozenSet, List, Optional


class Capability(str, Enum):
    CHAT = "chat"
    CODE = "code"
    VISION = "vision"
    REASONING = "reasoning"
    EMBEDDING = "embedding"


@dataclass(frozen=True)
class ModelSpec:
    """One row of the registry: a model reachable through one provider adapter.

    `id` is the internal registry key. `model` is the provider's own model
    name. Neither is ever shown to an end user (see sanitize.py).

    Cost fields are USD per one million tokens and are None until someone
    enters real prices: the router never guesses a price.
    """

    id: str
    provider: str
    model: str
    capabilities: FrozenSet[Capability]
    context_window: Optional[int] = None
    max_output: Optional[int] = None
    input_cost_per_mtok: Optional[float] = None
    output_cost_per_mtok: Optional[float] = None
    latency_profile: Optional[str] = None  # "fast" | "medium" | "slow" | None (measured at runtime)
    priority: int = 100  # lower = preferred
    premium: Optional[bool] = None  # None = apply the legacy name-based rule
    enabled: bool = True

    @property
    def supports_streaming(self) -> bool:
        return True

    def supports(self, required: FrozenSet[Capability]) -> bool:
        return required <= self.capabilities


@dataclass(frozen=True)
class Usage:
    prompt_tokens: int = 0
    completion_tokens: int = 0

    @property
    def total_tokens(self) -> int:
        return self.prompt_tokens + self.completion_tokens


@dataclass
class RouteRequest:
    """What the application asks the router for. Provider-neutral."""

    messages: List[Dict[str, Any]]
    route: str = "auto"  # public alias chosen by the client/app, never a provider model id
    max_tokens: int = 1500
    temperature: float = 0.7
    required: FrozenSet[Capability] = frozenset({Capability.CHAT})
    allow_fallback: bool = True
    include_reasoning: bool = False  # forward "thinking" chunks to the caller
    priority: int = 1  # 1 = interactive chat ... 4 = batch (configurable, see admission.py)
    user_id: Optional[int] = None
    request_id: str = field(default_factory=lambda: uuid.uuid4().hex)
    trace_id: Optional[str] = None


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


class EventType(str, Enum):
    DELTA = "delta"
    THINKING = "thinking"
    USAGE = "usage"
    DONE = "done"


@dataclass
class StreamEvent:
    type: EventType
    content: str = ""
    usage: Optional[Usage] = None
    truncated: bool = False  # DONE only: the stream broke after output had started
    meta: Optional[RouteMeta] = None  # DONE only
