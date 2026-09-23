"""Read-only payment history. The ledger itself is written by
services/payment_service.py; nothing here creates, edits or deletes a row.

Responses deliberately leave out razorpay_signature and raw_payload: they are
kept in the database for audit, not handed back over the API.

Split into router.py (shared APIRouter + logger), serializers.py
(_iso/_payment_dict/_event_dict) and endpoints.py. `router` is
re-exported here so `app.routers.payment_history.router` (as used by
app/main.py) keeps working unchanged.
"""
from app.routers.payment_history.router import router, logger
from app.routers.payment_history.serializers import _iso, _payment_dict, _event_dict
from app.routers.payment_history.endpoints import my_payments, my_payment_events, admin_payments_by_email

__all__ = [
    "router", "logger", "_iso", "_payment_dict", "_event_dict",
    "my_payments", "my_payment_events", "admin_payments_by_email",
]
