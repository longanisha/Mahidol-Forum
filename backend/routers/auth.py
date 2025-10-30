from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional
import os
from dotenv import load_dotenv

from models import User, UserCreate, UserLogin
from database import get_supabase_client

load_dotenv()

router = APIRouter(prefix="/auth", tags=["authentication"])

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT settings
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-here")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

security = HTTPBearer()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify JWT token and return user"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    # Get user from database
    supabase = get_supabase_client()
    result = supabase.table("users").select("*").eq("id", user_id).execute()
    
    if not result.data:
        raise credentials_exception
    
    user_data = result.data[0]
    return User(
        id=user_data["id"],
        username=user_data["username"],
        email=user_data["email"],
        created_at=user_data["created_at"],
        is_active=user_data["is_active"]
    )

@router.post("/register", response_model=User)
async def register(user: UserCreate):
    """Register a new user"""
    supabase = get_supabase_client()
    
    # Check if email already exists
    existing_user = supabase.table("users").select("email").eq("email", user.email).execute()
    if existing_user.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered!"
        )
    
    # Check if username already exists
    existing_username = supabase.table("users").select("username").eq("username", user.username).execute()
    if existing_username.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken!"
        )
    
    # Hash password
    hashed_password = get_password_hash(user.password)
    
    # Create user
    user_data = {
        "username": user.username,
        "email": user.email,
        "password_hash": hashed_password
    }
    
    result = supabase.table("users").insert(user_data).execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user"
        )
    
    created_user = result.data[0]
    return User(
        id=created_user["id"],
        username=created_user["username"],
        email=created_user["email"],
        created_at=created_user["created_at"],
        is_active=created_user["is_active"]
    )

@router.post("/login")
async def login(credentials: UserLogin):
    """Login user and return access token"""
    supabase = get_supabase_client()
    
    # Get user by email
    result = supabase.table("users").select("*").eq("email", credentials.email).execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    user_data = result.data[0]
    
    # Verify password
    if not verify_password(credentials.password, user_data["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    # Check if user is active
    if not user_data["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is deactivated"
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user_data["id"])}, expires_delta=access_token_expires
    )
    
    user = User(
        id=user_data["id"],
        username=user_data["username"],
        email=user_data["email"],
        created_at=user_data["created_at"],
        is_active=user_data["is_active"]
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@router.get("/me", response_model=User)
async def get_current_user(current_user: User = Depends(verify_token)):
    """Get current user information"""
    return current_user
