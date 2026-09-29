"""ai_router.example.json is documentation people copy-paste from -- if it
stops loading, AI_ROUTER_CONFIG_PATH silently breaks the router at startup
for anyone who copied it. This keeps it honest."""
import json
from pathlib import Path

from app.ai_router.config import registry_from_dict

EXAMPLE_PATH = Path(__file__).resolve().parents[2] / "ai_router.example.json"


def test_example_config_loads_and_every_route_resolves():
    with open(EXAMPLE_PATH, encoding="utf-8") as fh:
        data = json.load(fh)
    reg = registry_from_dict(data)
    assert reg.route_names()
    for name in reg.route_names():
        plan = reg.resolve(name)
        assert plan.primary in plan.candidates()
