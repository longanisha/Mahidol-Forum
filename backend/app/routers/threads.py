from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Request, status

from ..auth import AuthenticatedUser, get_current_user, get_optional_user
from ..dependencies import SupabaseClientDep
from ..schemas import (
  Author,
  HotTag,
  PaginatedPostResponse,
  PostCreate,
  PostDetail,
  PostReplyCreate,
  PostReplyResponse,
  PostResponse,
  ReportCreate,
  ReportResponse,
  SimilarPost,
  VoteRequest,
)
from ..utils.points import award_points, deduct_points

router = APIRouter(prefix='/posts', tags=['posts'])


def _serialize_author(record: Dict[str, Any]) -> Dict[str, Any]:
  author = record.get('profiles') or record.get('author') or {}
  if isinstance(author, dict):
    return {
      'id': author.get('id'),
      'username': author.get('username'),
      'avatar_url': author.get('avatar_url'),  # May be None if column doesn't exist
    }
  return {}


def _serialize_reply(reply: Dict[str, Any], user_id: Optional[str] = None) -> Dict[str, Any]:
  result = {
    'id': reply['id'],
    'content': reply['content'],
    'post_id': reply['post_id'],  # 原 thread_id
    'author_id': reply['author_id'],
    'created_at': reply['created_at'],
    'upvote_count': reply.get('upvote_count', 0),
    'downvote_count': reply.get('downvote_count', 0),
    'author': _serialize_author(reply),
    'parent_reply_id': reply.get('parent_reply_id'),  # 原 parent_post_id
    'replies': [],
    'user_vote': reply.get('user_vote'),
  }
  return result


@router.get('/', response_model=PaginatedPostResponse)
async def list_posts(
  supabase: SupabaseClientDep,
  page: int = 1,
  page_size: int = 10,
  sort_by: str = 'latest',  # 'latest', 'views', 'replies'
):
  try:
    # 验证分页参数
    if page < 1:
      page = 1
    # 允许更大的page_size以支持前端搜索和过滤（最多10000条）
    if page_size < 1:
      page_size = 10
    elif page_size > 10000:
      page_size = 10000
    
    # 验证排序参数
    if sort_by not in ['latest', 'views', 'replies']:
      sort_by = 'latest'
    
    offset = (page - 1) * page_size
    
    # 首先获取总数
    count_response = (
      supabase.table('posts')
      .select('id', count='exact')
      .execute()
    )
    total = 0
    if hasattr(count_response, 'count') and count_response.count is not None:
      total = count_response.count
    else:
      # 如果没有 count，尝试从 data 长度获取（作为后备）
      total = len(count_response.data) if count_response.data else 0
    
    # 根据排序方式构建查询
    # 对于按评论数排序，需要先获取所有数据再排序（因为 reply_count 是计算出来的）
    if sort_by == 'replies':
      # 按评论数排序：需要先获取所有数据，计算 reply_count，然后排序
      # 为了性能，先获取更多数据（比如前 100 条），排序后再分页
      fetch_limit = min(100, total) if total > 0 else 100
      response = (
        supabase.table('posts')
        .select(
          'id, title, category, summary, cover_image_url, author_id, created_at, updated_at, '
          'tags, view_count, upvote_count, downvote_count, is_closed, is_pinned, pinned_at, '
          'profiles(id, username, avatar_url)',
        )
        .order('is_pinned', desc=True)  # 置顶的在前
        .order('created_at', desc=True)  # 先按时间排序获取数据
        .limit(fetch_limit)
        .execute()
      )
    else:
      # 按最新或浏览数排序：可以直接在数据库层面排序
      query = (
        supabase.table('posts')
        .select(
          'id, title, category, summary, cover_image_url, author_id, created_at, updated_at, '
          'tags, view_count, upvote_count, downvote_count, is_closed, is_pinned, pinned_at, '
          'profiles(id, username, avatar_url)',
        )
        .order('is_pinned', desc=True)  # 置顶的在前
      )
      
      if sort_by == 'views':
        query = query.order('view_count', desc=True)
      else:  # latest
        query = query.order('created_at', desc=True)
      
      response = query.range(offset, offset + page_size - 1).execute()

    # Check for Supabase errors - handle both dict and object formats
    if hasattr(response, 'error') and response.error:
      error_msg = response.error
      if isinstance(response.error, dict):
        error_msg = response.error.get('message', str(response.error))
      print(f"Supabase error in list_posts: {error_msg}")
      # Return empty paginated response instead of raising exception to prevent 500 errors
      return PaginatedPostResponse(
        items=[],
        total=0,
        page=page,
        page_size=page_size,
        total_pages=0,
      )

    # Also check for error attribute in response
    if hasattr(response, 'status_code') and response.status_code >= 400:
      print(f"Supabase HTTP error in list_posts: {response.status_code}")
      return PaginatedPostResponse(
        items=[],
        total=0,
        page=page,
        page_size=page_size,
        total_pages=0,
      )

    if response.data is None:
      # Return empty paginated response instead of error if no data
      return PaginatedPostResponse(
        items=[],
        total=0,
        page=page,
        page_size=page_size,
        total_pages=0,
      )

    items: List[Dict[str, Any]] = response.data or []
    
    # 优化：批量获取所有 post 的 reply_count（使用一次查询）
    # 如果 items 为空，直接返回空分页结果
    if not items:
      return PaginatedPostResponse(
        items=[],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size if total > 0 else 0,
      )
    
    post_ids = [str(item['id']) for item in items]
    reply_counts: Dict[str, int] = defaultdict(int)
    
    # 优化：批量查询 post_replies 计数
    # 如果 post_ids 数量少（<=20），使用单独查询计数（更快）
    # 如果数量多，使用批量查询
    try:
      if post_ids:
        if len(post_ids) <= 20:
          # 少量 posts：使用单独查询计数，只获取计数不返回数据
          for post_id in post_ids:
            try:
              count_resp = (
                supabase.table('post_replies')
                .select('id', count='exact')
                .eq('post_id', post_id)
                .limit(0)
                .execute()
              )
              if hasattr(count_resp, 'count') and count_resp.count is not None:
                reply_counts[post_id] = count_resp.count
            except Exception:
              reply_counts[post_id] = 0
        else:
          # 大量 posts：使用批量查询，只查询 post_id 字段减少数据传输
          replies_response = (
            supabase.table('post_replies')
            .select('post_id')
            .in_('post_id', post_ids)
            .limit(5000)  # 减少 limit，通常足够统计
            .execute()
          )
          if replies_response.data:
            for reply in replies_response.data:
              post_id = str(reply.get('post_id', ''))
              if post_id:
                reply_counts[post_id] += 1
    except Exception as reply_count_error:
      # 如果查询 reply_count 失败，记录错误但继续处理
      print(f"Warning: Failed to get reply counts: {reply_count_error}")
      import traceback
      print(traceback.format_exc())
      # 继续执行，reply_counts 保持为 defaultdict(int)，所有值都是 0
    
    # 如果按评论数排序，需要先排序再分页
    if sort_by == 'replies':
      # 将 reply_count 添加到 items 中，然后排序
      for item in items:
        item['_reply_count'] = reply_counts.get(str(item['id']), 0)
      
      # 排序：先按 is_pinned（置顶在前），再按 reply_count 降序
      items.sort(key=lambda x: (
        not x.get('is_pinned', False),  # False (pinned) 在前，True (not pinned) 在后
        -x.get('_reply_count', 0)  # 按评论数降序
      ))
      
      # 分页
      start = offset
      end = offset + page_size
      items = items[start:end]
    
    result: List[PostResponse] = []

    for item in items:
      try:
        post_id = str(item['id'])
        author_data = _serialize_author(item)
        
        # Handle datetime conversion
        created_at = item.get('created_at')
        updated_at = item.get('updated_at')
        
        # Convert string to datetime if needed, or keep as is
        if isinstance(created_at, str):
          try:
            # Handle ISO format with or without timezone
            if created_at.endswith('Z'):
              created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            else:
              created_at = datetime.fromisoformat(created_at)
          except (ValueError, AttributeError):
            # If conversion fails, try to parse as is
            pass
        
        if isinstance(updated_at, str) and updated_at:
          try:
            if updated_at.endswith('Z'):
              updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
            else:
              updated_at = datetime.fromisoformat(updated_at)
          except (ValueError, AttributeError):
            updated_at = None
        
        # Check if pin has expired (7 days)
        is_pinned = bool(item.get('is_pinned', False))
        pinned_at = None
        if is_pinned:
          pinned_at_str = item.get('pinned_at')
          if pinned_at_str:
            try:
              if isinstance(pinned_at_str, str):
                pinned_at = datetime.fromisoformat(pinned_at_str.replace('Z', '+00:00'))
              else:
                pinned_at = pinned_at_str
              
              # Check if pin has expired (7 days)
              if datetime.now(pinned_at.tzinfo) - pinned_at >= timedelta(days=7):
                # Pin has expired, update in database and set is_pinned to False
                try:
                  (
                    supabase.table('posts')
                    .update({
                      'is_pinned': False,
                      'pinned_at': None
                    })
                    .eq('id', post_id)
                    .execute()
                  )
                  is_pinned = False
                  pinned_at = None
                except Exception as update_error:
                  print(f"Failed to update expired pin for post {post_id}: {update_error}")
                  # Continue with is_pinned = False
                  is_pinned = False
                  pinned_at = None
            except (ValueError, TypeError) as parse_error:
              print(f"Failed to parse pinned_at for post {post_id}: {parse_error}")
              # If we can't parse, assume not expired
              if isinstance(pinned_at_str, str):
                try:
                  pinned_at = datetime.fromisoformat(pinned_at_str.replace('Z', '+00:00'))
                except:
                  pinned_at = None
        
        result.append(
          PostResponse(
            id=post_id,
            title=str(item['title']),
            category=item.get('category'),
            summary=item.get('summary'),
            cover_image_url=item.get('cover_image_url'),
            author_id=str(item['author_id']),
            created_at=created_at,
            updated_at=updated_at,
            reply_count=reply_counts.get(post_id, 0),
            view_count=int(item.get('view_count', 0) or 0),
            upvote_count=int(item.get('upvote_count', 0) or 0),
            downvote_count=int(item.get('downvote_count', 0) or 0),
            tags=item.get('tags') if isinstance(item.get('tags'), list) else None,
            is_closed=bool(item.get('is_closed', False)),
            is_pinned=is_pinned,
            pinned_at=pinned_at,
            author=author_data if author_data else None,
          )
        )
      except Exception as item_error:
        print(f"Error processing post item {item.get('id', 'unknown')}: {item_error}")
        import traceback
        print(traceback.format_exc())
        # Skip this item and continue
        continue

    # 计算总页数
    total_pages = (total + page_size - 1) // page_size if total > 0 else 0
    
    return PaginatedPostResponse(
      items=result,
      total=total,
      page=page,
      page_size=page_size,
      total_pages=total_pages,
    )
  except HTTPException:
    raise
  except Exception as e:
    import traceback
    error_msg = str(e)
    print(f"Error in list_posts: {error_msg}")
    print(traceback.format_exc())
    # Return empty paginated response on error to prevent frontend crashes
    # In production, you might want to log this and return an error
    return PaginatedPostResponse(
      items=[],
      total=0,
      page=page,
      page_size=page_size,
      total_pages=0,
    )


@router.post('/', response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post(
  payload: PostCreate,
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_current_user),
):
  try:
    # Ensure profile exists before creating post
    profile_check = (
      supabase.table('profiles')
      .select('id')
      .eq('id', user.id)
      .execute()
    )
    
    if not profile_check.data or len(profile_check.data) == 0:
      # Profile doesn't exist, create it
      print(f"[CREATE_POST] Profile not found for user {user.id}, creating profile...")
      # Try both id and user_id columns to handle different schema versions
      profile_insert = {
        'username': user.email.split('@')[0] if user.email else 'User',
      }
      # Add both id and user_id to handle different schema versions
      profile_insert['id'] = user.id
      profile_insert['user_id'] = user.id  # Some schemas use user_id instead of id
      profile_response = supabase.table('profiles').insert(profile_insert).execute()
      
      if hasattr(profile_response, 'error') and profile_response.error:
        error_msg = profile_response.error
        if isinstance(profile_response.error, dict):
          error_msg = profile_response.error.get('message', str(profile_response.error))
        print(f"[CREATE_POST] Failed to create profile: {error_msg}")
        raise HTTPException(
          status.HTTP_500_INTERNAL_SERVER_ERROR,
          f"Failed to create user profile: {error_msg}"
        )
      
      print(f"[CREATE_POST] ✅ Profile created for user {user.id}")
    
    # Prepare insert payload
    # tags is now required, so it will always be included
    insert_payload = {
      'title': payload.title,
      'author_id': user.id,
      'view_count': 0,
      'upvote_count': 0,
      'downvote_count': 0,
      'is_closed': False,
      'tags': payload.tags,  # tags is required
    }
    
    # Add optional fields
    if payload.category:
      insert_payload['category'] = payload.category
    if payload.summary:
      insert_payload['summary'] = payload.summary

    # Insert the post
    print(f"[CREATE_POST] Attempting to insert post")
    print(f"[CREATE_POST] Payload: {insert_payload}")
    print(f"[CREATE_POST] User ID: {user.id}")
    
    # Verify Supabase client is using service key
    print(f"[CREATE_POST] Supabase URL: {supabase.supabase_url}")
    print(f"[CREATE_POST] Using service key: {'Yes' if hasattr(supabase, 'supabase_key') and 'service' in str(supabase.supabase_key).lower() else 'Unknown'}")
    
    try:
      response = supabase.table('posts').insert(insert_payload).execute()
      print(f"[CREATE_POST] ✅ Insert successful!")
    except Exception as insert_error:
      print(f"[CREATE_POST] Insert exception: {insert_error}")
      import traceback
      print(traceback.format_exc())
      raise HTTPException(
        status.HTTP_500_INTERNAL_SERVER_ERROR,
        f"Failed to insert post: {str(insert_error)}"
      )

    # Check for Supabase errors - more detailed checking
    if hasattr(response, 'error') and response.error:
      error_msg = response.error
      error_code = None
      error_details = {}
      
      if isinstance(response.error, dict):
        error_msg = response.error.get('message', str(response.error))
        error_code = response.error.get('code', '')
        error_details = response.error
      elif hasattr(response.error, 'message'):
        error_msg = response.error.message
        error_code = getattr(response.error, 'code', '')
      
      print(f"[CREATE_POST] ❌ Supabase error: {error_msg}")
      print(f"[CREATE_POST] Error code: {error_code}")
      print(f"[CREATE_POST] Full error: {error_details if error_details else response.error}")
      
      # Check if it's an RLS error
      if error_code == '42501' or 'row-level security' in str(error_msg).lower() or 'RLS' in str(error_msg):
        print("[CREATE_POST] ⚠️  RLS POLICY ERROR DETECTED!")
        print("[CREATE_POST] Please run RENAME_THREADS_TO_POSTS.sql in Supabase SQL Editor")
        raise HTTPException(
          status.HTTP_403_FORBIDDEN,
          "❌ Permission denied: RLS policy error. Please execute RENAME_THREADS_TO_POSTS.sql in Supabase SQL Editor. Error: " + str(error_msg)
        )
      
      raise HTTPException(
        status.HTTP_400_BAD_REQUEST,
        f"Database error: {error_msg}"
      )
    
    # Check response data
    if not hasattr(response, 'data'):
      print("[CREATE_POST] ❌ Response has no 'data' attribute")
      print(f"[CREATE_POST] Response type: {type(response)}")
      print(f"[CREATE_POST] Response attributes: {dir(response)}")
      raise HTTPException(
        status.HTTP_500_INTERNAL_SERVER_ERROR,
        "Invalid response from database"
      )
    
    # Also check response status
    if hasattr(response, 'status_code') and response.status_code >= 400:
      print(f"HTTP error in create_post: {response.status_code}")
      if hasattr(response, 'text'):
        print(f"Response text: {response.text}")

    if not response.data or len(response.data) == 0:
      raise HTTPException(status.HTTP_400_BAD_REQUEST, "Failed to create post")

    post_id = response.data[0]['id']
    
    # Fetch the created post with author info
    detail_response = (
      supabase.table('posts')
      .select(
        'id, title, category, summary, cover_image_url, author_id, created_at, updated_at, '
        'tags, view_count, upvote_count, downvote_count, is_closed, '
        'profiles(id, username, avatar_url)',
      )
      .eq('id', post_id)
      .execute()
    )

    # Check for errors in detail query
    if hasattr(detail_response, 'error') and detail_response.error:
      error_msg = detail_response.error
      if isinstance(detail_response.error, dict):
        error_msg = detail_response.error.get('message', str(detail_response.error))
      print(f"Supabase error fetching created post: {error_msg}")
      # If we can't fetch details, return basic info from insert response
      record = response.data[0]
      result = PostResponse(
        id=str(record['id']),
        title=str(record['title']),
        category=record.get('category'),
        summary=record.get('summary'),
        cover_image_url=record.get('cover_image_url'),
        author_id=str(record['author_id']),
        created_at=record['created_at'],
        updated_at=record.get('updated_at'),
        reply_count=0,
        view_count=int(record.get('view_count', 0) or 0),
        upvote_count=int(record.get('upvote_count', 0) or 0),
        downvote_count=int(record.get('downvote_count', 0) or 0),
      tags=record.get('tags') if isinstance(record.get('tags'), list) else payload.tags,
      is_closed=bool(record.get('is_closed', False)),
      is_pinned=bool(record.get('is_pinned', False)),
      author=None,  # Author info not available
    )
      # 奖励发布帖子积分 (+10)
      try:
        success = award_points(supabase, user.id, 10, '发布帖子')
        if not success:
          print(f"[CREATE_POST] Failed to award points to user {user.id} for posting (fallback path 1)")
      except Exception as e:
        print(f"[CREATE_POST] Error awarding points (fallback path 1): {e}")
      return result

    if not detail_response.data or len(detail_response.data) == 0:
      # Fallback to insert response
      record = response.data[0]
      result = PostResponse(
        id=str(record['id']),
        title=str(record['title']),
        category=record.get('category'),
        summary=record.get('summary'),
        cover_image_url=record.get('cover_image_url'),
        author_id=str(record['author_id']),
        created_at=record['created_at'],
        updated_at=record.get('updated_at'),
        reply_count=0,
        view_count=int(record.get('view_count', 0) or 0),
        upvote_count=int(record.get('upvote_count', 0) or 0),
        downvote_count=int(record.get('downvote_count', 0) or 0),
      tags=record.get('tags') if isinstance(record.get('tags'), list) else payload.tags,
      is_closed=bool(record.get('is_closed', False)),
      is_pinned=bool(record.get('is_pinned', False)),
      author=None,
    )
      # 奖励发布帖子积分 (+10)
      try:
        success = award_points(supabase, user.id, 10, '发布帖子')
        if not success:
          print(f"[CREATE_POST] Failed to award points to user {user.id} for posting (fallback path 2)")
      except Exception as e:
        print(f"[CREATE_POST] Error awarding points (fallback path 2): {e}")
      return result

    record = detail_response.data[0]
    author_data = _serialize_author(record)
    
    # Handle datetime conversion
    created_at = record.get('created_at')
    updated_at = record.get('updated_at')
    
    if isinstance(created_at, str):
      try:
        if created_at.endswith('Z'):
          created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        else:
          created_at = datetime.fromisoformat(created_at)
      except (ValueError, AttributeError):
        pass
    
    if isinstance(updated_at, str) and updated_at:
      try:
        if updated_at.endswith('Z'):
          updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
        else:
          updated_at = datetime.fromisoformat(updated_at)
      except (ValueError, AttributeError):
        updated_at = None
    
    result = PostResponse(
      id=str(record['id']),
      title=str(record['title']),
      category=record.get('category'),
      summary=record.get('summary'),
      cover_image_url=record.get('cover_image_url'),
      author_id=str(record['author_id']),
      created_at=created_at,
      updated_at=updated_at,
      reply_count=0,
      view_count=int(record.get('view_count', 0) or 0),
      upvote_count=int(record.get('upvote_count', 0) or 0),
      downvote_count=int(record.get('downvote_count', 0) or 0),
      tags=record.get('tags') if isinstance(record.get('tags'), list) else payload.tags,
      is_closed=bool(record.get('is_closed', False)),
      is_pinned=bool(record.get('is_pinned', False)),
      author=author_data if author_data else None,
    )
    
    # 奖励发布帖子积分 (+10)
    try:
      success = award_points(supabase, user.id, 10, '发布帖子')
      if not success:
        print(f"[CREATE_POST] Failed to award points to user {user.id} for posting")
    except Exception as e:
      print(f"[CREATE_POST] Error awarding points: {e}")
      import traceback
      print(traceback.format_exc())
      # 积分奖励失败不影响帖子创建
    
    return result
  except HTTPException:
    raise
  except Exception as e:
    import traceback
    error_msg = str(e)
    print(f"Error in create_post: {error_msg}")
    print(traceback.format_exc())
    raise HTTPException(
      status.HTTP_500_INTERNAL_SERVER_ERROR,
      f"Failed to create post: {error_msg}"
    )


@router.post('/{post_id}/replies', response_model=PostReplyResponse, status_code=status.HTTP_201_CREATED)
async def create_reply(
  post_id: str,
  payload: PostReplyCreate,
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_current_user),
):
  # Ensure profile exists before creating reply
  profile_check = (
    supabase.table('profiles')
    .select('id')
    .eq('id', user.id)
    .execute()
  )
  
  if not profile_check.data or len(profile_check.data) == 0:
    print(f"[CREATE_REPLY] Profile not found for user {user.id}, creating profile...")
    profile_insert = {
      'username': user.email.split('@')[0] if user.email else 'User',
      'id': user.id,
      'user_id': user.id,
    }
    profile_response = supabase.table('profiles').insert(profile_insert).execute()
    if hasattr(profile_response, 'error') and profile_response.error:
      error_msg = profile_response.error.get('message', str(profile_response.error)) if isinstance(profile_response.error, dict) else str(profile_response.error)
      print(f"[CREATE_REPLY] Failed to create profile: {error_msg}")
      raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to create user profile: {error_msg}")
    print(f"[CREATE_REPLY] ✅ Profile created for user {user.id}")

  # If parent_reply_id is provided, verify it exists and belongs to the same post
  if payload.parent_reply_id:
    parent_check = (
      supabase.table('post_replies')
      .select('id, post_id')
      .eq('id', payload.parent_reply_id)
      .execute()
    )
    if not parent_check.data or len(parent_check.data) == 0:
      raise HTTPException(status.HTTP_404_NOT_FOUND, "Parent reply not found")
    if parent_check.data[0]['post_id'] != post_id:
      raise HTTPException(status.HTTP_400_BAD_REQUEST, "Parent reply does not belong to this post")

  insert_payload = {
    'post_id': post_id,
    'content': payload.content,
    'author_id': user.id,
    'upvote_count': 0,
    'downvote_count': 0,
  }
  
  if payload.parent_reply_id:
    insert_payload['parent_reply_id'] = payload.parent_reply_id

  response = supabase.table('post_replies').insert(insert_payload).execute()

  if not response.data:
    raise HTTPException(status.HTTP_400_BAD_REQUEST, "Failed to create reply")

  reply_id = response.data[0]['id']
  detail_response = (
    supabase.table('post_replies')
    .select(
      'id, content, post_id, author_id, created_at, parent_reply_id, upvote_count, downvote_count, '
      'profiles(id, username, avatar_url)',
    )
    .eq('id', reply_id)
    .execute()
  )

  if not detail_response.data:
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Failed to load created reply")

  record = detail_response.data[0]
  result = PostReplyResponse(
    **{
      'id': record['id'],
      'content': record['content'],
      'post_id': record['post_id'],
      'author_id': record['author_id'],
      'created_at': record['created_at'],
      'upvote_count': record.get('upvote_count', 0),
      'downvote_count': record.get('downvote_count', 0),
      'author': _serialize_author(record),
      'parent_reply_id': record.get('parent_reply_id'),
      'replies': [],
    }
  )
  
  # 奖励发表评论积分 (+5)
  try:
    success = award_points(supabase, user.id, 5, '发表评论')
    if not success:
      print(f"[CREATE_REPLY] Failed to award points to user {user.id} for commenting")
  except Exception as e:
    print(f"[CREATE_REPLY] Error awarding points: {e}")
    import traceback
    print(traceback.format_exc())
    # 积分奖励失败不影响评论创建
  
  return result


@router.get('/hot-tags', response_model=List[HotTag])
async def get_hot_tags(supabase: SupabaseClientDep, limit: int = 20):
  try:
    # 进一步优化：减少查询数量，只查询最近500条 posts
    # 这样可以更快地返回结果，同时仍然能准确反映热门标签
    response = (
      supabase.table('posts')
      .select('id, tags')
      .order('created_at', desc=True)
      .limit(500)  # 从1000减少到500，提升查询速度
      .execute()
    )
    
    if response.data is None:
      return []

    tag_counts: Dict[str, int] = {}
    items = response.data or []
    
    for item in items:
      tags = item.get('tags')
      # Handle both null and empty arrays
      if tags and isinstance(tags, list):
        for tag in tags:
          if tag and isinstance(tag, str):  # Skip empty tags and ensure it's a string
            tag_counts[tag] = tag_counts.get(tag, 0) + 1

    sorted_tags = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)[:limit]
    return [HotTag(tag=tag, count=count) for tag, count in sorted_tags]
  except HTTPException:
    raise
  except Exception as e:
    import traceback
    print(f"Error in get_hot_tags: {e}")
    print(traceback.format_exc())
    # Return empty list on error instead of crashing
    return []


@router.get('/similar', response_model=List[SimilarPost])
async def find_similar_posts(title: str, supabase: SupabaseClientDep, limit: int = 5):
  try:
    # Get all posts and filter by title
    # First get posts, then get reply counts separately
    response = (
      supabase.table('posts')
      .select('id, title')
      .limit(limit * 10)  # Get more to filter
      .execute()
    )
    
    if response.data is None:
      return []
    
    items = response.data or []
    
    # Filter by title containing the search term (case-insensitive)
    title_lower = title.lower()
    filtered_items = [
      item for item in items
      if title_lower in item.get('title', '').lower()
    ][:limit]
    
    # Get reply counts for each post
    result = []
    for item in filtered_items:
      post_id = item['id']
      # Get reply count
      replies_response = (
        supabase.table('post_replies')
        .select('id', count='exact')
        .eq('post_id', post_id)
        .execute()
      )
      reply_count = len(replies_response.data) if replies_response.data else 0
      
      result.append(
        SimilarPost(
          id=item['id'],
          title=item['title'],
          reply_count=reply_count,
        )
      )
    
    return result
  except HTTPException:
    raise
  except Exception as e:
    # Log the error for debugging
    import traceback
    print(f"Error in find_similar_posts: {e}")
    print(traceback.format_exc())
    # Return empty list on error instead of crashing
    return []


# ============================================
# User-specific endpoints (must be before /{post_id} to avoid route conflicts)
# ============================================

@router.get('/my-posts', response_model=PaginatedPostResponse)
async def list_my_posts(
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_current_user),
  page: int = 1,
  page_size: int = 10,
):
  """Get posts created by the current user"""
  try:
    print(f"[list_my_posts] Starting for user ID: {user.id}")
    
    if page < 1:
      page = 1
    if page_size < 1 or page_size > 100:
      page_size = 10
    
    offset = (page - 1) * page_size
    
    # 完全按照 get_all_replies_to_my_posts 的逻辑：使用同步查询，直接执行
    # 筛选条件：author_id = user.id（筛选出当前用户创建的帖子）
    print(f"[list_my_posts] Querying posts for author_id: {user.id}")
    response = (
      supabase.table('posts')
      .select(
        'id, title, category, summary, cover_image_url, author_id, created_at, updated_at, '
        'tags, view_count, upvote_count, downvote_count, is_closed, is_pinned, '
        'profiles(id, username)',
      )
      .eq('author_id', user.id)  # 关键筛选：只获取 author_id 等于当前用户 ID 的帖子
      .order('created_at', desc=True)
      .range(offset, offset + page_size - 1)
      .execute()
    )
    
    if hasattr(response, 'error') and response.error:
      error_msg = response.error
      if isinstance(response.error, dict):
        error_msg = response.error.get('message', str(response.error))
      
      # If error is about missing columns (like is_pinned), try without them
      if 'is_pinned' in str(error_msg) or 'column' in str(error_msg).lower():
        print(f"Warning: Some columns may not exist, trying without is_pinned: {error_msg}")
        response = (
          supabase.table('posts')
          .select(
            'id, title, category, summary, cover_image_url, author_id, created_at, updated_at, '
            'tags, view_count, upvote_count, downvote_count, is_closed, '
            'profiles(id, username)',
          )
          .eq('author_id', user.id)
          .order('created_at', desc=True)
          .range(offset, offset + page_size - 1)
          .execute()
        )
        
        if hasattr(response, 'error') and response.error:
          error_msg = response.error
          if isinstance(response.error, dict):
            error_msg = response.error.get('message', str(response.error))
          print(f"Error listing my posts: {error_msg}")
          raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to list posts: {error_msg}")
      else:
        print(f"Error listing my posts: {error_msg}")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to list posts: {error_msg}")
    
    items = response.data or []
    print(f"[list_my_posts] Retrieved {len(items)} posts for user {user.id}")
    
    # Get total count (使用同步查询，与 get_all_replies_to_my_posts 保持一致)
    count_response = (
      supabase.table('posts')
      .select('id', count='exact')
      .eq('author_id', user.id)
      .execute()
    )
    
    if hasattr(count_response, 'error') and count_response.error:
      error_msg = count_response.error
      if isinstance(count_response.error, dict):
        error_msg = count_response.error.get('message', str(count_response.error))
      print(f"Error getting count in list_my_posts: {error_msg}")
      # 如果 count 查询失败，使用 items 的长度作为 total
      total = len(items)
    else:
      total = count_response.count if hasattr(count_response, 'count') and count_response.count is not None else len(items)
    
    print(f"[list_my_posts] Total posts found: {total}")
    
    # Get reply counts for posts
    post_ids = [str(item['id']) for item in items if item.get('id')]
    reply_counts = {}
    if post_ids:
      if len(post_ids) <= 20:
        # For small lists, query individually
        for post_id in post_ids:
          try:
            reply_resp = (
              supabase.table('post_replies')
              .select('id', count='exact')
              .eq('post_id', post_id)
              .execute()
            )
            if hasattr(reply_resp, 'error') and reply_resp.error:
              reply_counts[post_id] = 0
            else:
              reply_counts[post_id] = reply_resp.count if hasattr(reply_resp, 'count') and reply_resp.count is not None else 0
          except Exception as reply_error:
            print(f"Error getting reply count for post {post_id}: {reply_error}")
            reply_counts[post_id] = 0
      else:
        # For large lists, use a batch query (limited to 5000)
        try:
          all_replies = (
            supabase.table('post_replies')
            .select('post_id')
            .in_('post_id', post_ids[:5000])
            .execute()
          )
          if all_replies.data:
            for reply in all_replies.data:
              post_id = str(reply.get('post_id', ''))
              if post_id:
                reply_counts[post_id] = reply_counts.get(post_id, 0) + 1
        except Exception as batch_error:
          print(f"Error getting batch reply counts: {batch_error}")
          # Fallback to individual queries
          for post_id in post_ids:
            reply_counts[post_id] = 0
    
    result = []
    for item in items:
      try:
        post_id = str(item['id'])
        author_data = _serialize_author(item)
        
        created_at = item.get('created_at')
        updated_at = item.get('updated_at')
        
        if isinstance(created_at, str):
          try:
            if created_at.endswith('Z'):
              created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            else:
              created_at = datetime.fromisoformat(created_at)
          except (ValueError, AttributeError):
            created_at = datetime.now()
        elif not isinstance(created_at, datetime):
          created_at = datetime.now()
        
        if isinstance(updated_at, str) and updated_at:
          try:
            if updated_at.endswith('Z'):
              updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
            else:
              updated_at = datetime.fromisoformat(updated_at)
          except (ValueError, AttributeError):
            updated_at = None
        
        result.append(
          PostResponse(
            id=post_id,
            title=str(item['title']),
            category=item.get('category'),
            summary=item.get('summary'),
            cover_image_url=item.get('cover_image_url'),
            author_id=str(item['author_id']),
            created_at=created_at,
            updated_at=updated_at,
            reply_count=reply_counts.get(post_id, 0),
            view_count=int(item.get('view_count', 0) or 0),
            upvote_count=int(item.get('upvote_count', 0) or 0),
            downvote_count=int(item.get('downvote_count', 0) or 0),
            tags=item.get('tags') if isinstance(item.get('tags'), list) else None,
            is_closed=bool(item.get('is_closed', False)),
            is_pinned=bool(item.get('is_pinned', False)) if 'is_pinned' in item else False,  # Handle missing column
            author=author_data if author_data else None,
          )
        )
      except Exception as item_error:
        print(f"Error processing post item {item.get('id', 'unknown')}: {item_error}")
        import traceback
        print(traceback.format_exc())
        continue
    
    total_pages = (total + page_size - 1) // page_size if total > 0 else 0
    
    print(f"[list_my_posts] Returning response: {len(result)} items, total={total}, page={page}, total_pages={total_pages}")
    
    return PaginatedPostResponse(
      items=result,
      total=total,
      page=page,
      page_size=page_size,
      total_pages=total_pages,
    )
  except HTTPException:
    raise
  except Exception as e:
    error_msg = str(e)
    print(f"Error in list_my_posts: {error_msg}")
    import traceback
    print(traceback.format_exc())
    
    # 检查是否是超时错误
    if 'timeout' in error_msg.lower() or 'timed out' in error_msg.lower():
      raise HTTPException(status.HTTP_408_REQUEST_TIMEOUT, 'Operation timed out. Please try again.')
    
    # 检查是否是认证错误（应该已经被 get_current_user 捕获，但以防万一）
    if 'expired' in error_msg.lower() or 'invalid' in error_msg.lower() or 'jwt' in error_msg.lower() or 'token' in error_msg.lower():
      raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Invalid or expired token')
    
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to list my posts: {error_msg}")


@router.get('/my-posts/replies', response_model=List[PostReplyResponse])
async def get_all_replies_to_my_posts(
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_current_user),
  limit: int = 50,
):
  """Get all replies to posts created by the current user"""
  import asyncio
  
  try:
    print(f"[get_all_replies_to_my_posts] Starting for user ID: {user.id}")
    
    if limit < 1 or limit > 200:
      limit = 50
    
    # Get all post IDs created by the user
    # 步骤1：先查询用户的所有帖子 ID（使用同步查询，没有超时保护）
    print(f"[get_all_replies_to_my_posts] Step 1: Querying posts for author_id: {user.id}")
    my_posts_resp = (
      supabase.table('posts')
      .select('id')
      .eq('author_id', user.id)  # 筛选条件：author_id = user.id
      .execute()
    )
    
    if hasattr(my_posts_resp, 'error') and my_posts_resp.error:
      error_msg = my_posts_resp.error
      if isinstance(my_posts_resp.error, dict):
        error_msg = my_posts_resp.error.get('message', str(my_posts_resp.error))
      print(f"[get_all_replies_to_my_posts] Error getting my posts: {error_msg}")
      raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to get my posts: {error_msg}")
    
    my_post_ids = [str(item['id']) for item in (my_posts_resp.data or []) if item.get('id')]
    print(f"[get_all_replies_to_my_posts] Step 1: Found {len(my_post_ids)} posts for user {user.id}")
    
    if not my_post_ids:
      print(f"[get_all_replies_to_my_posts] No posts found for user {user.id}, returning empty list")
      return []
    
    # Get replies to these posts
    # 步骤2：查询这些帖子下的所有Reply（使用 .in_('post_id', my_post_ids) 筛选）
    print(f"[get_all_replies_to_my_posts] Step 2: Querying replies for post_ids: {my_post_ids[:5]}... (showing first 5)")
    response = (
      supabase.table('post_replies')
      .select(
        'id, content, post_id, author_id, created_at, parent_reply_id, upvote_count, downvote_count, '
        'profiles(id, username, avatar_url), posts!post_id(id, title)',
      )
      .in_('post_id', my_post_ids)  # 筛选条件：post_id IN (my_post_ids)
      .order('created_at', desc=True)
      .limit(limit)
      .execute()
    )
    
    if hasattr(response, 'error') and response.error:
      error_msg = response.error
      if isinstance(response.error, dict):
        error_msg = response.error.get('message', str(response.error))
      print(f"[get_all_replies_to_my_posts] Error getting replies: {error_msg}")
      raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to get replies: {error_msg}")
    
    items = response.data or []
    print(f"[get_all_replies_to_my_posts] Step 2: Found {len(items)} replies for user {user.id}'s posts")
    result = []
    
    for item in items:
      try:
        author_data = _serialize_author(item)
        result.append(PostReplyResponse(
          id=str(item['id']),
          post_id=str(item['post_id']),
          parent_reply_id=str(item['parent_reply_id']) if item.get('parent_reply_id') else None,
          author_id=str(item['author_id']),
          content=str(item['content']),
          created_at=item['created_at'],
          updated_at=item.get('updated_at'),
          author=Author(**author_data) if author_data else None,
          replies=[],
          upvote_count=int(item.get('upvote_count', 0) or 0),
          downvote_count=int(item.get('downvote_count', 0) or 0),
        ))
      except Exception as item_error:
        print(f"Error processing reply item {item.get('id', 'unknown')}: {item_error}")
        continue
    
    return result
  except HTTPException:
    raise
  except Exception as e:
    print(f"Error in get_all_replies_to_my_posts: {e}")
    import traceback
    print(traceback.format_exc())
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to get replies: {str(e)}")


@router.get('/my-posts/{post_id}/replies', response_model=List[PostReplyResponse])
async def get_replies_to_my_post(
  post_id: str,
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_current_user),
  page: int = 1,
  page_size: int = 20,
):
  """Get replies to a post created by the current user"""
  try:
    # Verify the post belongs to the user
    post_check = (
      supabase.table('posts')
      .select('id, author_id')
      .eq('id', post_id)
      .eq('author_id', user.id)
      .limit(1)
      .execute()
    )
    
    if not post_check.data or len(post_check.data) == 0:
      raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found or you don't have permission")
    
    if page < 1:
      page = 1
    if page_size < 1 or page_size > 100:
      page_size = 20
    
    offset = (page - 1) * page_size
    
    # Get replies
    response = (
      supabase.table('post_replies')
      .select(
        'id, content, post_id, author_id, created_at, parent_reply_id, upvote_count, downvote_count, '
        'profiles(id, username)',
      )
      .eq('post_id', post_id)
      .order('created_at', desc=True)
      .range(offset, offset + page_size - 1)
      .execute()
    )
    
    if hasattr(response, 'error') and response.error:
      error_msg = response.error
      if isinstance(response.error, dict):
        error_msg = response.error.get('message', str(response.error))
      raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to get replies: {error_msg}")
    
    items = response.data or []
    result = []
    
    for item in items:
      try:
        author_data = _serialize_author(item)
        result.append(PostReplyResponse(
          id=str(item['id']),
          post_id=str(item['post_id']),
          parent_reply_id=str(item['parent_reply_id']) if item.get('parent_reply_id') else None,
          author_id=str(item['author_id']),
          content=str(item['content']),
          created_at=item['created_at'],
          updated_at=item.get('updated_at'),
          author=Author(**author_data) if author_data else None,
          replies=[],
          upvote_count=int(item.get('upvote_count', 0) or 0),
          downvote_count=int(item.get('downvote_count', 0) or 0),
        ))
      except Exception as item_error:
        print(f"Error processing reply item {item.get('id', 'unknown')}: {item_error}")
        continue
    
    return result
  except HTTPException:
    raise
  except Exception as e:
    print(f"Error in get_replies_to_my_post: {e}")
    import traceback
    print(traceback.format_exc())
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to get replies: {str(e)}")


# ============================================
# Post detail endpoint (must be after /my-posts routes)
# ============================================

@router.get('/{post_id}', response_model=PostDetail)
async def get_post(post_id: str, supabase: SupabaseClientDep, user: Optional[AuthenticatedUser] = Depends(get_optional_user)):
  response = (
    supabase.table('posts')
    .select(
      'id, title, category, summary, cover_image_url, author_id, created_at, updated_at, '
      'is_closed, is_pinned, pinned_at, view_count, upvote_count, downvote_count, tags, '
      'profiles(id, username, avatar_url), '
      'post_replies(id, content, post_id, author_id, created_at, upvote_count, downvote_count, parent_reply_id, '
      'profiles(id, username, avatar_url))',
    )
    .eq('id', post_id)
    .execute()
  )

  if not response.data or len(response.data) == 0:
    raise HTTPException(status.HTTP_404_NOT_FOUND, 'Post not found')

  record = response.data[0]
  replies_raw = record.get('post_replies') or []
  
  # Check if pin has expired (7 days)
  is_pinned = bool(record.get('is_pinned', False))
  pinned_at = None
  if is_pinned:
    pinned_at_str = record.get('pinned_at')
    if pinned_at_str:
      try:
        if isinstance(pinned_at_str, str):
          pinned_at = datetime.fromisoformat(pinned_at_str.replace('Z', '+00:00'))
        else:
          pinned_at = pinned_at_str
        
        # Check if pin has expired (7 days)
        if datetime.now(pinned_at.tzinfo) - pinned_at >= timedelta(days=7):
          # Pin has expired, update in database and set is_pinned to False
          try:
            (
              supabase.table('posts')
              .update({
                'is_pinned': False,
                'pinned_at': None
              })
              .eq('id', post_id)
              .execute()
            )
            is_pinned = False
            pinned_at = None
          except Exception as update_error:
            print(f"Failed to update expired pin for post {post_id}: {update_error}")
            is_pinned = False
            pinned_at = None
      except (ValueError, TypeError) as parse_error:
        print(f"Failed to parse pinned_at for post {post_id}: {parse_error}")
        if isinstance(pinned_at_str, str):
          try:
            pinned_at = datetime.fromisoformat(pinned_at_str.replace('Z', '+00:00'))
          except:
            pinned_at = None
  
  # 优化：批量获取所有 replies 的 votes，避免 N+1 查询
  reply_votes_map: Dict[str, str] = {}
  if user and replies_raw:
    reply_ids = [str(reply.get('id', '')) for reply in replies_raw if reply.get('id')]
    if reply_ids:
      try:
        # 一次性查询所有 replies 的 votes
        votes_response = (
          supabase.table('post_votes')
          .select('post_id, vote_type')
          .eq('user_id', user.id)
          .in_('post_id', reply_ids)
          .execute()
        )
        if votes_response.data:
          for vote in votes_response.data:
            reply_id = str(vote.get('post_id', ''))
            if reply_id:
              reply_votes_map[reply_id] = vote.get('vote_type', 'upvote')
      except Exception as votes_error:
        # 如果查询 votes 失败，记录错误但继续处理
        print(f"Warning: Failed to get reply votes: {votes_error}")
  
  # Build a map of all replies
  replies_map = {}
  for reply in replies_raw:
    serialized_reply = _serialize_reply(reply)
    reply_id = str(serialized_reply['id'])
    # 从批量查询的结果中获取 vote
    if reply_id in reply_votes_map:
      serialized_reply['user_vote'] = reply_votes_map[reply_id]
    replies_map[reply_id] = serialized_reply
  
  # Organize replies into a tree structure
  top_level_replies = []
  for reply_id, reply_data in replies_map.items():
    parent_id = reply_data.get('parent_reply_id')
    if parent_id and parent_id in replies_map:
      # This is a nested reply, add it to parent's replies
      if 'replies' not in replies_map[parent_id]:
        replies_map[parent_id]['replies'] = []
      replies_map[parent_id]['replies'].append(reply_data)
    else:
      # This is a top-level reply
      top_level_replies.append(reply_data)
  
  # Sort top-level replies by created_at
  top_level_replies.sort(key=lambda r: r['created_at'])
  
  # Sort nested replies within each reply
  def sort_replies(reply):
    if reply.get('replies'):
      reply['replies'].sort(key=lambda r: r['created_at'])
      for nested_reply in reply['replies']:
        sort_replies(nested_reply)
  
  for reply in top_level_replies:
    sort_replies(reply)

  user_post_vote = None
  if user:
    post_vote_resp = supabase.table('thread_votes').select('vote_type').eq('thread_id', post_id).eq('user_id', user.id).limit(1).execute()
    if post_vote_resp.data and len(post_vote_resp.data) > 0:
      user_post_vote = post_vote_resp.data[0]['vote_type']

  return PostDetail(
    **{
      'id': record['id'],
      'title': record['title'],
      'category': record.get('category'),
      'summary': record.get('summary'),
      'cover_image_url': record.get('cover_image_url'),
      'author_id': record['author_id'],
      'created_at': record['created_at'],
      'updated_at': record.get('updated_at'),
      'reply_count': len(replies_raw),  # Total count including nested replies
      'view_count': record.get('view_count', 0),
      'upvote_count': record.get('upvote_count', 0),
      'downvote_count': record.get('downvote_count', 0),
      'tags': record.get('tags'),
      'is_closed': record.get('is_closed', False),
      'is_pinned': is_pinned,
      'pinned_at': pinned_at,
      'author': _serialize_author(record),
      'user_vote': user_post_vote,
      'replies': top_level_replies,
    }
  )


@router.patch('/{post_id}/close', response_model=PostResponse)
async def close_post(
  post_id: str,
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_current_user),
):
  post_resp = supabase.table('posts').select('author_id').eq('id', post_id).single().execute()
  if not post_resp.data:
    raise HTTPException(status.HTTP_404_NOT_FOUND, 'Post not found')

  post = post_resp.data
  if post['author_id'] != user.id:
    raise HTTPException(status.HTTP_403_FORBIDDEN, 'Only post owner can close it')

  update_resp = (
    supabase.table('posts')
    .update({'is_closed': True})
    .eq('id', post_id)
    .select('id, title, category, summary, is_closed')
    .single()
    .execute()
  )
  if not update_resp.data:
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Failed to close post')

  return PostResponse(**update_resp.data)


@router.post('/{post_id}/pin', response_model=PostResponse, status_code=status.HTTP_200_OK)
async def pin_post(
  post_id: str,
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_current_user),
):
  """Pin a post to top (costs 50 points)"""
  try:
    # Check if post exists and get author
    post_resp = (
      supabase.table('posts')
      .select('id, author_id, is_pinned, pinned_at')
      .eq('id', post_id)
      .limit(1)
      .execute()
    )
    
    if not post_resp.data or len(post_resp.data) == 0:
      raise HTTPException(status.HTTP_404_NOT_FOUND, 'Post not found')
    
    post = post_resp.data[0]
    
    # Check if already pinned and not expired
    if post.get('is_pinned', False):
      pinned_at_str = post.get('pinned_at')
      if pinned_at_str:
        try:
          if isinstance(pinned_at_str, str):
            pinned_at = datetime.fromisoformat(pinned_at_str.replace('Z', '+00:00'))
          else:
            pinned_at = pinned_at_str
          
          # Check if pin has expired (7 days)
          if datetime.now(pinned_at.tzinfo) - pinned_at < timedelta(days=7):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, 'Post is already pinned and not expired')
        except (ValueError, TypeError):
          # If we can't parse the date, assume it's not expired
          raise HTTPException(status.HTTP_400_BAD_REQUEST, 'Post is already pinned')
      else:
        # If pinned_at is missing but is_pinned is True, allow re-pinning
        pass
    
    # Check if user is the author
    if post['author_id'] != user.id:
      raise HTTPException(status.HTTP_403_FORBIDDEN, 'Only post owner can pin it')
    
    # Check and deduct points
    profile_resp = (
      supabase.table('profiles')
      .select('total_points')
      .eq('id', user.id)
      .limit(1)
      .execute()
    )
    
    if not profile_resp.data or len(profile_resp.data) == 0:
      raise HTTPException(status.HTTP_404_NOT_FOUND, 'User profile not found')
    
    current_points = profile_resp.data[0].get('total_points', 0) or 0
    if current_points < 50:
      raise HTTPException(
        status.HTTP_400_BAD_REQUEST,
        f"Insufficient points to pin post. Required: 50, Current: {current_points}"
      )
    
    # Deduct points
    if not deduct_points(supabase, user.id, 50, '置顶帖子'):
      raise HTTPException(status.HTTP_400_BAD_REQUEST, "Failed to deduct points for pinning post")
    
    # Update post with pinned_at timestamp (7 days from now)
    pinned_at = datetime.utcnow()
    update_resp = (
      supabase.table('posts')
      .update({
        'is_pinned': True,
        'pinned_at': pinned_at.isoformat() + 'Z'
      })
      .eq('id', post_id)
      .execute()
    )
    
    # Verify update was successful
    if hasattr(update_resp, 'error') and update_resp.error:
      error_msg = update_resp.error
      if isinstance(update_resp.error, dict):
        error_msg = update_resp.error.get('message', str(update_resp.error))
      print(f"Error updating post: {error_msg}")
      raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f'Failed to pin post: {error_msg}')
    
    # Get full post details
    return await get_post(post_id, supabase, user)
  except HTTPException:
    raise
  except Exception as e:
    print(f"Error pinning post: {e}")
    import traceback
    print(traceback.format_exc())
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to pin post: {str(e)}")
