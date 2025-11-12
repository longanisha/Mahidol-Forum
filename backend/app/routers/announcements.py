from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status

from ..auth import AuthenticatedUser, get_admin_user, get_optional_user
from ..dependencies import SupabaseClientDep
from ..schemas import AnnouncementCreate, AnnouncementResponse, AnnouncementUpdate, Author

router = APIRouter(prefix='/announcements', tags=['announcements'])


@router.get('/', response_model=List[AnnouncementResponse])
async def list_announcements(
  supabase: SupabaseClientDep,
  active_only: bool = True,
  user: Optional[AuthenticatedUser] = Depends(get_optional_user),
):
  """List announcements (public endpoint, shows active announcements by default)"""
  try:
    query = (
      supabase.table('announcements')
      .select('id, title, content, created_by, is_active, priority, created_at, updated_at, admins!created_by(id, username)')
      .order('priority', desc=True)
      .order('created_at', desc=True)
    )
    
    if active_only:
      query = query.eq('is_active', True)
    
    response = query.execute()
    
    if hasattr(response, 'error') and response.error:
      error_msg = response.error
      if isinstance(response.error, dict):
        error_msg = response.error.get('message', str(response.error))
      print(f"Error listing announcements: {error_msg}")
      return []
    
    items = response.data or []
    result = []
    
    for item in items:
      try:
        # 处理作者信息
        author_data = {}
        if item.get('admins'):
          admin_data = item['admins']
          if isinstance(admin_data, list) and len(admin_data) > 0:
            admin_data = admin_data[0]
          author_data = {
            'id': admin_data.get('id'),
            'username': admin_data.get('username'),
          }
        
        # 处理时间字段
        created_at = item.get('created_at')
        if created_at and isinstance(created_at, str):
          try:
            if created_at.endswith('Z'):
              created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            else:
              created_at = datetime.fromisoformat(created_at)
          except (ValueError, AttributeError):
            created_at = datetime.now()
        elif not isinstance(created_at, datetime):
          created_at = datetime.now()
        
        updated_at = item.get('updated_at')
        if updated_at and isinstance(updated_at, str):
          try:
            if updated_at.endswith('Z'):
              updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
            else:
              updated_at = datetime.fromisoformat(updated_at)
          except (ValueError, AttributeError):
            updated_at = None
        
        result.append(
          AnnouncementResponse(
            id=str(item['id']),
            title=str(item['title']),
            content=str(item['content']),
            created_by=str(item['created_by']),
            is_active=bool(item.get('is_active', True)),
            priority=int(item.get('priority', 0)),
            created_at=created_at,
            updated_at=updated_at,
            author=Author(**author_data) if author_data else None,
          )
        )
      except Exception as item_error:
        print(f"Error processing announcement item {item.get('id', 'unknown')}: {item_error}")
        continue
    
    return result
  except Exception as e:
    print(f"Error in list_announcements: {e}")
    import traceback
    print(traceback.format_exc())
    return []


@router.get('/{announcement_id}', response_model=AnnouncementResponse)
async def get_announcement(
  announcement_id: str,
  supabase: SupabaseClientDep,
  user: Optional[AuthenticatedUser] = Depends(get_optional_user),
):
  """Get a single announcement by ID (public endpoint)"""
  try:
    response = (
      supabase.table('announcements')
      .select('id, title, content, created_by, is_active, priority, created_at, updated_at, admins!created_by(id, username)')
      .eq('id', announcement_id)
      .single()
      .execute()
    )
    
    if hasattr(response, 'error') and response.error:
      error_msg = response.error
      if isinstance(response.error, dict):
        error_msg = response.error.get('message', str(response.error))
      raise HTTPException(status.HTTP_404_NOT_FOUND, f"Announcement not found: {error_msg}")
    
    if not response.data:
      raise HTTPException(status.HTTP_404_NOT_FOUND, "Announcement not found")
    
    item = response.data
    
    # 处理作者信息
    author_data = {}
    if item.get('admins'):
      admin_data = item['admins']
      if isinstance(admin_data, list) and len(admin_data) > 0:
        admin_data = admin_data[0]
      author_data = {
        'id': admin_data.get('id'),
        'username': admin_data.get('username'),
      }
    
    # 处理时间字段
    created_at = item.get('created_at')
    if created_at and isinstance(created_at, str):
      try:
        if created_at.endswith('Z'):
          created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        else:
          created_at = datetime.fromisoformat(created_at)
      except (ValueError, AttributeError):
        created_at = datetime.now()
    elif not isinstance(created_at, datetime):
      created_at = datetime.now()
    
    updated_at = item.get('updated_at')
    if updated_at and isinstance(updated_at, str):
      try:
        if updated_at.endswith('Z'):
          updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
        else:
          updated_at = datetime.fromisoformat(updated_at)
      except (ValueError, AttributeError):
        updated_at = None
    
    return AnnouncementResponse(
      id=str(item['id']),
      title=str(item['title']),
      content=str(item['content']),
      created_by=str(item['created_by']),
      is_active=bool(item.get('is_active', True)),
      priority=int(item.get('priority', 0)),
      created_at=created_at,
      updated_at=updated_at,
      author=Author(**author_data) if author_data else None,
    )
  except HTTPException:
    raise
  except Exception as e:
    print(f"Error in get_announcement: {e}")
    import traceback
    print(traceback.format_exc())
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to get announcement: {str(e)}")


@router.post('/', response_model=AnnouncementResponse, status_code=status.HTTP_201_CREATED)
async def create_announcement(
  payload: AnnouncementCreate,
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_admin_user),
):
  """Create a new announcement (admin only)"""
  try:
    insert_payload = {
      'title': payload.title.strip(),
      'content': payload.content.strip(),
      'created_by': user.id,
      'is_active': payload.is_active if payload.is_active is not None else True,
      'priority': payload.priority if payload.priority is not None else 0,
    }
    
    response = supabase.table('announcements').insert(insert_payload).execute()
    
    if hasattr(response, 'error') and response.error:
      error_msg = response.error
      if isinstance(response.error, dict):
        error_msg = response.error.get('message', str(response.error))
      raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Failed to create announcement: {error_msg}")
    
    if not response.data:
      raise HTTPException(status.HTTP_400_BAD_REQUEST, "Failed to create announcement")
    
    # 获取创建后的数据
    announcement_id = response.data[0]['id']
    detail_response = (
      supabase.table('announcements')
      .select('id, title, content, created_by, is_active, priority, created_at, updated_at, admins!created_by(id, username)')
      .eq('id', announcement_id)
      .single()
      .execute()
    )
    
    if hasattr(detail_response, 'error') or not detail_response.data:
      raise HTTPException(status.HTTP_404_NOT_FOUND, "Announcement not found after creation")
    
    item = detail_response.data
    
    # 处理作者信息
    author_data = {}
    if item.get('admins'):
      admin_data = item['admins']
      if isinstance(admin_data, list) and len(admin_data) > 0:
        admin_data = admin_data[0]
      author_data = {
        'id': admin_data.get('id'),
        'username': admin_data.get('username'),
      }
    
    # 处理时间字段
    created_at = item.get('created_at')
    if created_at and isinstance(created_at, str):
      try:
        if created_at.endswith('Z'):
          created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        else:
          created_at = datetime.fromisoformat(created_at)
      except (ValueError, AttributeError):
        created_at = datetime.now()
    elif not isinstance(created_at, datetime):
      created_at = datetime.now()
    
    updated_at = item.get('updated_at')
    if updated_at and isinstance(updated_at, str):
      try:
        if updated_at.endswith('Z'):
          updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
        else:
          updated_at = datetime.fromisoformat(updated_at)
      except (ValueError, AttributeError):
        updated_at = None
    
    return AnnouncementResponse(
      id=str(item['id']),
      title=str(item['title']),
      content=str(item['content']),
      created_by=str(item['created_by']),
      is_active=bool(item.get('is_active', True)),
      priority=int(item.get('priority', 0)),
      created_at=created_at,
      updated_at=updated_at,
      author=Author(**author_data) if author_data else None,
    )
  except HTTPException:
    raise
  except Exception as e:
    print(f"Error in create_announcement: {e}")
    import traceback
    print(traceback.format_exc())
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to create announcement: {str(e)}")


@router.patch('/{announcement_id}', response_model=AnnouncementResponse)
async def update_announcement(
  announcement_id: str,
  payload: AnnouncementUpdate,
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_admin_user),
):
  """Update an announcement (admin only)"""
  try:
    update_payload = {}
    
    if payload.title is not None:
      update_payload['title'] = payload.title.strip()
    if payload.content is not None:
      update_payload['content'] = payload.content.strip()
    if payload.priority is not None:
      update_payload['priority'] = payload.priority
    if payload.is_active is not None:
      update_payload['is_active'] = payload.is_active
    
    if not update_payload:
      raise HTTPException(status.HTTP_400_BAD_REQUEST, "No fields to update")
    
    response = (
      supabase.table('announcements')
      .update(update_payload)
      .eq('id', announcement_id)
      .execute()
    )
    
    if hasattr(response, 'error') and response.error:
      error_msg = response.error
      if isinstance(response.error, dict):
        error_msg = response.error.get('message', str(response.error))
      raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Failed to update announcement: {error_msg}")
    
    # 获取更新后的数据
    detail_response = (
      supabase.table('announcements')
      .select('id, title, content, created_by, is_active, priority, created_at, updated_at, admins!created_by(id, username)')
      .eq('id', announcement_id)
      .single()
      .execute()
    )
    
    if hasattr(detail_response, 'error') or not detail_response.data:
      raise HTTPException(status.HTTP_404_NOT_FOUND, "Announcement not found")
    
    item = detail_response.data
    
    # 处理作者信息
    author_data = {}
    if item.get('admins'):
      admin_data = item['admins']
      if isinstance(admin_data, list) and len(admin_data) > 0:
        admin_data = admin_data[0]
      author_data = {
        'id': admin_data.get('id'),
        'username': admin_data.get('username'),
      }
    
    # 处理时间字段
    created_at = item.get('created_at')
    if created_at and isinstance(created_at, str):
      try:
        if created_at.endswith('Z'):
          created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        else:
          created_at = datetime.fromisoformat(created_at)
      except (ValueError, AttributeError):
        created_at = datetime.now()
    elif not isinstance(created_at, datetime):
      created_at = datetime.now()
    
    updated_at = item.get('updated_at')
    if updated_at and isinstance(updated_at, str):
      try:
        if updated_at.endswith('Z'):
          updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
        else:
          updated_at = datetime.fromisoformat(updated_at)
      except (ValueError, AttributeError):
        updated_at = None
    
    return AnnouncementResponse(
      id=str(item['id']),
      title=str(item['title']),
      content=str(item['content']),
      created_by=str(item['created_by']),
      is_active=bool(item.get('is_active', True)),
      priority=int(item.get('priority', 0)),
      created_at=created_at,
      updated_at=updated_at,
      author=Author(**author_data) if author_data else None,
    )
  except HTTPException:
    raise
  except Exception as e:
    print(f"Error in update_announcement: {e}")
    import traceback
    print(traceback.format_exc())
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to update announcement: {str(e)}")


@router.delete('/{announcement_id}', status_code=status.HTTP_204_NO_CONTENT)
async def delete_announcement(
  announcement_id: str,
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_admin_user),
):
  """Delete an announcement (admin only)"""
  try:
    response = (
      supabase.table('announcements')
      .delete()
      .eq('id', announcement_id)
      .execute()
    )
    
    if hasattr(response, 'error') and response.error:
      error_msg = response.error
      if isinstance(response.error, dict):
        error_msg = response.error.get('message', str(response.error))
      raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Failed to delete announcement: {error_msg}")
    
    return None
  except HTTPException:
    raise
  except Exception as e:
    print(f"Error in delete_announcement: {e}")
    import traceback
    print(traceback.format_exc())
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to delete announcement: {str(e)}")

