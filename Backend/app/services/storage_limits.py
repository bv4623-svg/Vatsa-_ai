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
    # Pre-existing gap, not introduced here: buying "business" grants
    # user.tier = "pro" (see payment_service.py PLAN_META), so a business
    # customer's real ceiling today is Pro's 50GB, not the 500GB advertised
    # on /pricing. user_tier() only ever returns free/pro/ultra; this
    # mirrors that truthfully rather than pretending a "business" tier
    # value exists on the row.
    tier = user_tier(user)
    gb = STORAGE_LIMIT_GB.get(tier, STORAGE_LIMIT_GB["pro"])
    return gb * GIB
