from typing import Optional, List, Dict, Any, Union

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str
    # Ownership always comes from the authenticated session (see get_current_user
    # below) -- a client-supplied user_id/userId is never trusted for identity.
    conversation_id: Optional[str] = None
    model: Optional[str] = None
    preferred_model: Optional[str] = Field(None, alias="preferredModel")
    workspace: Optional[str] = "chat"
    attachments: Optional[List[Union[str, Dict[str, Any]]]] = None
    stream: Optional[bool] = False
    web_search: Optional[bool] = Field(False, alias="webSearch")
    reasoning: Optional[bool] = False
    model_config = {"populate_by_name": True}
