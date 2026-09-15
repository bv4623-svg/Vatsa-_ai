import re
from typing import List, Dict, Optional, Tuple
import difflib

class PatchEngine:
    """Apply patches to file content (search/replace, unified diff)."""

    @staticmethod
    def apply_search_replace(content: str, search: str, replace: str) -> str:
        """Simple search and replace (exact match)."""
        if search in content:
            return content.replace(search, replace)
        return content

    @staticmethod
    def apply_json_patch(content: str, patches: List[Dict[str, str]]) -> str:
        """
        Patches format: [{"search": "old text", "replace": "new text"}]
        """
        new_content = content
        for patch in patches:
            search = patch.get("search", "")
            replace = patch.get("replace", "")
            if search and search in new_content:
                new_content = new_content.replace(search, replace)
        return new_content

    @staticmethod
    def apply_unified_diff(content: str, diff_text: str) -> str:
        """
        Apply a unified diff patch using difflib.
        This is a stub - for full support, use `unidiff` library.
        """
        # TODO: implement robust diff parsing and application.
        # For MVP, you can use the `patch` command line tool.
        return content

    @staticmethod
    def generate_diff(original: str, modified: str) -> str:
        """Generate unified diff between two strings."""
        original_lines = original.splitlines(keepends=True)
        modified_lines = modified.splitlines(keepends=True)
        diff = difflib.unified_diff(
            original_lines,
            modified_lines,
            fromfile="original",
            tofile="modified"
        )
        return "".join(diff)