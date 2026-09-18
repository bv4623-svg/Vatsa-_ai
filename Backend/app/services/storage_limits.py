"""Storage ceilings per plan. Must stay in step with frontend
src/data/plans.limits.ts STORAGE_LIMIT_GB -- both sides hardcode the same
published numbers because there is no shared runtime between a Python
backend and a TypeScript frontend, the same tradeoff already made for
DAILY_LIMITS in feature_access.py."""
from app.services.feature_access import user_tier
from app.models.user import User

GIB = 1024 ** 3

STORAGE_LIMIT_GB = {
    "free": 2,
    "pro": 50,
    "business": 500,
    "ultra": 1024,
}


def storage_limit_bytes(user: User) -> int:
    tier = user_tier(user)
    gb = STORAGE_LIMIT_GB.get(tier, STORAGE_LIMIT_GB["pro"])
    return gb * GIB
