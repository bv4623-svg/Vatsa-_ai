"""Plain data types shared by every part of the router. No behaviour, no I/O.

Split into capability.py/usage.py/request.py/result.py/stream.py by domain;
every public name is re-exported here so `from app.ai_router.types import X`
keeps working exactly as it did when this was one file.
"""
from app.ai_router.types.capability import Capability, ModelSpec
from app.ai_router.types.usage import Usage
from app.ai_router.types.request import RouteRequest
from app.ai_router.types.result import RouteMeta, GenerateResult
from app.ai_router.types.stream import EventType, StreamEvent

__all__ = [
    "Capability",
    "ModelSpec",
    "Usage",
    "RouteRequest",
    "RouteMeta",
    "GenerateResult",
    "EventType",
    "StreamEvent",
]
