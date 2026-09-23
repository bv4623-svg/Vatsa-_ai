from typing import Optional, List, Dict, Any, Tuple

from sqlalchemy.orm import Session

from app.models.user import User
from app.services.search_service import SearchService
from app.services.feature_access import check_daily_limit, increment_usage
from app.routers.chat.schemas import ChatRequest
from app.routers.chat.router import logger


async def _get_search_context(req: ChatRequest, user: User, db: Session) -> Tuple[Optional[str], List[Dict[str, Any]]]:
    """
    Best-effort multi-source web search grounding. Never raises -- if no
    provider is configured/reachable, or the user's daily search quota
    is used up, the chat just proceeds without it rather than breaking
    the whole response over an optional feature.
    Returns (formatted_context_for_the_prompt, raw_results_for_the_client).
    """
    if not req.web_search:
        return None, []
    allowed, used, limit = check_daily_limit(db, user, "web_search")
    if not allowed:
        logger.info(f"Web search daily limit reached for user {user.id} ({used}/{limit})")
        return None, []
    try:
        results = await SearchService.search(req.message)
        increment_usage(db, user, "web_search")
        return SearchService.format_context(results, req.message), results
    except Exception as e:
        logger.warning(f"Web search unavailable for user {user.id}: {e}")
        return None, []
