import hashlib
from datetime import timedelta
from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.config import settings
from app.core.dependencies import get_db, get_current_user
from app.core.security import create_access_token
from app.models.user import User

router = APIRouter()

class LoginRequest(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: Dict[str, Any] if "Dict" in globals() else Any

@router.post("/login", response_model=Token)
def login(login_data: LoginRequest, db: Session = Depends(get_db)) -> Any:
    """
    User login to generate JWT authentication token.
    """
    user = db.query(User).filter(User.email == login_data.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    
    hashed_pwd = hashlib.sha256(login_data.password.encode()).hexdigest()
    if hashed_pwd != user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    token = create_access_token(
        subject=user.id, expires_delta=access_token_expires
    )
    
    # We decode to encode role and org_id into payload
    import jwt
    payload = {
        "exp": jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.ALGORITHM])["exp"],
        "sub": str(user.id),
        "role": user.role,
        "org_id": str(user.organization_id)
    }
    encoded_token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.ALGORITHM)

    return {
        "access_token": encoded_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "role": user.role,
            "org_id": user.organization_id
        }
    }

@router.get("/me")
def get_me(current_user: Any = Depends(get_current_user)) -> Any:
    """
    Get current authenticated user info.
    """
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return current_user
