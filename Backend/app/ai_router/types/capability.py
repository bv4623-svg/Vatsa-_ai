"""Capability enum and the registry's per-model spec. No behaviour, no I/O."""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import FrozenSet, Optional


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
