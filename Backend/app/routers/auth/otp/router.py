import os

from fastapi import APIRouter

router = APIRouter(tags=["authentication"])

# Minimum gap between two OTP sends to the same email+purpose, so mashing
# "Resend code" can't spray outbound emails or churn through the 5-per-10-min
# cap in a few seconds. Backed by the same (Redis-ready) limiter as every
# other auth rate limit -- see app/utils/rate_limit.py.
RESEND_COOLDOWN_SECONDS = 45

# Off by default everywhere, including production, so an OTP code never lands
# in server logs. Set DEBUG_LOG_OTP=true only in local development, when SMTP
# isn't configured yet and there's no other way to read the code that was
# generated -- see the missing-env-var 503 below.
_DEBUG_LOG_OTP = (os.getenv("DEBUG_LOG_OTP") or "").strip().lower() in {"1", "true", "yes"}
