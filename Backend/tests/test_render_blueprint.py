"""render.yaml (repo root) asks for every variable Google sign-in needs."""
import re
from pathlib import Path

RENDER_YAML = Path(__file__).resolve().parents[2] / "render.yaml"


def test_render_blueprint_declares_google_oauth_variables():
    keys = set(re.findall(r"^\s*- key: (\w+)", RENDER_YAML.read_text(encoding="utf-8"), re.M))
    assert {"GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI", "GOOGLE_LINK_REDIRECT_URI"} <= keys
