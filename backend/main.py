from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from supabase import create_client, Client
import config

app = FastAPI(
    title="Mahidol Forum API",
    description="Backend API for Mahidol Forum",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Supabase client
supabase: Client = create_client(config.SUPABASE_URL, config.SUPABASE_ANON_KEY)

# Pydantic models
class UserCreate(BaseModel):
    username: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class User(BaseModel):
    id: int
    username: str
    email: str
    created_at: str

class DiscussionCreate(BaseModel):
    title: str
    content: str
    tags: List[str]

class Discussion(BaseModel):
    id: int
    title: str
    content: str
    author: User
    tags: List[str]
    views: int
    comments: int
    upvotes: int
    created_at: str

class Tag(BaseModel):
    id: int
    name: str
    count: int

class AnnouncementCreate(BaseModel):
    title: str
    content: str
    priority: str = "medium"

class Announcement(BaseModel):
    id: int
    title: str
    content: str
    author: str
    priority: str
    created_at: str
    is_read: bool = False

# Mock data (fallback if Supabase is not available)
mock_users = [
    User(id=1, username="Karmen", email="karmen@student.mahidol.ac.th", created_at="2024-01-15T10:30:00Z"),
    User(id=2, username="Shiraj", email="shiraj@student.mahidol.ac.th", created_at="2024-01-15T10:25:00Z"),
    User(id=3, username="Dew", email="dew@student.mahidol.ac.th", created_at="2024-01-13T14:20:00Z"),
]

mock_discussions = [
    Discussion(
        id=1,
        title="How to apply to Mahidol graduate programs?",
        content="I'm looking for information to apply graduate programs this year.......",
        author=mock_users[0],
        tags=["ICT", "Courses", "Application"],
        views=125,
        comments=15,
        upvotes=155,
        created_at="2024-01-15T10:30:00Z"
    ),
    Discussion(
        id=2,
        title="Does Mahidol provide dorm for international students?",
        content="I'm first year ICT student and currently looking a place to live near campus....",
        author=mock_users[1],
        tags=["ICT", "Campus", "Dorm"],
        views=125,
        comments=15,
        upvotes=155,
        created_at="2024-01-15T10:25:00Z"
    ),
    Discussion(
        id=3,
        title="Any Thai language classes in Mahidol?",
        content="I would like to learn basic Thai, like how to speak in Thai..........",
        author=mock_users[2],
        tags=["svelte", "javascript", "recomendations"],
        views=125,
        comments=15,
        upvotes=155,
        created_at="2024-01-13T14:20:00Z"
    ),
]

mock_tags = [
    Tag(id=1, name="AI", count=45),
    Tag(id=2, name="ICT", count=32),
    Tag(id=3, name="Courses", count=28),
    Tag(id=4, name="Sports", count=15),
    Tag(id=5, name="Events", count=22),
    Tag(id=6, name="English", count=18),
    Tag(id=7, name="Thai", count=12),
    Tag(id=8, name="Language", count=25),
    Tag(id=9, name="Discuss", count=38),
    Tag(id=10, name="Digital Nomad", count=8),
    Tag(id=11, name="Upwork", count=5),
    Tag(id=12, name="Campus", count=20),
    Tag(id=13, name="Dorm", count=14),
    Tag(id=14, name="Application", count=16),
    Tag(id=15, name="Graduate", count=19),
]

mock_announcements = [
    Announcement(
        id=1,
        title="New Forum Features Released",
        content="We are excited to announce several new features including improved search functionality, better mobile experience, and enhanced notification system.",
        author="Admin Team",
        priority="high",
        created_at="2024-01-15T00:00:00Z",
        is_read=False
    ),
    Announcement(
        id=2,
        title="Maintenance Schedule - January 2024",
        content="The forum will undergo scheduled maintenance on January 20th, 2024 from 2:00 AM to 4:00 AM (UTC+7). During this time, the forum will be temporarily unavailable.",
        author="Technical Team",
        priority="medium",
        created_at="2024-01-10T00:00:00Z",
        is_read=True
    ),
    Announcement(
        id=3,
        title="Welcome to Mahidol Forum",
        content="Welcome to the official Mahidol University forum! This is your space to connect with fellow students, share knowledge, and discuss various topics related to university life.",
        author="Admin Team",
        priority="low",
        created_at="2024-01-01T00:00:00Z",
        is_read=True
    ),
    Announcement(
        id=4,
        title="Community Guidelines Update",
        content="Please review our updated community guidelines. We encourage respectful discussions and constructive feedback. Let's work together to maintain a positive environment for everyone.",
        author="Moderation Team",
        priority="medium",
        created_at="2023-12-28T00:00:00Z",
        is_read=False
    ),
]

# Routes
@app.get("/")
async def root():
    return {"message": "Mahidol Forum API", "version": "1.0.0"}

# Authentication routes
@app.post("/auth/register")
async def register(user: UserCreate):
    try:
        # Check if email already exists
        existing_user = supabase.table("users").select("email").eq("email", user.email).execute()
        if existing_user.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered!"
            )
        
        # Create user in Supabase
        user_data = {
            "username": user.username,
            "email": user.email,
            "password": user.password  # In production, hash this
        }
        
        result = supabase.table("users").insert(user_data).execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create user"
            )
        
        created_user = result.data[0]
        return {"message": "User registered successfully", "user": created_user}
    
    except Exception as e:
        # Fallback to mock data if Supabase fails
        if any(u.email == user.email for u in mock_users):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered!"
            )
        
        new_user = User(
            id=len(mock_users) + 1,
            username=user.username,
            email=user.email,
            created_at=datetime.now().isoformat()
        )
        mock_users.append(new_user)
        
        return {"message": "User registered successfully (mock mode)", "user": new_user}

@app.post("/auth/login")
async def login(credentials: UserLogin):
    try:
        # Try to authenticate with Supabase
        result = supabase.table("users").select("*").eq("email", credentials.email).execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        user_data = result.data[0]
        # In production, verify password hash
        if user_data.get("password") != credentials.password:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        user = User(
            id=user_data["id"],
            username=user_data["username"],
            email=user_data["email"],
            created_at=user_data["created_at"]
        )
        
        return {"message": "Login successful", "user": user, "token": "jwt_token_placeholder"}
    
    except Exception as e:
        # Fallback to mock data
        user = next((u for u in mock_users if u.email == credentials.email), None)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        return {"message": "Login successful (mock mode)", "user": user, "token": "mock_jwt_token"}

# Discussion routes
@app.get("/discussions", response_model=List[Discussion])
async def get_discussions():
    try:
        # Try to get from Supabase
        result = supabase.table("discussions").select("""
            *,
            author:users(id, username, email, created_at)
        """).execute()
        
        if result.data:
            discussions = []
            for discussion in result.data:
                discussions.append(Discussion(
                    id=discussion["id"],
                    title=discussion["title"],
                    content=discussion["content"],
                    author=User(
                        id=discussion["author"]["id"],
                        username=discussion["author"]["username"],
                        email=discussion["author"]["email"],
                        created_at=discussion["author"]["created_at"]
                    ),
                    tags=discussion.get("tags", []),
                    views=discussion.get("views", 0),
                    comments=discussion.get("comments", 0),
                    upvotes=discussion.get("upvotes", 0),
                    created_at=discussion["created_at"]
                ))
            return discussions
    except Exception as e:
        pass
    
    # Fallback to mock data
    return mock_discussions

@app.post("/discussions", response_model=Discussion)
async def create_discussion(discussion: DiscussionCreate):
    try:
        # Try to create in Supabase
        discussion_data = {
            "title": discussion.title,
            "content": discussion.content,
            "author_id": 1,  # Mock author ID
            "tags": discussion.tags
        }
        
        result = supabase.table("discussions").insert(discussion_data).execute()
        
        if result.data:
            created_discussion = result.data[0]
            return Discussion(
                id=created_discussion["id"],
                title=created_discussion["title"],
                content=created_discussion["content"],
                author=mock_users[0],
                tags=created_discussion.get("tags", []),
                views=0,
                comments=0,
                upvotes=0,
                created_at=created_discussion["created_at"]
            )
    except Exception as e:
        pass
    
    # Fallback to mock data
    new_discussion = Discussion(
        id=len(mock_discussions) + 1,
        title=discussion.title,
        content=discussion.content,
        author=mock_users[0],
        tags=discussion.tags,
        views=0,
        comments=0,
        upvotes=0,
        created_at=datetime.now().isoformat()
    )
    mock_discussions.append(new_discussion)
    return new_discussion

# Tag routes
@app.get("/tags", response_model=List[Tag])
async def get_tags():
    try:
        # Try to get from Supabase
        result = supabase.table("tags").select("*").execute()
        
        if result.data:
            return [Tag(
                id=tag["id"],
                name=tag["name"],
                count=tag.get("count", 0)
            ) for tag in result.data]
    except Exception as e:
        pass
    
    # Fallback to mock data
    return mock_tags

# Announcement routes
@app.get("/announcements", response_model=List[Announcement])
async def get_announcements():
    try:
        # Try to get from Supabase
        result = supabase.table("announcements").select("*").order("created_at", desc=True).execute()
        
        if result.data:
            return [Announcement(
                id=announcement["id"],
                title=announcement["title"],
                content=announcement["content"],
                author=announcement["author"],
                priority=announcement.get("priority", "medium"),
                created_at=announcement["created_at"],
                is_read=announcement.get("is_read", False)
            ) for announcement in result.data]
    except Exception as e:
        pass
    
    # Fallback to mock data
    return mock_announcements

@app.post("/announcements", response_model=Announcement)
async def create_announcement(announcement: AnnouncementCreate):
    try:
        # Try to create in Supabase
        announcement_data = {
            "title": announcement.title,
            "content": announcement.content,
            "author": "Current User",
            "priority": announcement.priority
        }
        
        result = supabase.table("announcements").insert(announcement_data).execute()
        
        if result.data:
            created_announcement = result.data[0]
            return Announcement(
                id=created_announcement["id"],
                title=created_announcement["title"],
                content=created_announcement["content"],
                author=created_announcement["author"],
                priority=created_announcement["priority"],
                created_at=created_announcement["created_at"],
                is_read=False
            )
    except Exception as e:
        pass
    
    # Fallback to mock data
    new_announcement = Announcement(
        id=len(mock_announcements) + 1,
        title=announcement.title,
        content=announcement.content,
        author="Current User",
        priority=announcement.priority,
        created_at=datetime.now().isoformat(),
        is_read=False
    )
    mock_announcements.append(new_announcement)
    return new_announcement

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
