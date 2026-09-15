from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Dict, Any

from app.database import get_db
from app.models.user import User
from app.auth.dependencies import get_current_user
from app.services.payment_service import PaymentService

router = APIRouter(tags=["payment"])

class CreateOrderRequest(BaseModel):
    plan_id: str = "pro_monthly"
    amount: Optional[int] = None  # ignored for security; server pricing is used

class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str

@router.get("/payment/plans")
@router.get("/api/payment/plans")
def get_plans():
    return {"plans": PaymentService.get_plans()}

@router.post("/payment/create-order")
@router.post("/api/payment/create-order")
def create_order(
    req: CreateOrderRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        order = PaymentService.create_order(db, current_user, req.plan_id)
        return order
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create order: {str(e)}")

@router.post("/payment/verify")
@router.post("/api/payment/verify")
def verify_payment(
    req: VerifyPaymentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    result = PaymentService.verify_payment(
        db=db,
        user=current_user,
        order_id=req.razorpay_order_id,
        payment_id=req.razorpay_payment_id,
        signature=req.razorpay_signature
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message", "Payment verification failed"))
    return result

@router.get("/payment/status")
@router.get("/api/payment/status")
def payment_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.models.subscription import Subscription
    sub = db.query(Subscription).filter_by(
        user_id=current_user.id,
        status="active"
    ).order_by(Subscription.created_at.desc()).first()

    return {
        "user_id": current_user.id,
        "tier": current_user.tier or "free",
        "is_premium": current_user.tier in ["pro", "paid", "premium"],
        "subscription": sub.to_dict() if sub else None
    }
