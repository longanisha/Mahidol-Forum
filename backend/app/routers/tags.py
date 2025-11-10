from typing import List, Optional, Dict, Any
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from ..auth import AuthenticatedUser, get_admin_user
from ..dependencies import SupabaseClientDep
from ..schemas import HotTag


class TagRenameRequest(BaseModel):
  old_tag: str
  new_tag: str


class TagMergeRequest(BaseModel):
  source_tags: List[str]
  target_tag: str

router = APIRouter(prefix='/admin/tags', tags=['admin-tags'])


def _is_admin(user: AuthenticatedUser, supabase: SupabaseClientDep) -> bool:
  """Check if user is admin, moderator, or superadmin"""
  try:
    # 首先检查是否是 admins 表中的 admin
    admin_resp = (
      supabase.table('admins')
      .select('id, is_active')
      .eq('id', user.id)
      .eq('is_active', True)
      .execute()
    )
    if not (hasattr(admin_resp, 'error') and admin_resp.error):
      if admin_resp.data and len(admin_resp.data) > 0:
        return True
    
    # 检查是否是 profiles 表中的 admin/moderator/superadmin
    profile_resp = (
      supabase.table('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
      .execute()
    )
    if hasattr(profile_resp, 'error') and profile_resp.error:
      return False
    role = profile_resp.data.get('role') if profile_resp.data else None
    return role in ('admin', 'moderator', 'superadmin')
  except Exception:
    return False


@router.get('/', response_model=List[HotTag])
async def list_tags(
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_admin_user),
  limit: int = 1000,
):
  """List all tags with their usage counts (admin only)"""
  if not _is_admin(user, supabase):
    raise HTTPException(status.HTTP_403_FORBIDDEN, 'Admin access required')
  
  try:
    print(f"[LIST_TAGS] Starting to fetch tags for admin user {user.id}")
    # 获取所有posts的tags
    response = (
      supabase.table('posts')
      .select('id, tags')
      .execute()
    )
    
    print(f"[LIST_TAGS] Posts query response received")
    print(f"[LIST_TAGS] Response has error: {hasattr(response, 'error') and response.error}")
    print(f"[LIST_TAGS] Response data is None: {response.data is None}")
    
    if hasattr(response, 'error') and response.error:
      error_msg = response.error
      if isinstance(response.error, dict):
        error_msg = response.error.get('message', str(response.error))
      print(f"[LIST_TAGS] Supabase error: {error_msg}")
      raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Database error: {error_msg}")
    
    if response.data is None:
      print(f"[LIST_TAGS] Response data is None, returning empty list")
      return []
    
    tag_counts: Dict[str, int] = {}
    items = response.data or []
    print(f"[LIST_TAGS] Found {len(items)} posts")
    
    for item in items:
      tags = item.get('tags')
      if tags and isinstance(tags, list):
        for tag in tags:
          if tag and isinstance(tag, str):
            tag = tag.strip()
            if tag:
              tag_counts[tag] = tag_counts.get(tag, 0) + 1
    
    print(f"[LIST_TAGS] Found {len(tag_counts)} unique tags")
    print(f"[LIST_TAGS] Tag counts: {tag_counts}")
    
    # 按使用次数降序排序
    sorted_tags = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)[:limit]
    result = [HotTag(tag=tag, count=count) for tag, count in sorted_tags]
    print(f"[LIST_TAGS] Returning {len(result)} tags")
    return result
  except HTTPException:
    raise
  except Exception as e:
    import traceback
    print(f"[LIST_TAGS] Error in list_tags: {e}")
    print(traceback.format_exc())
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to fetch tags: {str(e)}")


@router.put('/rename')
async def rename_tag(
  payload: TagRenameRequest,
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_admin_user),
):
  """Rename a tag across all posts (admin only)"""
  if not _is_admin(user, supabase):
    raise HTTPException(status.HTTP_403_FORBIDDEN, 'Admin access required')
  
  if not payload.old_tag or not payload.old_tag.strip():
    raise HTTPException(status.HTTP_400_BAD_REQUEST, 'Old tag name is required')
  
  if not payload.new_tag or not payload.new_tag.strip():
    raise HTTPException(status.HTTP_400_BAD_REQUEST, 'New tag name is required')
  
  old_tag = payload.old_tag.strip()
  new_tag = payload.new_tag.strip()
  
  if old_tag == new_tag:
    raise HTTPException(status.HTTP_400_BAD_REQUEST, 'Old and new tag names must be different')
  
  try:
    # 获取所有包含该tag的posts
    response = (
      supabase.table('posts')
      .select('id, tags')
      .execute()
    )
    
    if response.data is None:
      return {'success': True, 'updated': 0}
    
    updated_count = 0
    items = response.data or []
    
    for item in items:
      tags = item.get('tags')
      if tags and isinstance(tags, list):
        # 检查是否包含old_tag
        if old_tag in tags:
          # 替换tag
          new_tags = [new_tag if tag == old_tag else tag for tag in tags]
          # 去重
          new_tags = list(dict.fromkeys(new_tags))
          
          # 更新post
          update_response = (
            supabase.table('posts')
            .update({'tags': new_tags})
            .eq('id', item['id'])
            .execute()
          )
          
          if not (hasattr(update_response, 'error') and update_response.error):
            updated_count += 1
    
    return {'success': True, 'updated': updated_count, 'old_tag': old_tag, 'new_tag': new_tag}
  except HTTPException:
    raise
  except Exception as e:
    import traceback
    print(f"Error in rename_tag: {e}")
    print(traceback.format_exc())
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to rename tag: {str(e)}")


@router.delete('/{tag_name}')
async def delete_tag(
  tag_name: str,
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_admin_user),
):
  """Delete a tag from all posts (admin only)"""
  if not _is_admin(user, supabase):
    raise HTTPException(status.HTTP_403_FORBIDDEN, 'Admin access required')
  
  if not tag_name or not tag_name.strip():
    raise HTTPException(status.HTTP_400_BAD_REQUEST, 'Tag name is required')
  
  tag_name = tag_name.strip()
  
  try:
    # 获取所有包含该tag的posts
    response = (
      supabase.table('posts')
      .select('id, tags')
      .execute()
    )
    
    if response.data is None:
      return {'success': True, 'updated': 0}
    
    updated_count = 0
    items = response.data or []
    
    for item in items:
      tags = item.get('tags')
      if tags and isinstance(tags, list):
        # 检查是否包含tag_name
        if tag_name in tags:
          # 移除tag
          new_tags = [tag for tag in tags if tag != tag_name]
          
          # 更新post（如果tags为空，设为None）
          update_data = {'tags': new_tags if new_tags else None}
          update_response = (
            supabase.table('posts')
            .update(update_data)
            .eq('id', item['id'])
            .execute()
          )
          
          if not (hasattr(update_response, 'error') and update_response.error):
            updated_count += 1
    
    return {'success': True, 'updated': updated_count, 'tag': tag_name}
  except HTTPException:
    raise
  except Exception as e:
    import traceback
    print(f"Error in delete_tag: {e}")
    print(traceback.format_exc())
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to delete tag: {str(e)}")


@router.post('/merge')
async def merge_tags(
  payload: TagMergeRequest,
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_admin_user),
):
  """Merge multiple tags into one tag (admin only)"""
  if not _is_admin(user, supabase):
    raise HTTPException(status.HTTP_403_FORBIDDEN, 'Admin access required')
  
  if not payload.source_tags or len(payload.source_tags) == 0:
    raise HTTPException(status.HTTP_400_BAD_REQUEST, 'Source tags are required')
  
  if not payload.target_tag or not payload.target_tag.strip():
    raise HTTPException(status.HTTP_400_BAD_REQUEST, 'Target tag name is required')
  
  target_tag = payload.target_tag.strip()
  source_tags = [tag.strip() for tag in payload.source_tags if tag and tag.strip()]
  
  if not source_tags:
    raise HTTPException(status.HTTP_400_BAD_REQUEST, 'At least one valid source tag is required')
  
  try:
    # 获取所有包含source tags的posts
    response = (
      supabase.table('posts')
      .select('id, tags')
      .execute()
    )
    
    if response.data is None:
      return {'success': True, 'updated': 0}
    
    updated_count = 0
    items = response.data or []
    
    for item in items:
      tags = item.get('tags')
      if tags and isinstance(tags, list):
        # 检查是否包含任何source tag
        has_source_tag = any(tag in source_tags for tag in tags)
        
        if has_source_tag:
          # 移除所有source tags，添加target tag
          new_tags = [tag for tag in tags if tag not in source_tags]
          if target_tag not in new_tags:
            new_tags.append(target_tag)
          
          # 更新post
          update_response = (
            supabase.table('posts')
            .update({'tags': new_tags})
            .eq('id', item['id'])
            .execute()
          )
          
          if not (hasattr(update_response, 'error') and update_response.error):
            updated_count += 1
    
    return {'success': True, 'updated': updated_count, 'source_tags': source_tags, 'target_tag': target_tag}
  except HTTPException:
    raise
  except Exception as e:
    import traceback
    print(f"Error in merge_tags: {e}")
    print(traceback.format_exc())
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to merge tags: {str(e)}")

