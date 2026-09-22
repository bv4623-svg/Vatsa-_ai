from sqlalchemy.orm import Session
from typing import Tuple, List, Optional
from datetime import datetime
from app.models.user import User
from app.models.token import TokenAccount, TokenTransaction

# Used only when a caller doesn't yet pass `premium=` explicitly (see
# check_allowance below). Prefer ModelRegistry.is_route_premium() for new code.
PREMIUM_MODELS_LEGACY_MARKERS = ("claude", "gpt-4o", "sonnet", "opus", "pro")

class TokenService:
    @staticmethod
    def get_or_create_account(db: Session, user_id: int) -> TokenAccount:
        acc = db.query(TokenAccount).filter_by(user_id=user_id).first()
        if not acc:
            acc = TokenAccount(user_id=user_id, balance=50000, total_purchased=0, total_used=0)
            db.add(acc)
            db.commit()
            db.refresh(acc)
        return acc

    @staticmethod
    def get_balance(db: Session, user_id: int) -> int:
        acc = TokenService.get_or_create_account(db, user_id)
        return acc.balance

    @staticmethod
    def check_allowance(
        db: Session,
        user: User,
        estimated_tokens: int = 1000,
        model: Optional[str] = None,
        premium: Optional[bool] = None,
    ) -> Tuple[bool, str]:
        """Validates tier and token allowance before making an expensive AI request.

        `premium` should come from the router registry (ModelRegistry.is_route_premium)
        so this never has to guess from a provider model string. `model` is kept only
        as a fallback for callers that haven't been migrated to the router yet; its
        value is never echoed back in a message (see ai_router/errors.py PUBLIC_*
        constants -- no user-facing text here may name a model or provider either).
        """
        acc = TokenService.get_or_create_account(db, user.id)

        # Check balance
        if acc.balance < estimated_tokens:
            return False, f"Insufficient token balance. You have {acc.balance} tokens, but this request requires ~{estimated_tokens} tokens. Please upgrade your plan."

        # Model tier gating
        is_premium_model = premium if premium is not None else any(
            p in (model or "").lower() for p in PREMIUM_MODELS_LEGACY_MARKERS
        )
        if is_premium_model and (user.tier or "free") == "free":
            # Free users can use premium models only if they have >= 10,000 tokens
            if acc.balance < 10000:
                return False, "This is a Pro-tier request. Upgrade to Pro, or keep at least 10,000 tokens, to access it."

        return True, ""

    @staticmethod
    def deduct_tokens(
        db: Session,
        user_id: int,
        tokens: int,
        reason: str = "AI request",
        model: Optional[str] = None,
        reference_id: Optional[str] = None
    ) -> TokenTransaction:
        acc = TokenService.get_or_create_account(db, user_id)
        tokens_to_deduct = max(0, tokens)
        new_balance = max(0, acc.balance - tokens_to_deduct)

        acc.balance = new_balance
        acc.total_used += tokens_to_deduct
        acc.updated_at = datetime.utcnow()

        tx = TokenTransaction(
            user_id=user_id,
            type="usage",
            amount=-tokens_to_deduct,
            balance_after=new_balance,
            reason=reason,
            model=model,
            reference_id=reference_id
        )
        db.add(tx)
        db.commit()
        db.refresh(tx)
        return tx

    @staticmethod
    def credit_tokens(
        db: Session,
        user_id: int,
        tokens: int,
        reason: str = "Token purchase",
        reference_id: Optional[str] = None,
        tx_type: str = "purchase"
    ) -> Optional[TokenTransaction]:
        # Idempotency check: avoid double crediting same payment
        if reference_id:
            existing = db.query(TokenTransaction).filter(
                TokenTransaction.user_id == user_id,
                TokenTransaction.reference_id == reference_id,
                TokenTransaction.type == tx_type
            ).first()
            if existing:
                return existing

        acc = TokenService.get_or_create_account(db, user_id)
        tokens_to_add = max(0, tokens)
        new_balance = acc.balance + tokens_to_add

        acc.balance = new_balance
        if tx_type == "purchase":
            acc.total_purchased += tokens_to_add
        acc.updated_at = datetime.utcnow()

        tx = TokenTransaction(
            user_id=user_id,
            type=tx_type,
            amount=tokens_to_add,
            balance_after=new_balance,
            reason=reason,
            reference_id=reference_id
        )
        db.add(tx)
        db.commit()
        db.refresh(tx)
        return tx

    @staticmethod
    def get_transactions(db: Session, user_id: int, limit: int = 50) -> List[TokenTransaction]:
        return db.query(TokenTransaction).filter(
            TokenTransaction.user_id == user_id
        ).order_by(TokenTransaction.created_at.desc()).limit(limit).all()
