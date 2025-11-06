from pydantic import BaseModel
from typing import List, Optional
from .user import User

class DiscussionCreate(BaseModel):
    title: str
    content: str
    tags: List[str]

class Discussion(BaseModel):
    id: int
    title: str
    content: str
    author: Optional[User]
    tags: List[str]
    views: int
    comments: int
    upvotes: int
    created_at: str
    
    model_config = {
        "arbitrary_types_allowed": True,
        "from_attributes": True
    }