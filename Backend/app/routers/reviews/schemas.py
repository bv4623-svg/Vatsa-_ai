from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

from app.models.review import REVIEW_TAGS

ReviewSort = Literal["recent", "top", "helpful"]
VoteType = Literal["helpful", "not_helpful"]
ReportReason = Literal["spam", "offensive", "off_topic", "fake", "other"]
AdminStatus = Literal["pending", "approved", "rejected", "hidden"]
BanMode = Literal["shadow", "full"]

BODY_MIN, BODY_MAX = 20, 5000
MAX_POINTS, POINT_MAX = 5, 120


def _points(values: List[str]) -> List[str]:
    cleaned = [v.strip() for v in values if v and v.strip()]
    if len(cleaned) > MAX_POINTS:
        raise ValueError(f"At most {MAX_POINTS} items.")
    if any(len(v) > POINT_MAX for v in cleaned):
        raise ValueError(f"Each item must be {POINT_MAX} characters or fewer.")
    return list(dict.fromkeys(cleaned))


class ReviewFields(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    title: Optional[str] = Field(None, max_length=200)
    body: str
    pros: List[str] = Field(default_factory=list)
    cons: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    is_public: bool = True

    @field_validator("title")
    @classmethod
    def _title(cls, value: Optional[str]) -> Optional[str]:
        value = (value or "").strip()
        return value or None

    @field_validator("body")
    @classmethod
    def _body(cls, value: str) -> str:
        value = value.strip()
        if not BODY_MIN <= len(value) <= BODY_MAX:
            raise ValueError(f"Review must be between {BODY_MIN} and {BODY_MAX} characters.")
        return value

    @field_validator("pros", "cons")
    @classmethod
    def _pros_cons(cls, value: List[str]) -> List[str]:
        return _points(value)

    @field_validator("tags")
    @classmethod
    def _tags(cls, value: List[str]) -> List[str]:
        unknown = [t for t in value if t not in REVIEW_TAGS]
        if unknown:
            raise ValueError(f"Unknown tags: {', '.join(unknown)}. Allowed: {', '.join(REVIEW_TAGS)}.")
        return list(dict.fromkeys(value))[:5]


class ReviewCreate(ReviewFields):
    conversation_id: Optional[str] = Field(None, max_length=64)


class ReviewUpdate(ReviewFields):
    pass


class VoteRequest(BaseModel):
    vote_type: VoteType


class ReportRequest(BaseModel):
    reason: ReportReason
    details: Optional[str] = Field(None, max_length=1000)


class ReplyRequest(BaseModel):
    body: str

    @field_validator("body")
    @classmethod
    def _body(cls, value: str) -> str:
        value = value.strip()
        if not 2 <= len(value) <= 2000:
            raise ValueError("Reply must be between 2 and 2000 characters.")
        return value


class PinRequest(BaseModel):
    is_public: bool = False


class PinOrder(BaseModel):
    review_ids: List[int] = Field(..., max_length=500)


class AppealRequest(BaseModel):
    message: str

    @field_validator("message")
    @classmethod
    def _message(cls, value: str) -> str:
        value = value.strip()
        if not 10 <= len(value) <= 1000:
            raise ValueError("Appeal must be between 10 and 1000 characters.")
        return value


class AdminStatusUpdate(BaseModel):
    status: Optional[AdminStatus] = None
    note: Optional[str] = Field(None, max_length=300)
    featured: Optional[bool] = None


class BanRequest(BaseModel):
    mode: BanMode
    reason: Optional[str] = Field(None, max_length=300)
