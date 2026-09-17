from typing import Optional
from pydantic import BaseModel, Field


class CreateProjectRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    system_prompt: Optional[str] = Field(None, alias="systemPrompt")
    instructions: Optional[str] = None
    model_config = {"populate_by_name": True}


class UpdateProjectRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    system_prompt: Optional[str] = Field(None, alias="systemPrompt")
    instructions: Optional[str] = None
    model_config = {"populate_by_name": True}


class AddChatRequest(BaseModel):
    conversation_id: str = Field(..., alias="conversationId")
    model_config = {"populate_by_name": True}


class AddFileRequest(BaseModel):
    item_id: str = Field(..., alias="itemId")
    model_config = {"populate_by_name": True}
