# app/config/settings.py
"""
Application configuration for Vatsa AI Router.
Loads from environment variables with sensible defaults.
"""

import os
from pathlib import Path
from typing import Dict, List, Optional, Any

from dotenv import load_dotenv
from pydantic import BaseModel, Field, ConfigDict
from pydantic_settings import BaseSettings

# Load .env file
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)


# =============================================================================
# Nested Models for structured configuration
# =============================================================================

class TaskLevel(BaseModel):
    """Metadata for a task difficulty level."""
    description: str
    examples: List[str]
    max_tokens: int
    preferred_models: str
    model_config = ConfigDict(frozen=True)


class ProviderCosts(BaseModel):
    """Cost per 1K input tokens (USD) for various models."""
    model_costs: Dict[str, float] = Field(
        default_factory=lambda: {
            "openai/gpt-4.1-mini": 0.00015,
            "google/gemini-flash": 0.00010,
            "anthropic/claude-3-haiku": 0.00025,
            "deepseek/deepseek-chat": 0.00014,
            "mistral/mistral-small": 0.00012,
            "openrouter/auto": 0.00020,
        }
    )


class BudgetModes(BaseModel):
    """Budget modes mapped to cost limits (USD)."""
    modes: Dict[str, float] = Field(
        default_factory=lambda: {
            "FREE": 0.0,
            "CHEAP": 0.001,
            "BALANCED": 0.01,
            "PREMIUM": 0.05,
            "UNLIMITED": 1.0,
        }
    )


class EnterprisePolicies(BaseModel):
    """Domain‑specific enterprise policies with required tags."""
    policies: Dict[str, Dict[str, Any]] = Field(
        default_factory=lambda: {
            "medical": {
                "keywords": ["medical", "healthcare", "diagnosis", "symptom"],
                "required_capabilities": ["reasoning", "medical"],
            },
            "legal": {
                "keywords": ["legal", "contract", "lawsuit", "compliance"],
                "required_capabilities": ["reasoning", "legal"],
            },
            "finance": {
                "keywords": ["finance", "investment", "accounting", "banking"],
                "required_capabilities": ["reasoning", "math"],
            },
        }
    )


# =============================================================================
# Main Settings Class
# =============================================================================

class Settings(BaseSettings):
    """
    Application configuration.
    All values can be overridden via environment variables.
    """

    # ---- API Keys ----
    OPENROUTER_API_KEY: Optional[str] = Field(
        default=os.getenv("OPENROUTER_API_KEY"),
        description="OpenRouter API key"
    )
    OPENAI_API_KEY: Optional[str] = Field(default=os.getenv("OPENAI_API_KEY"))
    ANTHROPIC_API_KEY: Optional[str] = Field(default=os.getenv("ANTHROPIC_API_KEY"))
    GEMINI_API_KEY: Optional[str] = Field(default=os.getenv("GEMINI_API_KEY"))
    DEEPSEEK_API_KEY: Optional[str] = Field(default=os.getenv("DEEPSEEK_API_KEY"))
    MISTRAL_API_KEY: Optional[str] = Field(default=os.getenv("MISTRAL_API_KEY"))

    # ---- OpenRouter Endpoint ----
    OPENROUTER_BASE_URL: str = Field(
        default=os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
        description="Base URL for OpenRouter API"
    )
    DEFAULT_MODEL: str = Field(
        default=os.getenv("DEFAULT_MODEL", "openai/gpt-4o"),
        description="Default model used when none is specified"
    )

    # ---- Provider Preferences ----
    PREFERRED_PROVIDERS: List[str] = Field(
        default=["openrouter", "google", "openai", "anthropic", "deepseek", "mistral"],
        description="Ordered list of preferred providers"
    )

    # ---- Task Levels ----
    TASK_LEVELS: Dict[str, TaskLevel] = Field(
        default_factory=lambda: {
            "tiny": TaskLevel(
                description="Single‑turn greetings & acknowledgements",
                examples=["hi", "hello", "hey", "good morning", "good night", "thanks", "thank you", "bye", "ok", "yes", "no", "lol", "hmm", "👍", "👋"],
                max_tokens=100,
                preferred_models="free-fast"
            ),
            "simple": TaskLevel(
                description="Very basic language tasks",
                examples=["translate", "grammar", "rewrite", "paraphrase", "spell check", "fix sentence", "correct english", "summarize short text", "title generation"],
                max_tokens=500,
                preferred_models="cheap"
            ),
            "easy": TaskLevel(
                description="Basic content generation",
                examples=["email", "letter", "caption", "tweet", "linkedin post", "blog outline", "resume", "cover letter", "notes", "faq"],
                max_tokens=1500,
                preferred_models="cheap-fast"
            ),
            "standard": TaskLevel(
                description="General assistant work",
                examples=["tutorial", "how to", "explain", "planning", "travel plan", "diet plan", "study plan", "career advice", "brainstorm"],
                max_tokens=3000,
                preferred_models="balanced"
            ),
            "technical": TaskLevel(
                description="Programming & debugging",
                examples=["python", "javascript", "react", "nextjs", "fastapi", "sql", "docker", "bug fix", "code review", "debugging", "refactor", "algorithm"],
                max_tokens=6000,
                preferred_models="coding"
            ),
            "analysis": TaskLevel(
                description="Deep reasoning",
                examples=["compare", "research", "evaluate", "decision making", "tradeoff", "financial analysis", "market analysis", "competitor analysis", "SWOT"],
                max_tokens=10000,
                preferred_models="reasoning"
            ),
            "creative": TaskLevel(
                description="Creative generation",
                examples=["story", "movie script", "novel", "song", "poem", "marketing campaign", "branding", "ad copy"],
                max_tokens=8000,
                preferred_models="creative"
            ),
            "professional": TaskLevel(
                description="Business & enterprise",
                examples=["business plan", "startup roadmap", "architecture", "enterprise", "PRD", "SRS", "API design", "workflow", "automation"],
                max_tokens=15000,
                preferred_models="enterprise"
            ),
            "expert": TaskLevel(
                description="Advanced engineering",
                examples=["distributed systems", "microservices", "kubernetes", "AI agents", "multi-agent", "LLM router", "MCP", "vector database", "RAG", "compiler", "operating system"],
                max_tokens=25000,
                preferred_models="premium"
            ),
            "ultra": TaskLevel(
                description="Mission critical",
                examples=["scientific research", "medical analysis", "legal analysis", "production-ready SaaS", "enterprise migration", "million-line codebase", "security audit", "AI Operating System"],
                max_tokens=100000,
                preferred_models="best-available"
            ),
        }
    )

    # ---- Budget & Priorities ----
    BUDGET_MODES: BudgetModes = Field(default_factory=BudgetModes)
    DEFAULT_BUDGET_MODE: str = "BALANCED"

    USER_PRIORITIES: List[str] = Field(
        default=["fast", "cheap", "best_quality", "reasoning", "coding", "research"],
        description="Possible user priority choices"
    )
    DEFAULT_PRIORITY: str = "best_quality"

    # ---- Latency & Context ----
    LATENCY_SCORES: Dict[str, float] = Field(
        default={
            "gpt-5": 2.5,
            "claude-opus": 3.0,
            "gemini-flash": 1.4,
            "deepseek": 0.9,
            "qwen-flash": 1.2,
            "mistral-small": 1.0,
            "llama": 1.5,
        },
        description="Relative latency scores (lower is faster)"
    )
    DEFAULT_LATENCY: float = 2.0

    CONTEXT_REQUIREMENTS: Dict[str, int] = Field(
        default={
            "tiny": 4000,
            "easy": 16000,
            "medium": 32000,
            "hard": 128000,
            "expert": 1000000,
        },
        description="Minimum context window required per difficulty"
    )

    # ---- Capabilities & Fallbacks ----
    CAPABILITY_TAGS: List[str] = Field(
        default=[
            "coding", "vision", "reasoning", "math", "search", "image",
            "tool-use", "voice", "translation", "medical", "legal",
            "long_context", "embedding"
        ]
    )

    FALLBACK_CHAIN: List[str] = Field(
        default=[
            "gpt-5.6-pro",
            "claude-opus-5",
            "gemini-2.5-pro",
            "deepseek-v3.2",
            "qwen3.7-max",
            "mistral-large-3",
            "llama-4-maverick",
            "gpt-4o-mini"
        ]
    )

    # ---- Enterprise Policies ----
    ENTERPRISE_POLICIES: EnterprisePolicies = Field(default_factory=EnterprisePolicies)

    # ---- Circuit Breaker & Health ----
    HEALTH_CHECK_INTERVAL: int = Field(
        default=int(os.getenv("HEALTH_CHECK_INTERVAL", "30")),
        description="Health check interval in seconds"
    )
    CIRCUIT_BREAKER_THRESHOLD: int = Field(
        default=int(os.getenv("CIRCUIT_BREAKER_THRESHOLD", "3")),
        description="Consecutive failures before opening circuit"
    )
    CIRCUIT_BREAKER_TIMEOUT: int = Field(
        default=int(os.getenv("CIRCUIT_BREAKER_TIMEOUT", "60")),
        description="Seconds to wait before trying again after circuit opens"
    )

    # ---- Scoring Weights ----
    BENCHMARK_WEIGHTS: Dict[str, float] = Field(
        default={
            "capability_match": 0.40,
            "task_difficulty": 0.20,
            "speed": 0.10,
            "cost": 0.10,
            "health": 0.10,
            "user_preference": 0.05,
            "historical_success": 0.05,
        }
    )

    # ---- Learning & History ----
    LEARNING_ENABLED: bool = True
    LEARNING_DATA_FILE: str = "router_learning.jsonl"
    MAX_HISTORY_REQUESTS: int = 100000

    # ---- Rate Limits ----
    RATE_LIMITS: Dict[str, int] = Field(
        default={
            "openai": 100,
            "anthropic": 80,
            "google": 120,
            "deepseek": 150,
            "mistral": 200,
            "openrouter": 500,
        }
    )

    # ---- Model Catalog ----
    MODEL_CATALOG_PATH: str = "model_catalog.json"

    # ---- Free Tier Override ----
    FREE_TIER_ONLY: bool = False

    # ---- Cost data ----
    PROVIDER_COSTS: ProviderCosts = Field(default_factory=ProviderCosts)

    # ---- Cache, Streaming, Background ----
    CACHE_TTL: int = Field(
        default=int(os.getenv("CACHE_TTL", "3600")),
        description="Cache TTL in seconds"
    )
    ROUTER_CACHE_SIZE: int = Field(
        default=int(os.getenv("ROUTER_CACHE_SIZE", "1000")),
        description="Maximum cache entries"
    )

    STREAM_ENABLED: bool = Field(
        default=os.getenv("STREAM_ENABLED", "true").lower() == "true",
        description="Enable streaming responses"
    )
    FIRST_TOKEN_TIMEOUT: int = Field(
        default=int(os.getenv("FIRST_TOKEN_TIMEOUT", "500")),
        description="Maximum milliseconds to wait for first token"
    )

    BACKGROUND_ENABLED: bool = Field(
        default=os.getenv("BACKGROUND_ENABLED", "true").lower() == "true",
        description="Enable background tasks"
    )

    # ---- Redis (optional) ----
    ENABLE_REDIS_CACHE: bool = Field(
        default=os.getenv("ENABLE_REDIS_CACHE", "false").lower() == "true",
        description="Enable Redis as distributed cache backend"
    )
    REDIS_URL: Optional[str] = Field(
        default=os.getenv("REDIS_URL"),
        description="Redis connection URL"
    )

    # ---- Debug mode ----
    DEBUG: bool = Field(
        default=os.getenv("DEBUG", "false").lower() == "true",
        description="Enable debug mode (extra endpoints, verbose logging)"
    )

    # =========================================================================
    # Helper methods
    # =========================================================================

    def get_api_key(self, provider: str) -> Optional[str]:
        """Return the API key for a given provider."""
        provider_map = {
            "openrouter": self.OPENROUTER_API_KEY,
            "openai": self.OPENAI_API_KEY,
            "anthropic": self.ANTHROPIC_API_KEY,
            "google": self.GEMINI_API_KEY,
            "deepseek": self.DEEPSEEK_API_KEY,
            "mistral": self.MISTRAL_API_KEY,
        }
        return provider_map.get(provider.lower())

    def get_cost_for_model(self, model_name: str) -> float:
        """Get cost per 1K tokens for a model, with fallback."""
        return self.PROVIDER_COSTS.model_costs.get(model_name, 0.0002)

    # ---- Pydantic v2 configuration ----
    model_config = ConfigDict(
        env_prefix="ROUTER_",          # optional prefix for environment variables
        case_sensitive=True,
        extra="ignore",
        env_file=".env",
        env_file_encoding="utf-8",
    )


# =============================================================================
# Singleton instance
# =============================================================================

settings = Settings()

# -----------------------------------------------------------------------------
# Expose commonly used constants for backward compatibility
# -----------------------------------------------------------------------------

OPENROUTER_API_KEY = settings.OPENROUTER_API_KEY
OPENROUTER_BASE_URL = settings.OPENROUTER_BASE_URL
DEFAULT_MODEL = settings.DEFAULT_MODEL
CIRCUIT_BREAKER_THRESHOLD = settings.CIRCUIT_BREAKER_THRESHOLD
CIRCUIT_BREAKER_TIMEOUT = settings.CIRCUIT_BREAKER_TIMEOUT
ROUTER_CACHE_SIZE = settings.ROUTER_CACHE_SIZE
CACHE_TTL = settings.CACHE_TTL
DEBUG = settings.DEBUG