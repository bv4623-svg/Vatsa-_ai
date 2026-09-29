"""Reviews + wall (PRD part 2): public review feed, personal and public pin
walls, votes, reports, owner replies, appeals and the moderation queue.
Read routes are included first so /api/reviews/summary and /mine are
matched before /api/reviews/{review_id}."""
from fastapi import APIRouter

from app.routers.reviews.actions import router as actions_router
from app.routers.reviews.admin import router as admin_router
from app.routers.reviews.public import router as public_router

router = APIRouter(tags=["reviews"])
router.include_router(public_router)
router.include_router(actions_router)
router.include_router(admin_router)

__all__ = ["router"]
