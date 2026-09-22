"""The central model/provider registry.

All knowledge of which model serves which public name lives here (and in the
config that builds it). Application code asks for a public route name such as
"auto" or "vatsa-pro"; it never sees or supplies a provider model id.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, List, Mapping, Optional, Tuple

from app.ai_router.types import ModelSpec


@dataclass(frozen=True)
class RouteDef:
    primary: str  # ModelSpec.id
    fallbacks: Tuple[str, ...] = ()
    allow_fallback: bool = True
    #: True keeps `primary` first whatever the strategy is. False lets the
    #: strategy reorder the whole list (for pools of equivalent models).
    pinned: bool = True


@dataclass(frozen=True)
class RoutePlan:
    route: str
    primary: ModelSpec
    fallbacks: Tuple[ModelSpec, ...]
    allow_fallback: bool
    pinned: bool

    def candidates(self) -> List[ModelSpec]:
        return [self.primary, *self.fallbacks]


# The legacy rule the token check used when it only had a model name to go on.
_LEGACY_PREMIUM_MARKERS = ("claude", "gpt-4o", "sonnet", "opus", "pro")


class ModelRegistry:
    def __init__(self, models: Iterable[ModelSpec], routes: Mapping[str, RouteDef], default_route: str = "auto") -> None:
        self._models: Dict[str, ModelSpec] = {}
        for m in models:
            if m.id in self._models:
                raise ValueError(f"duplicate model id in registry: {m.id!r}")
            self._models[m.id] = m
        self._routes: Dict[str, RouteDef] = {k.strip().lower(): v for k, v in routes.items()}
        self._default_route = default_route.strip().lower()

        for name, route in self._routes.items():
            for model_id in (route.primary, *route.fallbacks):
                if model_id not in self._models:
                    raise ValueError(f"route {name!r} references unknown model id {model_id!r}")
        if self._default_route not in self._routes:
            raise ValueError(f"default route {default_route!r} is not defined")

    # -- lookups -------------------------------------------------------
    def get(self, model_id: str) -> ModelSpec:
        return self._models[model_id]

    def models(self) -> List[ModelSpec]:
        return list(self._models.values())

    def route_names(self) -> List[str]:
        return sorted(self._routes)

    def canonical_route(self, alias: Optional[str]) -> str:
        """Unknown or missing names map to the default route. A client can
        therefore never select a provider model by sending its id."""
        key = (alias or "").strip().lower()
        return key if key in self._routes else self._default_route

    def resolve(self, alias: Optional[str]) -> RoutePlan:
        name = self.canonical_route(alias)
        route = self._routes[name]
        primary = self._models[route.primary]
        fallbacks = tuple(
            self._models[i] for i in route.fallbacks if i != route.primary and self._models[i].enabled
        )
        return RoutePlan(name, primary, fallbacks, route.allow_fallback, route.pinned)

    # -- policy helpers ------------------------------------------------
    @staticmethod
    def is_premium(spec: ModelSpec) -> bool:
        if spec.premium is not None:
            return spec.premium
        name = spec.model.lower()
        return any(marker in name for marker in _LEGACY_PREMIUM_MARKERS)

    def is_route_premium(self, alias: Optional[str]) -> bool:
        return self.is_premium(self.resolve(alias).primary)

    def internal_terms(self) -> List[str]:
        """Every provider name, registry id and provider model id, for the
        sanitizer to redact if one ever appears in user-facing text."""
        terms = set()
        for m in self._models.values():
            terms.update({m.id, m.model, m.provider})
        return sorted(terms)
