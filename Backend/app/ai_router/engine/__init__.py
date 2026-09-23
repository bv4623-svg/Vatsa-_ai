"""The Router Engine: the one place application code calls to reach an AI
provider. It ties every other module together — registry, strategy,
fallback planning, retry, circuit breaker, admission control, health,
metrics and usage accounting — behind two methods, `generate` and `stream`.

Nothing here imports a provider SDK or builds a provider URL: that stays
inside providers/*. Nothing here is specific to chat, code or vision: those
distinctions are just capability requirements on RouteRequest.

Split into base.py (__init__, properties, shared per-attempt bookkeeping),
generate.py (the buffered call) and stream.py (the streaming call) as
mixins composed into one RouterEngine class below -- from the outside,
`from app.ai_router.engine import RouterEngine` and every method on it work
exactly as they did when this was one file.
"""
from app.ai_router.engine.base import _RouterEngineBase
from app.ai_router.engine.generate import _GenerateMixin
from app.ai_router.engine.stream import _StreamMixin


class RouterEngine(_GenerateMixin, _StreamMixin, _RouterEngineBase):
    pass


__all__ = ["RouterEngine"]
