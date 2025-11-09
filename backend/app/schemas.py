from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


class Author(BaseModel):
  id: Optional[str] = None
  username: Optional[str] = None
  avatar_url: Optional[str] = Field(None, alias='avatar_url')


class PostCreate(BaseModel):
  title: str = Field(..., min_length=3, max_length=200)
  category: Optional[str] = Field(default=None, max_length=80)
  summary: Optional[str] = Field(default=None, max_length=500)
  tags: Optional[List[str]] = Field(default=None, max_length=10)
  
  @field_validator('title')
  @classmethod
  def validate_title(cls, v):
    if not v or not v.strip():
      raise ValueError('Title cannot be empty')
    v = v.strip()
   
    if len(v) > 200:
      raise ValueError('Title must be at most 200 characters long')
    return v
  
  @field_validator('tags', mode='before')
  @classmethod
  def validate_tags(cls, v):
    if v is None:
      return None
    if isinstance(v, list):
      # Filter out empty tags and trim
      v = [tag.strip() for tag in v if tag and tag.strip()]
      if len(v) > 10:
        raise ValueError('Cannot have more than 10 tags')
      return v if v else None
    return v


class PostResponse(BaseModel):
  id: str
  title: str
  category: Optional[str]
  summary: Optional[str]
  cover_image_url: Optional[str]
  author_id: str
  created_at: datetime
  updated_at: Optional[datetime] = None
  reply_count: int = 0
  view_count: Optional[int] = 0
  upvote_count: Optional[int] = 0
  downvote_count: Optional[int] = 0
  tags: Optional[List[str]] = None
  is_closed: Optional[bool] = False
  is_pinned: Optional[bool] = False
  pinned_at: Optional[datetime] = None  # Timestamp when post was pinned (expires after 7 days)
  author: Optional[Author] = None
  user_vote: Optional[str] = None  # 'upvote', 'downvote', or None


class PaginatedPostResponse(BaseModel):
  items: List[PostResponse]
  total: int
  page: int
  page_size: int
  total_pages: int


class PostReplyCreate(BaseModel):
  content: str = Field(..., min_length=1, max_length=4000)
  parent_reply_id: Optional[str] = None  # For nested replies


class PostReplyResponse(BaseModel):
  id: str
  content: str
  post_id: str  # 引用主帖子（原 thread_id）
  author_id: str
  created_at: datetime
  upvote_count: Optional[int] = 0
  downvote_count: Optional[int] = 0
  author: Optional[Author] = None
  parent_reply_id: Optional[str] = None  # For nested replies
  replies: Optional[List['PostReplyResponse']] = []  # Nested replies
  user_vote: Optional[str] = None  # 'upvote', 'downvote', or None


class PostDetail(PostResponse):
  replies: List[PostReplyResponse] = []


# Vote and Report schemas
class VoteRequest(BaseModel):
  vote_type: str = Field(..., pattern='^(upvote|downvote)$')


class ReportCreate(BaseModel):
  reason: str = Field(..., min_length=1, max_length=200)
  description: Optional[str] = Field(None, max_length=1000)


class ReportResponse(BaseModel):
  id: str
  post_id: Optional[str] = None  # 主帖子ID（原 thread_id）
  reply_id: Optional[str] = None  # 回复ID（原 post_id）
  reporter_id: str
  reason: str
  description: Optional[str] = None
  status: str
  reviewed_by: Optional[str] = None
  reviewed_at: Optional[datetime] = None
  created_at: datetime
  reporter: Optional[Author] = None


class LineApplicationCreate(BaseModel):
  message: str = Field(..., min_length=10, max_length=800)


class LineApplicationResponse(BaseModel):
  id: str
  user_id: str
  message: str
  status: str
  created_at: datetime


class PointRecord(BaseModel):
  id: str
  user_id: str
  points: int
  reason: str
  created_at: datetime


class ProfileUpdate(BaseModel):
  username: Optional[str] = Field(default=None, min_length=1, max_length=50)
  avatar_url: Optional[str] = Field(default=None, max_length=100000)  # 支持 base64 编码的图片（最大约 75KB）


class UserProfile(BaseModel):
  id: str
  username: Optional[str]
  email: Optional[str] = None
  avatar_url: Optional[str]
  total_points: Optional[int] = 0
  level: Optional[int] = 1
  role: Optional[str] = 'user'
  created_at: datetime


class UserCreate(BaseModel):
  username: str = Field(..., min_length=1, max_length=50)
  email: str = Field(..., min_length=1)
  password: str = Field(..., min_length=6, max_length=72)


class UserUpdate(BaseModel):
  username: Optional[str] = Field(default=None, min_length=1, max_length=50)
  email: Optional[str] = Field(default=None, min_length=1)
  password: Optional[str] = Field(default=None, min_length=6, max_length=72)
  total_points: Optional[int] = Field(default=None, ge=0)


class HotTag(BaseModel):
  tag: str
  count: int


class SimilarPost(BaseModel):
  id: str
  title: str
  reply_count: int


# LINE 群组相关 Schema
class LineGroupCreate(BaseModel):
  name: str = Field(..., min_length=3, max_length=100)
  description: Optional[str] = Field(default=None, max_length=500)
  qr_code_url: str = Field(..., min_length=1)
  is_private: Optional[bool] = Field(default=False)


class LineGroupUpdate(BaseModel):
  name: Optional[str] = Field(default=None, min_length=3, max_length=100)
  description: Optional[str] = Field(default=None, max_length=500)
  qr_code_url: Optional[str] = Field(default=None, min_length=1)
  is_active: Optional[bool] = None


class LineGroupResponse(BaseModel):
  id: str
  name: str
  description: Optional[str] = None
  qr_code_url: str
  manager_id: str
  is_active: bool
  is_private: Optional[bool] = False
  member_count: int
  created_at: datetime
  updated_at: Optional[datetime] = None
  manager: Optional[Author] = None


class LineGroupApplicationCreate(BaseModel):
  group_id: str
  message: Optional[str] = Field(default=None, max_length=500)


class LineGroupApplicationResponse(BaseModel):
  id: str
  user_id: str
  group_id: str
  message: Optional[str] = None
  status: str
  reviewed_by: Optional[str] = None
  reviewed_at: Optional[datetime] = None
  created_at: datetime
  user: Optional[Author] = None
  group: Optional[LineGroupResponse] = None


class PaginatedApplicationResponse(BaseModel):
  items: List[LineGroupApplicationResponse]
  total: int
  page: int
  page_size: int
  total_pages: int


class LineGroupApplicationReview(BaseModel):
  status: str = Field(..., min_length=1)
  
  @field_validator('status')
  @classmethod
  def validate_status(cls, v):
    if v not in ('approved', 'rejected'):
      raise ValueError('Status must be either "approved" or "rejected"')
    return v


class LineGroupReportCreate(BaseModel):
  group_id: str
  reason: str = Field(..., min_length=10, max_length=200)
  description: Optional[str] = Field(default=None, max_length=1000)


class LineGroupReportResponse(BaseModel):
  id: str
  group_id: str
  reporter_id: str
  reason: str
  description: Optional[str] = None
  status: str
  reviewed_by: Optional[str] = None
  reviewed_at: Optional[datetime] = None
  created_at: datetime
  reporter: Optional[Author] = None
  group: Optional[LineGroupResponse] = None


class LineGroupCreationRequestCreate(BaseModel):
  name: str = Field(..., min_length=3, max_length=100)
  description: Optional[str] = Field(default=None, max_length=500)
  qr_code_url: str = Field(..., min_length=1)
  is_private: Optional[bool] = Field(default=False)


class LineGroupCreationRequestResponse(BaseModel):
  id: str
  requester_id: str
  name: str
  description: Optional[str] = None
  qr_code_url: str
  is_private: Optional[bool] = False
  status: str
  reviewed_by: Optional[str] = None
  reviewed_at: Optional[datetime] = None
  rejection_reason: Optional[str] = None
  created_at: datetime
  updated_at: Optional[datetime] = None
  requester: Optional[Author] = None


class LineGroupCreationRequestReview(BaseModel):
  status: str = Field(..., min_length=1)
  rejection_reason: Optional[str] = Field(default=None, max_length=500)
  
  @field_validator('status')
  @classmethod
  def validate_status(cls, v):
    if v not in ('approved', 'rejected'):
      raise ValueError('Status must be either "approved" or "rejected"')
    return v


# Announcements 相关 Schema
class AnnouncementCreate(BaseModel):
  title: str = Field(..., min_length=1, max_length=200)
  content: str = Field(..., min_length=1, max_length=2000)
  priority: Optional[int] = Field(default=0, ge=0, le=10)
  is_active: Optional[bool] = Field(default=True)


class AnnouncementUpdate(BaseModel):
  title: Optional[str] = Field(default=None, min_length=1, max_length=200)
  content: Optional[str] = Field(default=None, min_length=1, max_length=2000)
  priority: Optional[int] = Field(default=None, ge=0, le=10)
  is_active: Optional[bool] = None


class AnnouncementResponse(BaseModel):
  id: str
  title: str
  content: str
  created_by: str
  is_active: bool
  priority: int
  created_at: datetime
  updated_at: Optional[datetime] = None
  author: Optional[Author] = None


