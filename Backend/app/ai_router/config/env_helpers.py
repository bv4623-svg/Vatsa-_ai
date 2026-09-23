"""Small env-var parsing helpers shared by RouterConfig.from_env(): never
raise on a bad value, log a warning and fall back to the given default."""
from __future__ import annotations

import logging
from typing import Mapping

logger = logging.getLogger("AIRouter.config")

_TRUE = {"1", "true", "yes", "on"}
_FALSE = {"0", "false", "no", "off"}


def _bool(env: Mapping[str, str], name: str, default: bool) -> bool:
    raw = (env.get(name) or "").strip().lower()
    if raw in _TRUE:
        return True
    if raw in _FALSE:
        return False
    if raw:
        logger.warning("Ignoring %s=%r (expected true/false); using %s", name, raw, default)
    return default


def _number(env: Mapping[str, str], name: str, default: float, minimum: float, cast=float):
    raw = (env.get(name) or "").strip()
    if not raw:
        return default
    try:
        value = cast(raw)
    except ValueError:
        logger.warning("Ignoring %s=%r (not a number); using %s", name, raw, default)
        return default
    if value < minimum:
        logger.warning("Ignoring %s=%r (below %s); using %s", name, raw, minimum, default)
        return default
    return value
