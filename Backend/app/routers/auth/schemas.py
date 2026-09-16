from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Dict, Any


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: Optional[str] = None
    verification_token: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class OnboardingRequest(BaseModel):
    birth_month: Optional[int] = None
    birth_year: Optional[int] = None
    role: Optional[str] = None
    experience: Optional[str] = None
    preferences: Optional[Dict[str, Any]] = None


class OtpSendRequest(BaseModel):
    email: EmailStr
    purpose: str = "signup"


class OtpVerifyRequest(BaseModel):
    email: EmailStr
    otp: str


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    reset_token: str
