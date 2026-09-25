"""
Authentication router package.

Split by responsibility (previously one 563-line module):
- core.py:       login / token / me / onboarding (register is retired --
                  returns 410, new accounts are Google/GitHub only)
- otp.py:        OTP send/verify + password reset, "reset" purpose only --
                  the one surviving reason to email a code, now that
                  sign-up and OTP-based login are both gone
- oauth.py:      Google / GitHub OAuth (sign-in, not linking -- see
                  app.routers.account.connections for account linking)
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
