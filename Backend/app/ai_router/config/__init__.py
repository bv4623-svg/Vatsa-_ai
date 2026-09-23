"""Router configuration: tunables from the environment, and the model registry
(built in, or replaced wholesale by a JSON file named in AI_ROUTER_CONFIG_PATH).

Environment variables (all optional):

  AI_DEFAULT_ROUTE              public route used for unknown/missing names      (auto)
  AI_FALLBACK_ENABLED           false = never try a second model                  (true)
  AI_MAX_RETRIES                retries per model before falling back             (1)
  AI_TIMEOUT_MS                 per-attempt timeout / stream gap timeout          (30000)
  AI_TOTAL_TIMEOUT_MS           deadline for one whole request, retries and
                                fallbacks included (before output starts)         (90000)
  AI_ROUTER_STRATEGY            priority | cost | latency | load | hybrid          (priority)
  AI_ROUTER_WEIGHTS             hybrid weights, e.g. cost=0.5,latency=0.2          (built-in)
  AI_BREAKER_FAILURES           consecutive failures that open a circuit          (5)
  AI_BREAKER_COOLDOWN_S         seconds a circuit stays open                      (30)
  AI_BREAKER_HALF_OPEN_CALLS    probe calls allowed while half-open               (1)
  AI_PROVIDER_HEALTH_CHECK      allow active provider health checks               (true)
  AI_MAX_INFLIGHT               concurrent AI calls per process before shedding   (256)
  AI_ROUTER_CONFIG_PATH         JSON file that replaces the built-in registry
  REASONING_MODEL / VISION_MODEL  provider model ids for those two routes

Split into env_helpers.py/router_config.py/builtin.py/json_registry.py; every
public name is re-exported here so `from app.ai_router.config import X` keeps
working exactly as it did when this was one file.
"""
from app.ai_router.config.router_config import RouterConfig
from app.ai_router.config.builtin import builtin_registry
from app.ai_router.config.json_registry import registry_from_dict, load_registry

__all__ = ["RouterConfig", "builtin_registry", "registry_from_dict", "load_registry"]
