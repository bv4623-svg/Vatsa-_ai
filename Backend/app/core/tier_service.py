from datetime import datetime
from fastapi import HTTPException
from sqlalchemy import func
from app.config.tiers import TIERS
from app.models.usage import UsageLog


def get_user_tier(user):
    if user.tier and user.tier != "free" and user.tier_expires_at:
        if user.tier_expires_at < datetime.utcnow():
            return "free"
    return user.tier or "free"


def check_model_access(user, model: str):
    tier = get_user_tier(user)
    allowed = TIERS[tier]["models"]
    if "*" not in allowed and model not in allowed:
        raise HTTPException(
            status_code=403,
            detail=f"Model '{model}' tere {tier} tier mein nahi hai. Upgrade karo.",
        )


def check_token_limit(db, user, requested: int):
    tier = get_user_tier(user)
    lim = TIERS[tier]

    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    used = (
        db.query(func.sum(UsageLog.total_tokens))
        .filter(UsageLog.user_id == user.id, UsageLog.created_at >= today)
        .scalar()
        or 0
    )

    if used + requested > lim["daily_tokens"]:
        raise HTTPException(
            status_code=429,
            detail=f"Daily limit ({lim['daily_tokens']} tokens) khatam. Upgrade karo.",
        )

    if requested > lim["max_tokens_per_request"]:
        raise HTTPException(
            status_code=400,
            detail=f"Max {lim['max_tokens_per_request']} tokens allowed per request.",
        )


def log_usage(db, user_id, model, prompt, completion):
    db.add(
        UsageLog(
            user_id=user_id,
            model=model,
            prompt_tokens=prompt,
            completion_tokens=completion,
            total_tokens=prompt + completion,
        )
    )
    db.commit()
