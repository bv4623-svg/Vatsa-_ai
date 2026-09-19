from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import relationship

from app.database import Base


class Payment(Base):
    """One row per Razorpay order this app creates: the audit ledger.

    Subscription still drives access (expiry, tier); this table is the
    permanent record of what was ordered, paid, failed or refunded, and is
    written in the same transaction as every Subscription change.

    Rows are never deleted. Account deletion only clears user_id (see
    services/account/deletion.py), and `email` is a snapshot taken when the
    order was created so the history stays correct if the user later changes
    or loses their address.
    """

    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    email = Column(String, nullable=False, index=True)

    # NULL only between the row being written and Razorpay answering; a
    # UNIQUE column allows any number of NULLs.
    razorpay_order_id = Column(String, unique=True, index=True, nullable=True)
    razorpay_payment_id = Column(String, index=True, nullable=True)
    razorpay_signature = Column(String, nullable=True)

    amount = Column(Integer, nullable=False)  # smallest unit: cents / paise
    currency = Column(String(3), nullable=False)
    plan = Column(String, nullable=False)
    status = Column(String, nullable=False, default="created", index=True)  # created | captured | failed | refunded

    # Razorpay responses and webhook bodies, with card/UPI details and the
    # signature removed (see services/payment_ledger.redact).
    raw_payload = Column(JSON, nullable=False, default=dict)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    events = relationship("PaymentEvent", back_populates="payment", order_by="PaymentEvent.id")


class PaymentEvent(Base):
    """Append-only history: every verified webhook call and every verify
    attempt. Duplicates are kept on purpose. payment_id is NULL for a
    webhook about an order that is not in our ledger."""

    __tablename__ = "payment_events"

    id = Column(Integer, primary_key=True, index=True)
    payment_id = Column(Integer, ForeignKey("payments.id"), nullable=True, index=True)
    event_type = Column(String, nullable=False, index=True)
    razorpay_event_id = Column(String, nullable=True, index=True)  # X-Razorpay-Event-Id, when sent
    payload = Column(JSON, nullable=False, default=dict)
    received_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)

    payment = relationship("Payment", back_populates="events")
