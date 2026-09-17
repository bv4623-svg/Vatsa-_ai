from typing import Optional
from pydantic import BaseModel, Field


class CreateApiKeyRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)


class Verify2FARequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=10)


class VerifyLogin2FARequest(BaseModel):
    pending_token: str
    code: str = Field(..., min_length=4, max_length=10)


class Disable2FARequest(BaseModel):
    password: str


class DeleteAccountRequest(BaseModel):
    password: str
    confirm: bool = False
