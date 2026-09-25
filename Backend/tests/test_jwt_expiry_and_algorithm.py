"""JWTs must always carry an expiry, and decoding must never accept a
different algorithm than the one this server signs with -- in particular
never accept alg=none, which would let a client forge an unsigned "valid"
token. See app/auth/jwt.py."""
import base64
import json
from datetime import timedelta

from jose import jwt as jose_jwt

from app.auth.jwt import ALGORITHM, SECRET_KEY, create_access_token, decode_access_token


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _forge_alg_none_token(payload: dict) -> str:
    """Builds a raw alg=none JWT by hand (no signature at all) -- python-jose
    itself refuses to encode with alg=none, which is a good sign, but the
    decode side still needs its own explicit test."""
    header = _b64url(json.dumps({"alg": "none", "typ": "JWT"}).encode())
    body = _b64url(json.dumps(payload).encode())
    return f"{header}.{body}."


def test_algorithm_is_pinned_and_is_not_none():
    assert ALGORITHM
    assert ALGORITHM.lower() != "none"


def test_every_token_carries_an_expiry_claim():
    token = create_access_token({"sub": "123"})
    payload = decode_access_token(token)
    assert payload is not None
    assert "exp" in payload


def test_expired_token_is_rejected():
    token = create_access_token({"sub": "123"}, expires_delta=timedelta(seconds=-1))
    assert decode_access_token(token) is None


def test_alg_none_token_is_rejected():
    forged = _forge_alg_none_token({"sub": "123", "exp": 9999999999})
    assert decode_access_token(forged) is None


def test_token_signed_with_a_different_algorithm_is_rejected():
    # Even with the *correct* secret, a token signed with a different
    # algorithm than the server's configured ALGORITHM must be rejected --
    # otherwise an attacker who finds any accepted alg can bypass intended
    # algorithm restrictions.
    other_alg = "HS512" if ALGORITHM != "HS512" else "HS256"
    forged = jose_jwt.encode({"sub": "123", "exp": 9999999999}, key=SECRET_KEY, algorithm=other_alg)
    assert decode_access_token(forged) is None
