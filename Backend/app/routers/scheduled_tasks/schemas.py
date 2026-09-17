from typing import Optional
from pydantic import BaseModel, Field


class CreateTaskRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    prompt: str = Field(..., min_length=1)
    schedule: str = Field(..., min_length=9)  # 5-field cron expression
    timezone: str = Field("UTC")
    model: Optional[str] = None
    notify_email: bool = Field(False, alias="notifyEmail")
    model_config = {"populate_by_name": True}


class UpdateTaskRequest(BaseModel):
    title: Optional[str] = None
    prompt: Optional[str] = None
    schedule: Optional[str] = None
    timezone: Optional[str] = None
    model: Optional[str] = None
    notify_email: Optional[bool] = Field(None, alias="notifyEmail")
    model_config = {"populate_by_name": True}
