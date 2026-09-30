"""The interface every provider adapter implements.

Nothing outside app/ai_router/providers/ may import a provider SDK or build a
provider URL. To add a provider: write an adapter that satisfies this class,
register it in ai_router/__init__.py, and add its models to the registry.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, AsyncIterator, Dict, List, Optional, Sequence

from app.ai_router.errors import ErrorKind, ProviderError
from app.ai_router.types import StreamEvent, Usage


@dataclass
class ProviderResult:
    content: str
    reasoning: str = ""
    usage: Optional[Usage] = None


class ProviderAdapter(ABC):
    #: registry key; matches ModelSpec.provider
    name: str = ""

    @abstractmethod
    async def generate(
        self,
        model: str,
        messages: List[Dict[str, Any]],
        *,
        max_tokens: int,
        temperature: float,
        timeout_s: float,
    ) -> ProviderResult:
        """One buffered completion. Raise ProviderError on any failure."""

    @abstractmethod
    def stream(
        self,
        model: str,
        messages: List[Dict[str, Any]],
        *,
        max_tokens: int,
        temperature: float,
        timeout_s: float,
    ) -> AsyncIterator[StreamEvent]:
        """Async generator of normalized DELTA / THINKING / USAGE events.
        Raise ProviderError on failure, before or after output has started."""

    async def embed(self, model: str, texts: Sequence[str]) -> List[List[float]]:
        raise ProviderError(ErrorKind.BAD_REQUEST, detail=f"{self.name} adapter does not support embeddings")

    def count_tokens(self, model: str, messages: List[Dict[str, Any]]) -> int:
        """Cheap estimate (about four characters per token). Adapters with a
        real tokenizer may override it."""
        chars = 0
        for m in messages:
            content = m.get("content", "")
            if isinstance(content, str):
                chars += len(content)
            elif isinstance(content, list):
                chars += sum(len(p.get("text", "")) for p in content if isinstance(p, dict))
        return max(1, chars // 4)

    @abstractmethod
    async def health_check(self, timeout_s: float = 5.0) -> bool:
        """True if the provider is reachable and answering. Must be cheap and
        must not spend the user's tokens."""
