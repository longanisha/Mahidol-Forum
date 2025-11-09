from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status

from ..auth import AuthenticatedUser, get_current_user
from ..dependencies import SupabaseClientDep
from ..schemas import PointRecord, ProfileUpdate, UserProfile

router = APIRouter(prefix='/points', tags=['points'])


@router.get('/profile', response_model=UserProfile)
async def get_user_profile(
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_current_user),
):
  """Get user profile with timeout protection"""
  import asyncio
  import sys
  
  def _query_profile():
    """同步查询函数"""
    try:
      # 尝试查询所有字段（包括可能不存在的字段）
      profile_resp = (
        supabase.table('profiles')
        .select('id, username, created_at, total_points, level, avatar_url')
        .eq('id', user.id)
        .single()
        .execute()
      )
      
      if hasattr(profile_resp, 'error') and profile_resp.error:
        error_msg = profile_resp.error
        if isinstance(profile_resp.error, dict):
          error_msg = profile_resp.error.get('message', str(profile_resp.error))
        
        # 如果错误是因为某些列不存在，尝试不包含这些列
        if 'column' in str(error_msg).lower() or 'does not exist' in str(error_msg).lower():
          print(f"Warning: Some columns may not exist, trying without them: {error_msg}")
          profile_resp = (
            supabase.table('profiles')
            .select('id, username, created_at')
            .eq('id', user.id)
            .single()
            .execute()
          )
          
          if hasattr(profile_resp, 'error') and profile_resp.error:
            raise Exception(f"Profile query failed: {profile_resp.error}")
          
          profile = profile_resp.data
          return {
            'id': profile['id'],
            'username': profile.get('username'),
            'avatar_url': None,
            'total_points': 0,
            'level': 1,
            'created_at': profile['created_at'],
          }
        else:
          raise Exception(f"Profile query failed: {error_msg}")
      
      profile = profile_resp.data
      return {
        'id': profile['id'],
        'username': profile.get('username'),
        'avatar_url': profile.get('avatar_url'),
        'total_points': profile.get('total_points', 0) or 0,
        'level': profile.get('level', 1) or 1,
        'created_at': profile['created_at'],
      }
    except Exception as e:
      print(f"get_user_profile: Query error: {e}")
      raise
  
  try:
    # 使用 asyncio.to_thread 包装同步调用，设置 2 秒超时（更快返回，不阻塞页面）
    if sys.version_info >= (3, 9):
      profile_data = await asyncio.wait_for(
        asyncio.to_thread(_query_profile),
        timeout=2.0
      )
    else:
      loop = asyncio.get_event_loop()
      profile_data = await asyncio.wait_for(
        loop.run_in_executor(None, _query_profile),
        timeout=2.0
      )
    
    return UserProfile(**profile_data)
  except asyncio.TimeoutError:
    print("get_user_profile: Query timed out after 2 seconds, returning default values")
    # 超时时返回默认值，不阻塞页面
    return UserProfile(
      id=user.id,
      username=None,
      email=None,
      avatar_url=None,
      total_points=0,
      level=1,
      role='user',
      created_at=datetime.utcnow(),
    )
  except HTTPException:
    raise
  except Exception as e:
    error_msg = str(e)
    print(f"Error in get_user_profile: {error_msg}")
    import traceback
    print(traceback.format_exc())
    
    # 发生错误时也返回默认值，不阻塞页面
    if 'timeout' in error_msg.lower() or 'timed out' in error_msg.lower():
      return UserProfile(
        id=user.id,
        username=None,
        email=None,
        avatar_url=None,
        total_points=0,
        level=1,
        role='user',
        created_at=datetime.utcnow(),
      )
    
    # 其他错误也返回默认值，确保页面可以显示
    return UserProfile(
      id=user.id,
      username=None,
      email=None,
      avatar_url=None,
      total_points=0,
      level=1,
      role='user',
      created_at=datetime.utcnow(),
    )


@router.get('/ranking', response_model=dict)
async def get_user_ranking(
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_current_user),
):
  """Get current user's ranking based on total_points with timeout protection"""
  import asyncio
  import sys
  
  def _query_ranking():
    """同步查询函数"""
    try:
      # 查询用户积分
      profile_resp = (
        supabase.table('profiles')
        .select('total_points')
        .eq('id', user.id)
        .single()
        .execute()
      )
      
      if hasattr(profile_resp, 'error') and profile_resp.error:
        error_msg = profile_resp.error
        if isinstance(profile_resp.error, dict):
          error_msg = profile_resp.error.get('message', str(profile_resp.error))
        
        # 如果 total_points 列不存在，返回默认值
        if 'total_points' in str(error_msg) or 'column' in str(error_msg).lower():
          # 只查询总用户数
          try:
            total_users_resp = (
              supabase.table('profiles')
              .select('id', count='exact')
              .execute()
            )
            total_users = total_users_resp.count if hasattr(total_users_resp, 'count') and total_users_resp.count is not None else 0
          except Exception:
            total_users = 0
          
          return {
            'ranking': 0,
            'total_users': total_users,
            'total_points': 0,
          }
        raise Exception(f"Profile query failed: {error_msg}")
      
      user_points = profile_resp.data.get('total_points', 0) or 0
      
      # 查询排名更高的用户数
      try:
        higher_rank_resp = (
          supabase.table('profiles')
          .select('id', count='exact')
          .gt('total_points', user_points)
          .execute()
        )
        higher_count = higher_rank_resp.count if hasattr(higher_rank_resp, 'count') and higher_rank_resp.count is not None else 0
      except Exception as e:
        print(f"get_user_ranking: Error counting higher ranks: {e}")
        higher_count = 0
      
      # 查询总用户数
      try:
        total_users_resp = (
          supabase.table('profiles')
          .select('id', count='exact')
          .execute()
        )
        total_users = total_users_resp.count if hasattr(total_users_resp, 'count') and total_users_resp.count is not None else 0
      except Exception as e:
        print(f"get_user_ranking: Error getting total users: {e}")
        total_users = 0
      
      ranking = higher_count + 1 if total_users > 0 else 0
      
      return {
        'ranking': ranking,
        'total_users': total_users,
        'total_points': user_points,
      }
    except Exception as e:
      print(f"get_user_ranking: Query error: {e}")
      raise
  
  try:
    # 使用 asyncio.to_thread 包装同步调用，设置 2 秒超时（更快返回，不阻塞页面）
    if sys.version_info >= (3, 9):
      ranking_data = await asyncio.wait_for(
        asyncio.to_thread(_query_ranking),
        timeout=2.0
      )
    else:
      loop = asyncio.get_event_loop()
      ranking_data = await asyncio.wait_for(
        loop.run_in_executor(None, _query_ranking),
        timeout=2.0
      )
    
    return ranking_data
  except asyncio.TimeoutError:
    print("get_user_ranking: Query timed out after 2 seconds, returning default values")
    # 超时时返回默认值，不阻塞页面
    return {
      'ranking': 0,
      'total_users': 0,
      'total_points': 0,
    }
  except HTTPException:
    raise
  except Exception as e:
    error_msg = str(e)
    print(f"Error in get_user_ranking: {error_msg}")
    import traceback
    print(traceback.format_exc())
    
    # 发生错误时也返回默认值，不阻塞页面
    if 'timeout' in error_msg.lower() or 'timed out' in error_msg.lower():
      return {
        'ranking': 0,
        'total_users': 0,
        'total_points': 0,
      }
    
    # 其他错误也返回默认值，确保页面可以显示
    return {
      'ranking': 0,
      'total_users': 0,
      'total_points': 0,
    }


@router.patch('/profile', response_model=UserProfile)
async def update_user_profile(
  payload: ProfileUpdate,
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_current_user),
):
  """Update user profile (username and avatar_url)"""
  import asyncio
  
  try:
    update_data = {}
    if payload.username is not None:
      update_data['username'] = payload.username.strip() if payload.username else None
    if payload.avatar_url is not None:
      update_data['avatar_url'] = payload.avatar_url.strip() if payload.avatar_url else None
    
    if not update_data:
      raise HTTPException(status.HTTP_400_BAD_REQUEST, 'No fields to update')
    
    print(f"[Profile Update] Updating profile for user {user.id}, data: {update_data}")
    
    # 先执行更新（添加超时保护）
    def _update_profile():
      return supabase.table('profiles').update(update_data).eq('id', user.id).execute()
    
    try:
      import sys
      if sys.version_info >= (3, 9):
        update_response = await asyncio.wait_for(
          asyncio.to_thread(_update_profile),
          timeout=10.0
        )
      else:
        loop = asyncio.get_event_loop()
        update_response = await asyncio.wait_for(
          loop.run_in_executor(None, _update_profile),
          timeout=10.0
        )
    except asyncio.TimeoutError:
      print("Profile update timeout: update operation timed out after 10 seconds")
      raise HTTPException(status.HTTP_408_REQUEST_TIMEOUT, 'Update operation timed out. Please try again.')
    
    if hasattr(update_response, 'error') and update_response.error:
      error_msg = update_response.error
      if isinstance(update_response.error, dict):
        error_msg = update_response.error.get('message', str(update_response.error))
      
      print(f"[Profile Update] Error: {error_msg}")
      print(f"[Profile Update] Error type: {type(update_response.error)}")
      print(f"[Profile Update] Full error object: {update_response.error}")
      
      # 如果错误是因为 avatar_url 列不存在
      error_str = str(error_msg).lower()
      if 'avatar_url' in error_str and ('column' in error_str or 'does not exist' in error_str):
        print(f"Warning: avatar_url column may not exist: {error_msg}")
        # 如果只有 avatar_url 要更新，返回明确的错误信息
        if 'username' not in update_data or not update_data.get('username'):
          raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            'Avatar URL column does not exist in database. Please contact administrator to add the avatar_url column to the profiles table.'
          )
        # 如果有 username，尝试只更新 username
        print(f"[Profile Update] Attempting to update username only (avatar_url column missing)")
        username_only_data = {'username': update_data['username']}
        def _update_username_only():
          return supabase.table('profiles').update(username_only_data).eq('id', user.id).execute()
        
        try:
          if sys.version_info >= (3, 9):
            update_response = await asyncio.wait_for(
              asyncio.to_thread(_update_username_only),
              timeout=10.0
            )
          else:
            loop = asyncio.get_event_loop()
            update_response = await asyncio.wait_for(
              loop.run_in_executor(None, _update_username_only),
              timeout=10.0
            )
          
          if hasattr(update_response, 'error') and update_response.error:
            error_msg = update_response.error
            if isinstance(update_response.error, dict):
              error_msg = update_response.error.get('message', str(update_response.error))
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Failed to update profile: {error_msg}")
        except asyncio.TimeoutError:
          print("Profile update timeout: username-only update timed out after 10 seconds")
          raise HTTPException(status.HTTP_408_REQUEST_TIMEOUT, 'Update operation timed out. Please try again.')
      else:
        # 其他错误直接抛出
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Failed to update profile: {error_msg}")
    
    # 优化：如果更新返回了数据，直接使用；否则再查询
    if hasattr(update_response, 'data') and update_response.data and len(update_response.data) > 0:
      profile = update_response.data[0]
      print(f"[Profile Update] Update returned data, avatar_url: {profile.get('avatar_url', 'N/A')}")
    else:
      # 如果更新没有返回数据，再查询一次（添加超时保护）
      # 尝试包含 avatar_url
      def _get_profile():
        return supabase.table('profiles').select('id, username, avatar_url, created_at, total_points, level').eq('id', user.id).single().execute()
      
      print(f"[Profile Update] Update did not return data, querying profile...")
      
      try:
        if sys.version_info >= (3, 9):
          profile_response = await asyncio.wait_for(
            asyncio.to_thread(_get_profile),
            timeout=10.0
          )
        else:
          loop = asyncio.get_event_loop()
          profile_response = await asyncio.wait_for(
            loop.run_in_executor(None, _get_profile),
            timeout=10.0
          )
      except asyncio.TimeoutError:
        print("Profile update timeout: query operation timed out after 10 seconds")
        raise HTTPException(status.HTTP_408_REQUEST_TIMEOUT, 'Query operation timed out. Please try again.')
      
      if hasattr(profile_response, 'error') and profile_response.error:
        error_msg = profile_response.error
        if isinstance(profile_response.error, dict):
          error_msg = profile_response.error.get('message', str(profile_response.error))
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Profile not found: {error_msg}")
      
      if not profile_response.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, 'Profile not found')
      
      profile = profile_response.data
    
    # 安全地获取 avatar_url
    avatar_url = None
    try:
      avatar_url = profile.get('avatar_url')
    except (KeyError, AttributeError):
      pass
    
    return UserProfile(
      id=profile['id'],
      username=profile.get('username'),
      avatar_url=avatar_url,
      total_points=profile.get('total_points', 0) or 0,
      level=profile.get('level', 1) or 1,
      created_at=profile['created_at'],
    )
  except HTTPException:
    raise
  except asyncio.TimeoutError:
    raise HTTPException(status.HTTP_408_REQUEST_TIMEOUT, 'Operation timed out. Please try again.')
  except Exception as e:
    error_msg = str(e)
    print(f"Error updating profile: {error_msg}")
    import traceback
    print(traceback.format_exc())
    
    # 检查是否是超时错误
    if 'timeout' in error_msg.lower() or 'timed out' in error_msg.lower():
      raise HTTPException(status.HTTP_408_REQUEST_TIMEOUT, 'Operation timed out. Please try again.')
    
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to update profile: {error_msg}")


@router.get('/history', response_model=List[PointRecord])
async def get_point_history(
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_current_user),
  limit: int = 50,
):
  try:
    response = (
      supabase.table('point_records')
      .select('id, user_id, points, reason, created_at')
      .eq('user_id', user.id)
      .order('created_at', desc=True)
      .limit(limit)
      .execute()
    )
    if hasattr(response, 'error') and response.error:
      print(f"Error fetching point history: {response.error}")
      return []
    return [PointRecord(**item) for item in (response.data or [])]
  except Exception as e:
    print(f"Error in get_point_history: {e}")
    import traceback
    print(traceback.format_exc())
    return []


def award_points(
  supabase: SupabaseClientDep,
  user_id: str,
  points: int,
  reason: str,
):
  record_resp = supabase.table('point_records').insert({
    'user_id': user_id,
    'points': points,
    'reason': reason,
  }).select('id').single()

  if record_resp.error:
    return

  profile_resp = (
    supabase.table('profiles')
    .select('total_points')
    .eq('id', user_id)
    .single()
  )
  if profile_resp.error:
    return

  current_points = profile_resp.data.get('total_points', 0)
  new_total = current_points + points
  new_level = min(10, 1 + (new_total // 100))

  supabase.table('profiles').update({
    'total_points': new_total,
    'level': new_level,
  }).eq('id', user_id).execute()

