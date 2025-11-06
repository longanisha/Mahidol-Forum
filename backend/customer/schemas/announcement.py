from pydantic import BaseModel

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