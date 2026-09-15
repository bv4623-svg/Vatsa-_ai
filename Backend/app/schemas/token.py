# app/schemas/token.py
from pydantic import BaseModel, Field
from typing import Optional, Any, Dict
from datetime import datetime

# ─── Token Payload (JWT claims) ───
class TokenPayload(BaseModel):
    """
    JWT token payload – contains user identity and metadata.
    """
    sub: str = Field(..., description="Subject (user ID or email)")
    email: str = Field(..., description="User email")
    name: Optional[str] = Field(None, description="User full name")
    exp: Optional[int] = Field(None, description="Expiration timestamp (Unix)")
    iat: Optional[int] = Field(None, description="Issued at timestamp (Unix)")
    iss: Optional[str] = Field("vatsa-ai", description="Issuer")
    aud: Optional[str] = Field("vatsa-ai-client", description="Audience")
    scope: Optional[str] = Field("user", description="Authorization scope")
    role: Optional[str] = Field("user", description="User role (admin, user, etc.)")
    session_id: Optional[str] = Field(None, description="Session ID for tracking")


# ─── Token Response (returned to client) ───
class TokenResponse(BaseModel):
    """
    Response model for authentication – contains access and refresh tokens.
    """
    access_token: str = Field(..., description="JWT access token")
    refresh_token: Optional[str] = Field(None, description="JWT refresh token")
    token_type: str = Field("bearer", description="Token type")
    expires_in: int = Field(..., description="Expiry time in seconds")
    user: Optional[Dict[str, Any]] = Field(None, description="User info (optional)")


# ─── Token Data (internal use) ───
class TokenData(BaseModel):
    """
    Token data stored in database or cache.
    """
    user_id: str
    email: str
    name: Optional[str] = None
    token: str
    token_type: str = "access"
    created_at: datetime = Field(default_factory=datetime.now)
    expires_at: datetime
    is_revoked: bool = False


# ─── Refresh Token Request ───
class RefreshTokenRequest(BaseModel):
    """
    Request model for refreshing token.
    """
    refresh_token: str = Field(..., description="Refresh token to exchange for new access token")


# ─── Token Introspection Response ───
class TokenIntrospectResponse(BaseModel):
    """
    OAuth2 token introspection response.
    """
    active: bool = Field(..., description="Whether token is active")
    scope: Optional[str] = None
    client_id: Optional[str] = None
    username: Optional[str] = None
    token_type: Optional[str] = None
    exp: Optional[int] = None
    iat: Optional[int] = None
    nbf: Optional[int] = None
    sub: Optional[str] = None
    aud: Optional[str] = None
    iss: Optional[str] = None
    jti: Optional[str] = None


# ─── Backward compatibility ───
# For older code expecting 'Token' class
Token = TokenPayload