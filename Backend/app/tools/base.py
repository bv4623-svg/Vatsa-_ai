# app/tools/base.py
from abc import ABC, abstractmethod

class BaseTool(ABC):
    """Base class for all tools in Vatsa AI."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique name of the tool."""
        pass

    @property
    @abstractmethod
    def description(self) -> str:
        """Description of what the tool does."""
        pass

    @abstractmethod
    async def execute(self, **kwargs) -> str:
        """Execute the tool with given parameters. Returns string result."""
        pass