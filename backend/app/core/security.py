from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Union
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import jwt
from jwt.exceptions import InvalidTokenError
from pydantic import BaseModel

from app.core.config import settings

# OAuth2 password bearer scheme for token extraction
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login", 
    auto_error=False
)

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None
    org_id: Optional[str] = None


def create_access_token(subject: Union[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    Generates a JWT access token for a given user subject.
    """
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Decodes a JWT access token and extracts the claims.
    """
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.ALGORITHM])
        return payload
    except InvalidTokenError:
        return None


async def get_current_user(token: Optional[str] = Depends(oauth2_scheme)) -> Optional[Dict[str, Any]]:
    """
    FastAPI dependency to extract and return the current authenticated user details.
    Currently returns None / mocked response during initial database scaffolding.
    """
    if not token:
        # Development bypass: returns None instead of raising HTTP 401 when no token is present
        return None
        
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Map payload properties to temporary user representation
    return {
        "id": payload.get("sub"),
        "role": payload.get("role", "user"),
        "org_id": payload.get("org_id")
    }

