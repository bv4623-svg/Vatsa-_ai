"""Async analytics logging helpers."""

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ANALYTICS_PATH = Path(__file__).resolve().parents[1] / "data" / "analytics.jsonl"


async def log_analytics(**payload: Any) -> None:
    """Append one analytics event without blocking the event loop."""
    import asyncio

    event = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        **payload,
    }
    ANALYTICS_PATH.parent.mkdir(parents=True, exist_ok=True)
    line = json.dumps(event, default=str) + "\n"
    await asyncio.to_thread(ANALYTICS_PATH.open("a", encoding="utf-8").write, line)
