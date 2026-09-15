"""
Simple in-memory cache – no circular imports.
"""
import time
import hashlib
import json
from typing import Any, Optional

class RouterCache:
    def __init__(self, maxsize: int = 1000, ttl: int = 3600):
        self.cache = {}
        self.maxsize = maxsize
        self.ttl = ttl

    def _key(self, prompt: str, context: Optional[str] = None) -> str:
        data = {"prompt": prompt, "context": context}
        return hashlib.md5(json.dumps(data, sort_keys=True).encode()).hexdigest()

    def get(self, key: str, default=None) -> Any:
        entry = self.cache.get(key)
        if entry and (time.time() - entry["timestamp"] < self.ttl):
            return entry["value"]
        elif entry:
            del self.cache[key]
        return default

    def set(self, key: str, value: Any) -> None:
        if len(self.cache) >= self.maxsize:
            oldest = min(self.cache.items(), key=lambda x: x[1]["timestamp"])
            del self.cache[oldest[0]]
        self.cache[key] = {"value": value, "timestamp": time.time()}

    def clear(self) -> None:
        self.cache.clear()

# Global instance
router_cache = RouterCache()