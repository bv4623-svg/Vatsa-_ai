from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.auth.dependencies import get_current_user
from app.services.token_service import TokenService

router = APIRouter(prefix="/api/tokens", tags=["tokens"])

@router.get("/balance")
def get_balance(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    acc = TokenService.get_or_create_account(db, current_user.id)
    return {
        "user_id": current_user.id,
        "balance": acc.balance,
        "tier": current_user.tier or "free",
        "total_purchased": acc.total_purchased,
        "total_used": acc.total_used,
        "updated_at": acc.updated_at.isoformat() if acc.updated_at else None
    }

@router.get("/transactions")
def get_transactions(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    txs = TokenService.get_transactions(db, current_user.id, limit=min(100, max(1, limit)))
    return [t.to_dict() for t in txs]
