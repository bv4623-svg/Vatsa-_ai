"""
Authentication router package.

Split by responsibility (previously one 563-line module):
- core.py:       register / login / token / me / onboarding
- otp.py:        OTP send/resend/verify, password reset, username/email checks
- oauth.py:      Google / GitHub / Microsoft OAuth (sign-in, not linking --
                  see app.routers.account.connections for account linking)
- twofactor.py:  the login-flow completion step for 2FA-enabled accounts
                  (2FA setup/enable/disable itself lives under
                  app.routers.account.twofactor, since that's account
                  management, not session creation)

`router` below is what app/main.py includes -- combining the four keeps
that one import (`from app.routers import auth as auth_router`) working
unchanged.
"""
from fastapi import APIRouter

from app.routers.auth import core, otp, oauth, twofactor

router = APIRouter()
router.include_router(core.router)
router.include_router(otp.router)
router.include_router(oauth.router)
router.include_router(twofactor.router)

__all__ = ["router"]
