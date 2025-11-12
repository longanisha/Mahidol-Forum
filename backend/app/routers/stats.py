from datetime import datetime, timedelta
from typing import Dict, List

from fastapi import APIRouter, HTTPException
from ..dependencies import SupabaseClientDep
from ..schemas import UserProfile

router = APIRouter(prefix='/stats', tags=['stats'])


@router.get('/community')
async def get_community_stats(supabase: SupabaseClientDep):
  """Get public community statistics (no authentication required)"""
  try:
    # Calculate date ranges
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)
    
    # Get total active members (users who have created posts or replies in the last 30 days)
    # We'll count distinct user_ids from posts and replies created in the last 30 days
    posts_month_resp = supabase.table('posts').select('author_id').gte('created_at', month_ago.isoformat()).execute()
    replies_month_resp = supabase.table('post_replies').select('author_id').gte('created_at', month_ago.isoformat()).execute()
    
    # Get unique active user IDs
    active_user_ids = set()
    if posts_month_resp.data:
      for post in posts_month_resp.data:
        if post.get('author_id'):
          active_user_ids.add(post['author_id'])
    if replies_month_resp.data:
      for reply in replies_month_resp.data:
        if reply.get('author_id'):
          active_user_ids.add(reply['author_id'])
    
    active_members = len(active_user_ids)
    
    # Get posts created this week
    posts_week_resp = supabase.table('posts').select('id', count='exact').gte('created_at', week_ago.isoformat()).execute()
    
    # Handle count response
    if hasattr(posts_week_resp, 'count') and posts_week_resp.count is not None:
      posts_this_week = posts_week_resp.count
    else:
      # Fallback: count the data array
      posts_this_week = len(posts_week_resp.data or [])
    
    return {
      'active_members': active_members,
      'threads_this_week': posts_this_week,  # Keep field name for backward compatibility
    }
  except Exception as e:
    print(f"Error getting community stats: {e}")
    import traceback
    print(traceback.format_exc())
    # Return default values on error
    return {
      'active_members': 0,
      'threads_this_week': 0,  # Keep field name for backward compatibility
    }


@router.get('/top-users', response_model=List[UserProfile])
async def get_top_users(supabase: SupabaseClientDep, limit: int = 5):
  """Get top users by points (public endpoint, no authentication required)"""
  try:
    # 获取所有管理员 ID（从 admins 表和 profiles 表）
    admin_ids = set()
    
    # 从 admins 表获取管理员 ID
    try:
      admins_resp = (
        supabase.table('admins')
        .select('id')
        .eq('is_active', True)
        .execute()
      )
      if not (hasattr(admins_resp, 'error') and admins_resp.error):
        if admins_resp.data:
          for admin in admins_resp.data:
            admin_ids.add(str(admin['id']))
    except Exception:
      pass
    
    # 从 profiles 表获取管理员 ID（role 为 admin, moderator, superadmin）
    try:
      admin_profiles_resp = (
        supabase.table('profiles')
        .select('id, role')
        .in_('role', ['admin', 'moderator', 'superadmin'])
        .execute()
      )
      if not (hasattr(admin_profiles_resp, 'error') and admin_profiles_resp.error):
        if admin_profiles_resp.data:
          for profile in admin_profiles_resp.data:
            admin_ids.add(str(profile['id']))
    except Exception:
      pass
    
    # 查询用户，排除管理员
    try:
      query = (
        supabase.table('profiles')
        .select('id, username, created_at, total_points, level, avatar_url')
      )
      
      # 如果排除管理员，添加过滤条件
      if admin_ids:
        query = query.not_.in_('id', list(admin_ids))
      
      response = query.order('total_points', desc=True).limit(limit).execute()
    except Exception as e:
      print(f"Warning: Failed to query with total_points, trying without: {e}")
      # 如果查询失败，尝试不包含这些列
      try:
        query = (
          supabase.table('profiles')
          .select('id, username, created_at')
        )
        
        if admin_ids:
          query = query.not_.in_('id', list(admin_ids))
        
        response = query.order('created_at', desc=True).limit(limit).execute()
      except Exception as e2:
        print(f"Error querying profiles: {e2}")
        return []
    
    if hasattr(response, 'error') and response.error:
      error_msg = response.error
      if isinstance(response.error, dict):
        error_msg = response.error.get('message', str(response.error))
      print(f"Error fetching top users: {error_msg}")
      return []
    
    items = response.data or []
    result = []
    
    for item in items:
      # 再次检查是否是管理员（双重保险）
      user_id = str(item['id'])
      if user_id in admin_ids:
        continue
      
      # 检查 role 字段（如果存在）
      role = item.get('role')
      if role in ('admin', 'moderator', 'superadmin'):
        continue
      
      # 安全地获取 total_points 和 level
      total_points = item.get('total_points')
      if total_points is None:
        total_points = 0
      elif not isinstance(total_points, int):
        try:
          total_points = int(total_points) if total_points else 0
        except (ValueError, TypeError):
          total_points = 0
      
      level = item.get('level')
      if level is None:
        level = 1
      elif not isinstance(level, int):
        try:
          level = int(level) if level else 1
        except (ValueError, TypeError):
          level = 1
      
      result.append(UserProfile(
        id=user_id,
        username=item.get('username'),
        email=None,  # 不返回 email 以保护隐私
        avatar_url=item.get('avatar_url'),
        total_points=total_points,
        level=level,
        created_at=item['created_at'],
      ))
    
    # 按积分降序排序（确保顺序正确）
    result.sort(key=lambda x: x.total_points, reverse=True)
    
    return result[:limit]
  except Exception as e:
    print(f"Error getting top users: {e}")
    import traceback
    print(traceback.format_exc())
    return []

