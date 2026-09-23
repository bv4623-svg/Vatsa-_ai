import logging

from fastapi import APIRouter

logger = logging.getLogger("ChatRouter")
router = APIRouter(prefix="/api", tags=["chat"])

# Short-window burst guard, independent of the per-day chat_messages/
# code_messages caps in feature_access.py -- those alone don't stop a script
# from burning through a whole day's allowance in a few seconds. Redis-backed
# when REDIS_URL is set (see app/utils/rate_limit.py), so it holds across
# every API instance, not just the one that happens to receive the burst.
CHAT_BURST_LIMIT = 30
CHAT_BURST_WINDOW_SECONDS = 60
