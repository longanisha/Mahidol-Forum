from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import requests

from fastapi import APIRouter, Depends, HTTPException, status

from ..auth import AuthenticatedUser, get_current_user, get_optional_user, get_admin_user
from ..dependencies import SupabaseClientDep
from ..schemas import UserProfile, UserCreate, UserUpdate, PaginatedApplicationResponse, LineGroupApplicationResponse, Author
from ..config import get_settings
from passlib.context import CryptContext

router = APIRouter(prefix='/admin', tags=['admin'])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


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
        return True  # 是 admins 表中的 admin
    
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


@router.get('/users', response_model=List[UserProfile])
async def list_users(
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_admin_user),
  limit: int = 100,
  exclude_admins: bool = True,  # 默认排除管理员
):
  if not _is_admin(user, supabase):
    raise HTTPException(status.HTTP_403_FORBIDDEN, 'Admin access required')

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
    except Exception as e:
      print(f"Warning: Failed to fetch admins: {e}")
    
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
    except Exception as e:
      print(f"Warning: Failed to fetch admin profiles: {e}")
      # 如果 role 列不存在，尝试查询所有 profiles 然后过滤
      try:
        all_profiles_resp = (
          supabase.table('profiles')
          .select('id, role')
          .execute()
        )
        if not (hasattr(all_profiles_resp, 'error') and all_profiles_resp.error):
          if all_profiles_resp.data:
            for profile in all_profiles_resp.data:
              role = profile.get('role')
              if role in ('admin', 'moderator', 'superadmin'):
                admin_ids.add(str(profile['id']))
      except Exception as e2:
        print(f"Warning: Failed to fetch all profiles for admin check: {e2}")
    
    # 尝试查询包含 total_points 和 level 的字段
    response = None
    try:
      query = (
        supabase.table('profiles')
        .select('id, username, created_at, total_points, level, avatar_url, role')
      )
      
      # 如果排除管理员，添加过滤条件
      if exclude_admins and admin_ids:
        # 排除管理员 ID
        query = query.not_.in_('id', list(admin_ids))
      
      response = query.order('created_at', desc=True).limit(limit).execute()
    except Exception as e:
      print(f"Warning: Failed to query with total_points/level, trying without: {e}")
      # 如果查询失败，尝试不包含这些列
      try:
        query = (
          supabase.table('profiles')
          .select('id, username, created_at, role')
        )
        
        # 如果排除管理员，添加过滤条件
        if exclude_admins and admin_ids:
          query = query.not_.in_('id', list(admin_ids))
        
        response = query.order('created_at', desc=True).limit(limit).execute()
      except Exception as e2:
        print(f"Error querying profiles: {e2}")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to fetch users: {str(e2)}")
    
    if hasattr(response, 'error') and response.error:
      error_msg = response.error
      if isinstance(response.error, dict):
        error_msg = response.error.get('message', str(response.error))
      
      # 如果错误是因为列不存在，尝试不包含这些列
      if 'column' in str(error_msg).lower() or 'does not exist' in str(error_msg).lower():
        print(f"Warning: Some columns may not exist, trying without them: {error_msg}")
        try:
          query = (
            supabase.table('profiles')
            .select('id, username, created_at')
          )
          
          # 如果排除管理员，添加过滤条件
          if exclude_admins and admin_ids:
            query = query.not_.in_('id', list(admin_ids))
          
          response = query.order('created_at', desc=True).limit(limit).execute()
          if hasattr(response, 'error') and response.error:
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to fetch users: {response.error}")
        except HTTPException:
          raise
        except Exception as e2:
          raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to fetch users: {str(e2)}")
      else:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to fetch users: {error_msg}")

    # 获取所有用户的 email（通过 Supabase Admin API）
    settings = get_settings()
    user_emails: Dict[str, str] = {}
    
    try:
      # 使用 Supabase Admin API 获取用户列表
      admin_api_url = f"{settings.supabase_url}/auth/v1/admin/users"
      headers = {
        'apikey': settings.supabase_service_key,
        'Authorization': f'Bearer {settings.supabase_service_key}',
        'Content-Type': 'application/json',
      }
      
      # 获取所有用户（最多 limit 个）
      admin_response = requests.get(
        admin_api_url,
        headers=headers,
        params={'per_page': limit},
        timeout=10
      )
      
      if admin_response.status_code == 200:
        admin_data = admin_response.json()
        if isinstance(admin_data, dict) and 'users' in admin_data:
          for user in admin_data['users']:
            user_id = user.get('id')
            email = user.get('email')
            if user_id and email:
              user_emails[user_id] = email
        elif isinstance(admin_data, list):
          for user in admin_data:
            user_id = user.get('id')
            email = user.get('email')
            if user_id and email:
              user_emails[user_id] = email
    except Exception as email_error:
      # 如果获取 email 失败，记录错误但继续处理（email 设为 None）
      print(f"Warning: Failed to fetch user emails: {email_error}")

    # 构建 UserProfile 对象，安全地获取可能不存在的字段
    users = []
    for item in (response.data or []):
      user_id = str(item['id'])
      
      # 如果排除管理员，再次检查（双重保险）
      if exclude_admins and user_id in admin_ids:
        continue
      
      # 检查 role 字段（如果存在）
      role = item.get('role')
      if exclude_admins and role in ('admin', 'moderator', 'superadmin'):
        continue
      
      # 安全地获取 total_points 和 level（如果列存在）
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
      
      users.append(UserProfile(
        id=user_id,
        username=item.get('username'),
        email=user_emails.get(user_id),  # 从 Admin API 获取的 email
        avatar_url=item.get('avatar_url'),  # 可能为 None
        total_points=total_points,
        level=level,
        created_at=item['created_at'],
      ))
    
    return users
  except HTTPException:
    raise
  except Exception as e:
    import traceback
    print(f"Error in list_users: {e}")
    print(traceback.format_exc())
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to fetch users: {str(e)}")


@router.patch('/posts/{post_id}/close')
async def admin_close_post(
  post_id: str,
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_admin_user),
):
  if not _is_admin(user, supabase):
    raise HTTPException(status.HTTP_403_FORBIDDEN, 'Admin access required')

  update_resp = (
    supabase.table('posts')
    .update({'is_closed': True})
    .eq('id', post_id)
    .select('id, title, is_closed')
    .limit(1)
    .execute()
  )
  if not update_resp.data or len(update_resp.data) == 0:
    raise HTTPException(status.HTTP_404_NOT_FOUND, 'Post not found')

  return {'success': True, 'post_id': post_id}


@router.post('/users', response_model=UserProfile, status_code=status.HTTP_201_CREATED)
async def create_user(
  payload: UserCreate,
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_admin_user),
):
  """Create a new user (admin only)"""
  if not _is_admin(user, supabase):
    raise HTTPException(status.HTTP_403_FORBIDDEN, 'Admin access required')

  try:
    settings = get_settings()
    
    # 使用 Supabase Admin API 创建用户
    admin_api_url = f"{settings.supabase_url}/auth/v1/admin/users"
    headers = {
      'apikey': settings.supabase_service_key,
      'Authorization': f'Bearer {settings.supabase_service_key}',
      'Content-Type': 'application/json',
    }
    
    create_payload = {
      'email': payload.email,
      'password': payload.password,
      'email_confirm': True,
      'user_metadata': {'username': payload.username},
    }
    
    admin_response = requests.post(
      admin_api_url,
      headers=headers,
      json=create_payload,
      timeout=10
    )
    
    if admin_response.status_code not in (200, 201):
      error_data = admin_response.json() if admin_response.content else {}
      error_msg = error_data.get('msg', error_data.get('message', 'Failed to create user'))
      raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Failed to create user: {error_msg}")
    
    auth_user = admin_response.json()
    user_id = auth_user.get('id')
    
    if not user_id:
      raise HTTPException(status.HTTP_400_BAD_REQUEST, "Failed to create user: No user ID returned")
    
    # 创建 profile
    profile_response = (
      supabase.table('profiles')
      .insert({
        'id': user_id,
        'username': payload.username,
      })
      .execute()
    )
    
    if hasattr(profile_response, 'error') and profile_response.error:
      error_msg = profile_response.error
      if isinstance(profile_response.error, dict):
        error_msg = profile_response.error.get('message', str(profile_response.error))
      print(f"Warning: Failed to create profile: {error_msg}")
    
    # 返回用户信息
    return UserProfile(
      id=user_id,
      username=payload.username,
      email=payload.email,
      avatar_url=None,
      total_points=0,
      level=1,
      created_at=datetime.now(),
    )
  except HTTPException:
    raise
  except Exception as e:
    import traceback
    print(f"Error in create_user: {e}")
    print(traceback.format_exc())
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to create user: {str(e)}")


@router.patch('/users/{user_id}', response_model=UserProfile)
async def update_user(
  user_id: str,
  payload: UserUpdate,
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_admin_user),
):
  """Update a user (admin only)"""
  if not _is_admin(user, supabase):
    raise HTTPException(status.HTTP_403_FORBIDDEN, 'Admin access required')

  try:
    settings = get_settings()
    
    # 更新 auth user (email/password)
    if payload.email or payload.password:
      admin_api_url = f"{settings.supabase_url}/auth/v1/admin/users/{user_id}"
      headers = {
        'apikey': settings.supabase_service_key,
        'Authorization': f'Bearer {settings.supabase_service_key}',
        'Content-Type': 'application/json',
      }
      
      update_payload = {}
      if payload.email:
        update_payload['email'] = payload.email
      if payload.password:
        update_payload['password'] = payload.password
      
      admin_response = requests.put(
        admin_api_url,
        headers=headers,
        json=update_payload,
        timeout=10
      )
      
      if admin_response.status_code not in (200, 201):
        error_data = admin_response.json() if admin_response.content else {}
        error_msg = error_data.get('msg', error_data.get('message', 'Failed to update user'))
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Failed to update user: {error_msg}")
    
    # 更新 profile (username, total_points)
    profile_update_data = {}
    if payload.username:
      profile_update_data['username'] = payload.username
    if payload.total_points is not None:
      profile_update_data['total_points'] = payload.total_points
      # 根据积分计算等级 (每 100 积分升一级，最高 10 级)
      new_level = min(10, 1 + (payload.total_points // 100))
      profile_update_data['level'] = new_level
    
    if profile_update_data:
      profile_response = (
        supabase.table('profiles')
        .update(profile_update_data)
        .eq('id', user_id)
        .execute()
      )
      
      if hasattr(profile_response, 'error') and profile_response.error:
        error_msg = profile_response.error
        if isinstance(profile_response.error, dict):
          error_msg = profile_response.error.get('message', str(profile_response.error))
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Failed to update profile: {error_msg}")
    
    # 获取更新后的用户信息
    profile_response = (
      supabase.table('profiles')
      .select('id, username, created_at, total_points, level')
      .eq('id', user_id)
      .limit(1)
      .execute()
    )
    
    if hasattr(profile_response, 'error') or not profile_response.data:
      raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    
    profile = profile_response.data[0]
    
    # 获取 email
    user_emails: Dict[str, str] = {}
    try:
      admin_api_url = f"{settings.supabase_url}/auth/v1/admin/users/{user_id}"
      headers = {
        'apikey': settings.supabase_service_key,
        'Authorization': f'Bearer {settings.supabase_service_key}',
        'Content-Type': 'application/json',
      }
      admin_response = requests.get(admin_api_url, headers=headers, timeout=10)
      if admin_response.status_code == 200:
        auth_user = admin_response.json()
        user_emails[user_id] = auth_user.get('email', '')
    except Exception:
      pass
    
    return UserProfile(
      id=user_id,
      username=profile.get('username'),
      email=user_emails.get(user_id),
      avatar_url=None,
      total_points=profile.get('total_points', 0),
      level=profile.get('level', 1),
      created_at=profile['created_at'],
    )
  except HTTPException:
    raise
  except Exception as e:
    import traceback
    print(f"Error in update_user: {e}")
    print(traceback.format_exc())
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to update user: {str(e)}")


@router.delete('/users/{user_id}', status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
  user_id: str,
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_admin_user),
):
  """Delete a user (admin only)"""
  if not _is_admin(user, supabase):
    raise HTTPException(status.HTTP_403_FORBIDDEN, 'Admin access required')

  try:
    settings = get_settings()
    
    admin_api_url = f"{settings.supabase_url}/auth/v1/admin/users/{user_id}"
    headers = {
      'apikey': settings.supabase_service_key,
      'Authorization': f'Bearer {settings.supabase_service_key}',
      'Content-Type': 'application/json',
    }
    
    # 先删除 profile（如果存在），忽略错误
    try:
      profile_response = (
        supabase.table('profiles')
        .delete()
        .eq('id', user_id)
        .execute()
      )
      print(f"[DELETE_USER] Profile deletion attempted for user {user_id}")
    except Exception as profile_error:
      print(f"[DELETE_USER] Warning: Failed to delete profile (may not exist): {profile_error}")
    
    # 删除 auth.users
    print(f"[DELETE_USER] Attempting to delete auth user {user_id}")
    admin_response = requests.delete(admin_api_url, headers=headers, timeout=10)
    
    print(f"[DELETE_USER] Delete response status: {admin_response.status_code}")
    
    if admin_response.status_code == 404:
      # 用户不存在，也认为是成功（可能已经被删除）
      print(f"[DELETE_USER] User {user_id} not found (may already be deleted)")
      return None
    elif admin_response.status_code in (200, 204):
      print(f"[DELETE_USER] User {user_id} deleted successfully")
      return None
    else:
      # 获取详细错误信息
      error_data = {}
      try:
        if admin_response.content:
          error_data = admin_response.json()
      except Exception:
        error_data = {'raw_response': admin_response.text[:200]}
      
      error_msg = error_data.get('msg') or error_data.get('message') or error_data.get('error') or str(error_data)
      print(f"[DELETE_USER] Error deleting user: status={admin_response.status_code}, error={error_msg}")
      
      # 如果是 400，返回更详细的错误信息
      if admin_response.status_code == 400:
        raise HTTPException(
          status.HTTP_400_BAD_REQUEST, 
          f"Failed to delete user: {error_msg or 'Bad request'}"
        )
      else:
        raise HTTPException(
          status.HTTP_500_INTERNAL_SERVER_ERROR,
          f"Failed to delete user: {error_msg or f'HTTP {admin_response.status_code}'}"
        )
    
  except HTTPException:
    raise
  except Exception as e:
    import traceback
    error_trace = traceback.format_exc()
    print(f"[DELETE_USER] Unexpected error: {e}")
    print(error_trace)
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to delete user: {str(e)}")


@router.get('/applications', response_model=PaginatedApplicationResponse)
async def list_all_applications(
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_admin_user),
  page: int = 1,
  page_size: int = 10,
  status_filter: Optional[str] = None,
):
  """List all applications with pagination (admin only), pending first"""
  if not _is_admin(user, supabase):
    raise HTTPException(status.HTTP_403_FORBIDDEN, 'Admin access required')

  try:
    if page < 1:
      page = 1
    if page_size < 1 or page_size > 100:
      page_size = 10
    
    # 构建查询
    query = (
      supabase.table('line_group_applications')
      .select('id, user_id, group_id, message, status, reviewed_by, reviewed_at, created_at, profiles!line_group_applications_user_id_fkey(id, username), line_groups!line_group_applications_group_id_fkey(id, name, description, qr_code_url, manager_id, is_active, member_count, created_at, updated_at)', count='exact')
    )
    
    if status_filter:
      query = query.eq('status', status_filter)
    
    # 先获取总数
    count_response = query.execute()
    total = count_response.count if hasattr(count_response, 'count') and count_response.count is not None else 0
    
    # 排序：pending 在前，然后按 created_at 降序
    # 由于 Supabase 不支持复杂的排序，我们需要先获取所有数据，然后在 Python 中排序
    all_response = query.execute()
    
    if hasattr(all_response, 'error') and all_response.error:
      error_msg = all_response.error
      if isinstance(all_response.error, dict):
        error_msg = all_response.error.get('message', str(all_response.error))
      raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to fetch applications: {error_msg}")
    
    items = all_response.data or []
    
    # 排序：pending 在前，然后按 created_at 降序
    def sort_key(item):
      status = item.get('status', '')
      created_at = item.get('created_at', '')
      # pending 返回 (0, ...)，其他返回 (1, ...)
      status_priority = 0 if status == 'pending' else 1
      # 将 created_at 转换为可比较的值（降序，所以用负值）
      if isinstance(created_at, str):
        try:
          if created_at.endswith('Z'):
            created_at_dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
          else:
            created_at_dt = datetime.fromisoformat(created_at)
        except (ValueError, AttributeError):
          created_at_dt = datetime.min
      elif isinstance(created_at, datetime):
        created_at_dt = created_at
      else:
        created_at_dt = datetime.min
      # 返回 (status_priority, -timestamp) 以便 pending 在前，且按时间降序
      return (status_priority, -created_at_dt.timestamp())
    
    items.sort(key=sort_key)
    
    # 分页
    start = (page - 1) * page_size
    end = start + page_size
    paginated_items = items[start:end]
    
    # 序列化
    result = []
    for item in paginated_items:
      try:
        user_data = {}
        if item.get('profiles'):
          profile_data = item['profiles']
          if isinstance(profile_data, list) and len(profile_data) > 0:
            profile_data = profile_data[0]
          user_data = {
            'id': profile_data.get('id'),
            'username': profile_data.get('username'),
          }
        
        group_data = item.get('line_groups')
        group_response_obj = None
        if group_data:
          if isinstance(group_data, list) and len(group_data) > 0:
            group_data = group_data[0]
          group_response_obj = {
            'id': str(group_data.get('id')),
            'name': str(group_data.get('name', '')),
            'description': str(group_data.get('description', '')),
            'qr_code_url': group_data.get('qr_code_url'),
            'manager_id': str(group_data.get('manager_id', '')),
            'is_active': bool(group_data.get('is_active', True)),
            'member_count': int(group_data.get('member_count', 0)),
            'created_at': group_data.get('created_at'),
            'updated_at': group_data.get('updated_at'),
          }
        
        created_at = item.get('created_at')
        reviewed_at = item.get('reviewed_at')
        
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
        
        if isinstance(reviewed_at, str) and reviewed_at:
          try:
            if reviewed_at.endswith('Z'):
              reviewed_at = datetime.fromisoformat(reviewed_at.replace('Z', '+00:00'))
            else:
              reviewed_at = datetime.fromisoformat(reviewed_at)
          except (ValueError, AttributeError):
            reviewed_at = None
        
        from ..schemas import LineGroupResponse
        result.append(
          LineGroupApplicationResponse(
            id=str(item['id']),
            user_id=str(item['user_id']),
            group_id=str(item['group_id']),
            message=item.get('message'),
            status=str(item['status']),
            reviewed_by=item.get('reviewed_by'),
            reviewed_at=reviewed_at,
            created_at=created_at,
            user=Author(**user_data) if user_data else None,
            group=LineGroupResponse(**group_response_obj) if group_response_obj else None,
          )
        )
      except Exception as item_error:
        print(f"Error processing application item {item.get('id', 'unknown')}: {item_error}")
        import traceback
        print(traceback.format_exc())
        continue
    
    total_pages = (total + page_size - 1) // page_size if total > 0 else 0
    
    return PaginatedApplicationResponse(
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
    print(f"Error in list_all_applications: {e}")
    print(traceback.format_exc())
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to fetch applications: {str(e)}")


@router.get('/stats')
async def get_admin_stats(
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_admin_user),
):
  """Get admin statistics"""
  if not _is_admin(user, supabase):
    raise HTTPException(status.HTTP_403_FORBIDDEN, 'Admin access required')

  try:
    # Get counts with execute()
    users_resp = supabase.table('profiles').select('id', count='exact').execute()
    posts_resp = supabase.table('posts').select('id', count='exact').execute()
    replies_resp = supabase.table('post_replies').select('id', count='exact').execute()

    total_users = 0
    total_posts = 0
    total_replies = 0

    if hasattr(users_resp, 'count') and users_resp.count is not None:
      total_users = users_resp.count
    elif users_resp.data:
      total_users = len(users_resp.data)

    if hasattr(posts_resp, 'count') and posts_resp.count is not None:
      total_posts = posts_resp.count
    elif posts_resp.data:
      total_posts = len(posts_resp.data)

    if hasattr(replies_resp, 'count') and replies_resp.count is not None:
      total_replies = replies_resp.count
    elif replies_resp.data:
      total_replies = len(replies_resp.data)

    return {
      'total_users': total_users,
      'total_threads': total_posts,  # threads are now posts
      'total_posts': total_replies,  # posts (replies) are now post_replies
    }
  except Exception as e:
    print(f"Error getting admin stats: {e}")
    import traceback
    print(traceback.format_exc())
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to get stats: {str(e)}")


@router.get('/stats/weekly')
async def get_weekly_stats(
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_admin_user),
  weeks: int = 8,  # 默认返回最近8周的数据
):
  """Get weekly statistics for new users and new posts"""
  if not _is_admin(user, supabase):
    raise HTTPException(status.HTTP_403_FORBIDDEN, 'Admin access required')

  try:
    now = datetime.utcnow()
    weekly_data = []
    
    # 生成最近几周的数据
    for week_offset in range(weeks - 1, -1, -1):
      # 计算这一周的开始和结束时间
      week_end = now - timedelta(weeks=week_offset)
      week_start = week_end - timedelta(days=7)
      
      # 获取这一周的新增用户数（根据 created_at）
      users_resp = (
        supabase.table('profiles')
        .select('id', count='exact')
        .gte('created_at', week_start.isoformat())
        .lt('created_at', week_end.isoformat())
        .execute()
      )
      
      new_users = 0
      if hasattr(users_resp, 'count') and users_resp.count is not None:
        new_users = users_resp.count
      elif users_resp.data:
        new_users = len(users_resp.data)
      
      # 获取这一周的新增帖子数（根据 created_at）
      posts_resp = (
        supabase.table('posts')
        .select('id', count='exact')
        .gte('created_at', week_start.isoformat())
        .lt('created_at', week_end.isoformat())
        .execute()
      )
      
      new_posts = 0
      if hasattr(posts_resp, 'count') and posts_resp.count is not None:
        new_posts = posts_resp.count
      elif posts_resp.data:
        new_posts = len(posts_resp.data)
      
      # 格式化周标签（例如：Week 1, Week 2, ... 或日期范围）
      week_label = f"Week {weeks - week_offset}"
      
      weekly_data.append({
        'week': week_label,
        'week_start': week_start.isoformat(),
        'week_end': week_end.isoformat(),
        'new_users': new_users,
        'new_posts': new_posts,
      })
    
    return {
      'weekly_data': weekly_data,
    }
  except Exception as e:
    print(f"Error getting weekly stats: {e}")
    import traceback
    print(traceback.format_exc())
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to get weekly stats: {str(e)}")

