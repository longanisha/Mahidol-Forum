from fastapi import FastAPI, HTTPException, Depends, status, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from supabase import create_client, Client
import config

# response helpers
from responses import success_response, error_response

app = FastAPI(
    title="Mahidol Forum API",
    description="Backend API for Mahidol Forum",
    version="1.0.0"
)

# exception handlers (registered after app is created)
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return error_response(str(exc.detail), status_code=exc.status_code)


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    return error_response(str(exc), status_code=500)

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

class TagCreate(BaseModel):
    name: str
    
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
    return success_response("Mahidol Forum API v1.0.0", status_code=200)

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
            return success_response("Discussions fetched", status_code=200, data=discussions)
    except Exception as e:
        return error_response(str(e), status_code=422)
    
    # Fallback to mock data
    return success_response("Discussions fetched (mock)", status_code=200, data=mock_discussions)

@app.post("/discussions", response_model=Discussion)
async def create_discussion(discussion: DiscussionCreate):
    try:
        # Create the discussion without tags first
        discussion_data = {
            "title": discussion.title,
            "content": discussion.content,
            "author_id": 2,  # Mock author ID
        }
        
        result = supabase.table("discussions").insert(discussion_data).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create discussion")
            
        created_discussion = result.data[0]
        discussion_id = created_discussion["id"]
        
        # Process tags - for each tag, ensure it exists and create the pivot entry
        for tag_name in discussion.tags:
            # Try to find existing tag
            tag_result = supabase.table("tags").select("id").eq("name", tag_name).execute()
            
            if tag_result.data and len(tag_result.data) > 0:
                tag_id = tag_result.data[0]["id"]
            else:
                # Create new tag if it doesn't exist
                new_tag_result = supabase.table("tags").insert({"name": tag_name}).execute()
                if not new_tag_result.data:
                    continue  # Skip if tag creation fails
                tag_id = new_tag_result.data[0]["id"]
            
            # Create pivot table entry
            supabase.table("discussion_tags").insert({
                "discussion_id": discussion_id,
                "tag_id": tag_id
            }).execute()

        # Fetch the complete discussion with author and tags
        complete_result = supabase.table("discussions").select("""
            *,
            author:users!inner (
                id,
                username,
                email,
                created_at
            ),
            tags:discussion_tags!inner (
                tags (
                    id,
                    name,
                    count
                )
            )
        """).eq("id", discussion_id).execute()
        
        if complete_result.data:
            discussion_with_tags = complete_result.data[0]
            created = Discussion(
                id=discussion_with_tags["id"],
                title=discussion_with_tags["title"],
                content=discussion_with_tags["content"],
                author=User(
                    id=discussion_with_tags["author"]["id"],
                    username=discussion_with_tags["author"]["username"],
                    email=discussion_with_tags["author"]["email"],
                    created_at=discussion_with_tags["author"]["created_at"]
                ),
                tags=[tag["name"] for tag in discussion_with_tags.get("tags", [])],
                views=discussion_with_tags.get("views", 0),
                comments=discussion_with_tags.get("comments", 0),
                upvotes=discussion_with_tags.get("upvotes", 0),
                created_at=discussion_with_tags["created_at"]
            )
            return success_response("Discussion created", status_code=201, data=created)
    except Exception as e:
        return error_response(str(e), status_code=422)

    
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
    return success_response("Discussion created (mock)", status_code=201, data=new_discussion)

from customer.routers import discussion, tag
app.include_router(discussion.router)
app.include_router(tag.router)


# Tag routes
@app.get("/tags", response_model=List[Tag])
async def get_tags():
    try:
        # Try to get from Supabase
        result = supabase.table("tags").select("*").execute()
        
        if result.data:
            tags = [Tag(
                id=tag["id"],
                name=tag["name"],
                count=tag.get("count", 0)
            ) for tag in result.data]
            return success_response("Tags fetched", status_code=200, data=tags)
    except Exception as e:
        raise
    
    # Fallback to mock data
    return success_response("Tags fetched (mock)", status_code=200, data=mock_tags)

# POST Tag for admin 
@app.post("/admin/tags", response_model=Tag)
async def create_tag(tag: TagCreate):
    try:
        # Try to create in Supabase
        tag_data = {
            "name": tag.name,
            "count": 0
        }
        
        result = supabase.table("tags").insert(tag_data).execute()
        
        if result.data:
            created_tag = result.data[0]
            created = Tag(
                id=created_tag["id"],
                name=created_tag["name"],
                count=created_tag.get("count", 0)
            )
            return success_response("Tag created", status_code=201, data=created)
    except Exception as e:
        raise


# GET Tag detail for admin
@app.get("/admin/tags/{tag_id}", response_model=Tag)
async def get_tag(tag_id: int):
    try:
        # Try to get from Supabase
        result = supabase.table("tags").select("*").eq("id", tag_id).execute()
        
        if result.data:
            tag_data = result.data[0]
            tag = Tag(
                id=tag_data["id"],
                name=tag_data["name"],
                count=tag_data.get("count", 0)
            )
            return success_response("Tag fetched", status_code=200, data=tag)
        else:
            raise HTTPException(status_code=404, detail="Tag not found")
    except Exception as e:
        raise
    
@app.delete("/admin/tags/{tag_id}", status_code=204)
async def delete_tag(tag_id: int):
    try:
        # Try to delete from Supabase
        result = supabase.table("tags").delete().eq("id", tag_id).execute()
        
        # Supabase client returns .error and .data
        if getattr(result, "error", None):
            raise HTTPException(status_code=400, detail=str(result.error))

        if getattr(result, "data", None) and len(result.data) > 0:
            return success_response("Tag deleted", status_code=200)

        raise HTTPException(status_code=404, detail="Tag not found")
    except Exception as e:
        raise

# Announcement routes
@app.get("/announcements", response_model=List[Announcement])
async def get_announcements():
    try:
        # Try to get from Supabase
        result = supabase.table("announcements").select("*").order("created_at", desc=True).execute()
        
        if result.data:
            announcements = [Announcement(
                id=announcement["id"],
                title=announcement["title"],
                content=announcement["content"],
                author=announcement["author"],
                priority=announcement.get("priority", "medium"),
                created_at=announcement["created_at"],
                is_read=announcement.get("is_read", False)
            ) for announcement in result.data]
            return success_response("Announcements fetched", status_code=200, data=announcements)
    except Exception as e:
        raise

    # Fallback to mock data
    return success_response("Announcements fetched (mock)", status_code=200, data=mock_announcements)

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
            created = Announcement(
                id=created_announcement["id"],
                title=created_announcement["title"],
                content=created_announcement["content"],
                author=created_announcement["author"],
                priority=created_announcement.get("priority", "medium"),
                created_at=created_announcement["created_at"],
                is_read=False
            )
            return success_response("Announcement created", status_code=201, data=created)
    except Exception as e:
        raise
    
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
    return success_response("Announcement created (mock)", status_code=201, data=new_announcement)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
