"""What the application asks the router for. No behaviour, no I/O."""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, FrozenSet, List, Optional

from app.ai_router.types.capability import Capability


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
