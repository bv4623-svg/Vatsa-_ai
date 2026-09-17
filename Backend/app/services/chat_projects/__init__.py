"""ChatProject service layer: public-dict derivation (chatIds/fileIds are
computed from real Conversation/LibraryItem rows, never stored
redundantly), chat/file membership, and the project-instructions lookup
chat.py's system-prompt injection uses. Import from here rather than the
submodules directly, matching the barrel pattern used elsewhere in this
codebase (see app.services.library).
"""
from app.services.chat_projects.dicts import to_public_dict
from app.services.chat_projects.membership import add_chat, remove_chat, add_file, remove_file, detach_all
from app.services.chat_projects.context import get_project_instructions_for_conversation

__all__ = [
    "to_public_dict",
    "add_chat",
    "remove_chat",
    "add_file",
    "remove_file",
    "detach_all",
    "get_project_instructions_for_conversation",
]
