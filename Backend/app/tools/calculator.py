import logging
from typing import Any
from .base import BaseTool

logger = logging.getLogger(__name__)

class CalculatorTool(BaseTool):
    @property
    def name(self) -> str:
        return "calculator"

    @property
    def description(self) -> str:
        return "Performs basic arithmetic: add, subtract, multiply, divide. Input: 'operation=add&a=5&b=3'"

    async def execute(self, **kwargs) -> str:
        operation = kwargs.get("operation", "").lower()
        a = float(kwargs.get("a", 0))
        b = float(kwargs.get("b", 0))

        if operation == "add":
            result = a + b
        elif operation == "subtract":
            result = a - b
        elif operation == "multiply":
            result = a * b
        elif operation == "divide":
            if b == 0:
                return "Error: Division by zero."
            result = a / b
        else:
            return f"Error: Unknown operation '{operation}'. Use add, subtract, multiply, divide."

        logger.info(f"Calculator: {a} {operation} {b} = {result}")
        return str(result)