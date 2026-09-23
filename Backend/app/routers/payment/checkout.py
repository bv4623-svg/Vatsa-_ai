from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.subscription import Subscription
from app.auth.dependencies import get_current_user
from app.services.feature_access import user_tier
from app.services.payment_service import (
    PaymentService, PaymentNotConfigured, PaymentProviderError,
)
from app.routers.payment.schemas import CreateOrderRequest, VerifyPaymentRequest
from app.routers.payment.router import router


@router.post("/payment/create-order")
@router.post("/api/payment/create-order")
def create_order(
    req: CreateOrderRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return PaymentService.create_order(db, current_user, req.plan_id, req.currency)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PaymentNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e))
    except PaymentProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/payment/verify")
@router.post("/api/payment/verify")
def verify_payment(
    req: VerifyPaymentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = PaymentService.verify_payment(
        db=db,
        user=current_user,
        order_id=req.razorpay_order_id,
        payment_id=req.razorpay_payment_id,
        signature=req.razorpay_signature,
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message", "Payment verification failed"))
    return result


@router.get("/payment/status")
@router.get("/api/payment/status")
def payment_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = db.query(Subscription).filter_by(
        user_id=current_user.id,
        status="active",
    ).order_by(Subscription.created_at.desc()).first()

    tier = user_tier(current_user)
    return {
        "user_id": current_user.id,
        "tier": tier,
        "is_premium": tier != "free",
        "subscription": sub.to_dict() if sub else None,
    }
