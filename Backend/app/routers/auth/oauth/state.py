"""Anti-CSRF state for the OAuth *login* flows (google/github/microsoft).

There is no pre-auth session to tie a server-side state store to, so this
uses the standard double-submit pattern instead: a random nonce goes both
into the redirect URL's `state` param AND into a short-lived HttpOnly
cookie scoped to this provider. The callback only proceeds if the `state`
it receives back matches the cookie set by the SAME browser that started
the flow -- an attacker who crafts their own authorization response
(classic login-CSRF) has no way to also plant that cookie.
"""
import hmac
import secrets

from fastapi import Request, Response

_COOKIE_MAX_AGE = 600  # matches the ~10 minute lifetime a user takes to log in


def oauth_state_cookie_name(provider: str) -> str:
    return f"oauth_state_{provider}"


def generate_oauth_state() -> str:
    return secrets.token_urlsafe(32)


def set_oauth_state_cookie(request: Request, response: Response, provider: str, state: str) -> None:
    response.set_cookie(
        oauth_state_cookie_name(provider),
        state,
        max_age=_COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=request.url.scheme == "https",
    )


def verify_oauth_state(request: Request, state: str, provider: str) -> bool:
    expected = request.cookies.get(oauth_state_cookie_name(provider))
    return bool(expected) and hmac.compare_digest(expected, state or "")
