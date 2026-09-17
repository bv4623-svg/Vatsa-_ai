from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.api_key import ApiKey
from app.auth.dependencies import get_current_user
from app.services.account import generate_api_key
from app.services.feature_access import user_tier
from app.routers.account.schemas import CreateApiKeyRequest

router = APIRouter()


def _require_paid_tier(user: User) -> None:
    if user_tier(user) == "free":
        raise HTTPException(status_code=403, detail={
            "error": "feature_requires_upgrade",
            "feature": "api_keys",
            "upgrade_url": "/pricing",
        })


@router.post("/api/account/api-keys")
def create_api_key(payload: CreateApiKeyRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_paid_tier(user)
    row, plaintext = generate_api_key(db, user.id, payload.name)
    data = row.to_dict()
    data["key"] = plaintext  # only ever returned once, on creation
    return data


@router.get("/api/account/api-keys")
def list_api_keys(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    keys = db.query(ApiKey).filter(ApiKey.user_id == user.id).order_by(ApiKey.created_at.desc()).all()
    return {"items": [k.to_dict() for k in keys]}


@router.delete("/api/account/api-keys/{key_id}")
def revoke_api_key(key_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    key = db.query(ApiKey).filter(ApiKey.id == key_id, ApiKey.user_id == user.id).first()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    key.revoked = True
    db.commit()
    return {"revoked": True}
