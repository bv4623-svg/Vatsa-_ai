"""Runtime health of each model, as observed from real traffic, plus optional
active provider checks. Read by routing strategies and by the admin status view.

Split into stats.py/tracker.py; HealthTracker is re-exported here so
`from app.ai_router.health import HealthTracker` keeps working exactly as it
did when this was one file.
"""
from app.ai_router.health.tracker import HealthTracker

__all__ = ["HealthTracker"]
