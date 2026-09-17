"""Account/Settings-finalization API: 2FA, API keys, connected accounts
(OAuth linking), data export, account deletion, session revocation,
in-app notifications, and real billing/invoice history. One APIRouter
combining the split submodules, mounted once from app.main the same way
app.routers.library's package is.
"""
from fastapi import APIRouter

from app.routers.account import (
    twofactor, api_keys, connections, connections_callback,
    export, deletion, sessions, notifications, billing,
)

router = APIRouter(tags=["account"])
router.include_router(twofactor.router)
router.include_router(api_keys.router)
router.include_router(connections.router)
router.include_router(connections_callback.router)
router.include_router(export.router)
router.include_router(deletion.router)
router.include_router(sessions.router)
router.include_router(notifications.router)
router.include_router(billing.router)

__all__ = ["router"]
