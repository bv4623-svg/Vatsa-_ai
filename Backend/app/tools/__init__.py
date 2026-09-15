# app/tools/__init__.py
from .base import BaseTool
from .calculator import CalculatorTool
from .search import SearchTool

__all__ = ["BaseTool", "CalculatorTool", "SearchTool", "get_tool"]

ALL_TOOLS = [CalculatorTool(), SearchTool()]

def get_tool(name: str):
    """Return a tool instance by name."""
    for tool in ALL_TOOLS:
        if tool.name == name:
            return tool
    return None