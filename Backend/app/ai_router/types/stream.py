"""Streaming event types. No behaviour, no I/O."""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional

from app.ai_router.types.result import RouteMeta
from app.ai_router.types.usage import Usage


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
