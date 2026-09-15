import asyncio
import logging
from abc import ABC, abstractmethod
from typing import AsyncGenerator, Dict, List, Optional, Set, Any, Union
from contextlib import asynccontextmanager
from enum import Enum   # <-- FIX: missing import added

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# =============================================================================
# Shared types and configuration
# =============================================================================

class ProviderConfig(BaseModel):
    """Base configuration for any LLM provider."""
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    timeout: float = 60.0  # seconds
    max_retries: int = 3
    retry_backoff: float = 1.0

    model_config = {"extra": "allow"}  # allow provider‑specific fields


class Capability(str, Enum):
    """Standard capability tags for providers."""
    CODING = "coding"
    VISION = "vision"
    REASONING = "reasoning"
    MATH = "math"
    SEARCH = "search"
    IMAGE_GEN = "image_gen"
    TOOL_USE = "tool_use"
    VOICE = "voice"
    TRANSLATION = "translation"
    MEDICAL = "medical"
    LEGAL = "legal"
    LONG_CONTEXT = "long_context"
    EMBEDDING = "embedding"


# =============================================================================
# Core Base Provider
# =============================================================================

class BaseProvider(ABC):
    """
    Abstract base class for all AI/LLM providers.

    All providers must implement the async generation methods and provide
    their own metadata (capabilities, model list, cost estimates).
    """

    def __init__(self, config: Optional[ProviderConfig] = None):
        self.config = config or ProviderConfig()
        self._initialized = False
        self._lock = asyncio.Lock()

    # -------------------------------------------------------------------------
    # Abstract methods – MUST be implemented by subclasses
    # -------------------------------------------------------------------------

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Human‑readable provider name (e.g., 'openai', 'anthropic', 'openrouter')."""
        pass

    @abstractmethod
    async def generate_async(
        self,
        messages: List[Dict[str, str]],
        model: str,
        **kwargs
    ) -> str:
        """
        Async non‑streaming completion.

        Args:
            messages: List of message dicts with 'role' and 'content'.
            model: Model identifier string (e.g., 'gpt-4').
            **kwargs: Additional provider‑specific parameters (temperature, top_p, etc.)

        Returns:
            The complete generated text (content of the assistant message).
        """
        pass

    @abstractmethod
    async def generate_stream(
        self,
        messages: List[Dict[str, str]],
        model: str,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """
        Async streaming completion.

        Yields:
            Chunks of the generated response (strings).
        """
        pass

    @abstractmethod
    async def health_check(self) -> bool:
        """
        Check if the provider is operational.

        Should validate API key, network connectivity, and basic endpoint availability.
        Returns True if healthy, False otherwise.
        """
        pass

    @abstractmethod
    async def list_models(self) -> List[str]:
        """
        Return a list of available model identifiers (e.g., ['gpt-4', 'gpt-3.5-turbo']).

        This may be cached; provider can implement its own caching.
        """
        pass

    @abstractmethod
    def estimate_cost(self, prompt_tokens: int, completion_tokens: int, model: str) -> float:
        """
        Estimate the USD cost for a given token usage.

        Args:
            prompt_tokens: Number of input tokens.
            completion_tokens: Number of output tokens.
            model: Model used.

        Returns:
            Cost in USD (float).
        """
        pass

    @abstractmethod
    def estimate_tokens(self, text: str) -> int:
        """
        Rough token count for a given text.

        Providers should use the most accurate tokenizer available (e.g., tiktoken for OpenAI).
        """
        pass

    @abstractmethod
    def supports_capability(self, capability: Union[str, Capability]) -> bool:
        """
        Check if this provider supports a specific capability.

        Args:
            capability: Capability tag (e.g., 'vision', 'reasoning').

        Returns:
            True if the provider can handle that capability.
        """
        pass

    # -------------------------------------------------------------------------
    # Optional / utility methods (can be overridden)
    # -------------------------------------------------------------------------

    async def initialize(self) -> None:
        """
        Perform any one‑time setup (e.g., load tokenizer, warm up connections).
        Called automatically before first use if not already initialized.
        """
        async with self._lock:
            if not self._initialized:
                await self._setup()
                self._initialized = True

    async def _setup(self) -> None:
        """Subclasses can override for custom initialization."""
        pass

    async def generate_with_retry(
        self,
        messages: List[Dict[str, str]],
        model: str,
        retries: Optional[int] = None,
        **kwargs
    ) -> str:
        """
        Generate with automatic retry on transient errors.

        Uses the provider's configured max_retries unless overridden.
        """
        max_retries = retries if retries is not None else self.config.max_retries
        last_exception = None

        for attempt in range(max_retries + 1):
            try:
                return await self.generate_async(messages, model, **kwargs)
            except Exception as e:
                logger.warning(
                    f"{self.provider_name} attempt {attempt+1}/{max_retries+1} failed: {e}"
                )
                last_exception = e
                if attempt < max_retries:
                    await asyncio.sleep(self.config.retry_backoff * (2 ** attempt))
                else:
                    raise last_exception
        raise last_exception  # Should never happen

    @asynccontextmanager
    async def streaming_context(
        self,
        messages: List[Dict[str, str]],
        model: str,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """
        Convenience context manager for streaming; ensures cleanup.
        Usage: async with provider.streaming_context(...) as stream: async for chunk in stream: ...
        """
        async for chunk in self.generate_stream(messages, model, **kwargs):
            yield chunk

    # -------------------------------------------------------------------------
    # Backward compatibility (sync wrapper, optional)
    # -------------------------------------------------------------------------

    def generate(self, query: str, intent: str) -> str:
        """
        Synchronous wrapper for generate_async (kept for compatibility).
        Not recommended for production use; use async methods instead.
        """
        # Simple synchronous loop – will block event loop if called from async context.
        # Better to deprecate this.
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            messages = [{"role": "user", "content": query}]
            return loop.run_until_complete(
                self.generate_async(messages, model=self._default_model_for_intent(intent))
            )
        finally:
            loop.close()

    def _default_model_for_intent(self, intent: str) -> str:
        """Subclasses may override to map intent to a default model."""
        return "default"


# =============================================================================
# Mixins for common functionality (optional)
# =============================================================================

class CapabilityMixin:
    """Mixin to provide capability checking from a static set."""

    def __init__(self, capabilities: Set[Capability], *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._capabilities = capabilities

    def supports_capability(self, capability: Union[str, Capability]) -> bool:
        if isinstance(capability, str):
            capability = Capability(capability)
        return capability in self._capabilities


class TokenEstimationMixin:
    """Mixin to provide token estimation using tiktoken (if available)."""

    def __init__(self, encoding_name: str = "cl100k_base", *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._encoding_name = encoding_name
        self._tokenizer = None
        try:
            import tiktoken
            self._tokenizer = tiktoken.get_encoding(encoding_name)
        except ImportError:
            logger.warning("tiktoken not installed; falling back to character/4 token estimation.")
        except Exception as e:
            logger.warning(f"Failed to load tiktoken: {e}")

    def estimate_tokens(self, text: str) -> int:
        if self._tokenizer:
            return len(self._tokenizer.encode(text))
        # Rough fallback: ~4 chars per token
        return len(text) // 4

    def estimate_cost(self, prompt_tokens: int, completion_tokens: int, model: str) -> float:
        """
        Simple cost estimation – subclasses should override with actual pricing.
        """
        # This is a placeholder – override in concrete classes.
        return (prompt_tokens + completion_tokens) * 0.000002  # $0.002 per 1K tokens


# =============================================================================
# Registry and factory (optional but helpful)
# =============================================================================

class ProviderRegistry:
    """Registry to manage provider instances."""

    _providers: Dict[str, BaseProvider] = {}

    @classmethod
    def register(cls, name: str, provider: BaseProvider) -> None:
        cls._providers[name] = provider

    @classmethod
    def get(cls, name: str) -> Optional[BaseProvider]:
        return cls._providers.get(name)

    @classmethod
    def list(cls) -> List[str]:
        return list(cls._providers.keys())

    @classmethod
    def clear(cls) -> None:
        cls._providers.clear()


# =============================================================================
# ALIAS for backward compatibility with llm_client.py
# =============================================================================

class BaseLLMProvider(BaseProvider):
    """
    Alias for BaseProvider – used by legacy llm_client imports.
    """
    pass