from fastapi import APIRouter, Depends, Header, HTTPException
from typing import Optional

router = APIRouter()

# ----- Dummy user validation (replace with your JWT logic) -----
def get_current_user(
    authorization: str = Header(...),
    x_user_email: Optional[str] = Header(None),
):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")
    token = authorization.split(" ")[1]
    
    # TODO: Verify JWT token and extract user info
    # For now, we trust the email header (only for development)
    if not x_user_email:
        raise HTTPException(status_code=401, detail="Missing user email")
    
    # In production, decode token and get user_id, email, etc.
    return {
        "email": x_user_email,
        "token": token,
        "id": 1,  # dummy user_id
        "name": "User"  # dummy name
    }

# ----- Profile endpoint -----
@router.get("/profile")
async def get_profile(user: dict = Depends(get_current_user)):
    """
    Get current user profile.
    In a real app, fetch from database using user['id'].
    """
    # You can fetch more details from DB here
    return {
        "email": user["email"],
        "id": user["id"],
        "name": user.get("name", "User"),
        "token": user["token"],   # optional
    }