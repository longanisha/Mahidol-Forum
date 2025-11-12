from typing import Any, Annotated, Dict, Optional
import asyncio

from fastapi import Depends, Header, HTTPException, Request, status

try:
    from supabase_auth.errors import AuthApiError, AuthError
except ImportError:
    # 如果导入失败，定义占位符类
    class AuthError(Exception):
        pass
    class AuthApiError(AuthError):
        pass

from .dependencies import SupabaseClientDep
from .utils.points import check_daily_login


class AuthenticatedUser:
  def __init__(self, data: Dict[str, Any]):
    self._data = data

  @property
  def id(self) -> str:
    return self._data.get('id', '')

  @property
  def email(self) -> Optional[str]:
    return self._data.get('email')

  def to_dict(self) -> Dict[str, Any]:
    return dict(self._data)


async def get_current_user(
  supabase: SupabaseClientDep,
  request: Request,
  authorization: Annotated[str | None, Header(alias='Authorization')] = None,
) -> AuthenticatedUser:
  print(f"[get_current_user] ====== Starting token validation ======")
  
  # 如果通过 Header 依赖没有获取到，尝试从 request 中获取（处理大小写问题）
  if not authorization:
    auth_header = request.headers.get('Authorization') or request.headers.get('authorization')
    if auth_header:
      authorization = auth_header
      print(f"[get_current_user] Authorization header retrieved from request headers")
  
  print(f"[get_current_user] Authorization header received: {authorization[:50] if authorization else 'None'}...")
  
  if not authorization:
    print("[get_current_user] ERROR: Missing Authorization header")
    print(f"[get_current_user] Available headers: {list(request.headers.keys())}")
    print(f"[get_current_user] All headers: {dict(request.headers)}")
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Missing Authorization header')

  if not authorization.lower().startswith('bearer '):
    print(f"[get_current_user] ERROR: Invalid authorization scheme: {authorization[:20]}...")
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Invalid authorization scheme')

  token = authorization.split(' ', 1)[1].strip()
  if not token:
    print("[get_current_user] ERROR: Empty bearer token")
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Invalid bearer token')
  
  print(f"[get_current_user] Token extracted, length: {len(token)}")
  print(f"[get_current_user] Token preview: {token[:50]}...")
  print(f"[get_current_user] Token ends with: ...{token[-20:]}")

  try:
    # 使用 asyncio.wait_for 设置超时（10秒）
    # 注意：Supabase Python 客户端是同步的，所以使用 asyncio.to_thread 在线程池中执行
    try:
      # Python 3.9+ 支持 asyncio.to_thread
      import sys
      if sys.version_info >= (3, 9):
        try:
          print(f"[get_current_user] Calling supabase.auth.get_user with token...")
          user_response = await asyncio.wait_for(
            asyncio.to_thread(supabase.auth.get_user, token),
            timeout=10.0
          )
          print(f"[get_current_user] ✅ get_user succeeded, user ID: {user_response.user.id if user_response.user else 'None'}")
        except AuthApiError as auth_error:
          # 在异步执行中捕获 AuthApiError
          error_msg = str(auth_error)
          print(f"[get_current_user] ❌ AuthApiError (async): {error_msg}")
          raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Invalid or expired token')
      else:
        # Python 3.8 及以下，使用 run_in_executor
        loop = asyncio.get_event_loop()
        try:
          user_response = await asyncio.wait_for(
            loop.run_in_executor(None, supabase.auth.get_user, token),
            timeout=10.0
          )
        except AuthApiError as auth_error:
          # 在异步执行中捕获 AuthApiError
          error_msg = str(auth_error)
          print(f"AuthApiError (async): {error_msg}")
          raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Invalid or expired token')
    except HTTPException:
      # 重新抛出 HTTPException（包括我们刚才抛出的 401）
      raise
    except asyncio.TimeoutError:
      print("Auth timeout: get_user operation timed out after 10 seconds")
      raise HTTPException(status.HTTP_408_REQUEST_TIMEOUT, 'Authentication request timed out. Please try again.')
    except AuthApiError as auth_error:
      # 直接捕获 Supabase Auth API 错误（如果上面的捕获没有生效）
      error_msg = str(auth_error)
      print(f"[get_current_user] ❌ AuthApiError (outer): {error_msg}")
      raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Invalid or expired token')
    except Exception as timeout_error:
      # 检查是否是 token 过期或无效的错误
      error_msg = str(timeout_error)
      error_type = type(timeout_error).__name__
      print(f"[get_current_user] ❌ Exception in auth (type: {error_type}): {error_msg}")
      
      # 检查是否是 AuthApiError 的实例（可能因为序列化问题没有被直接捕获）
      if 'AuthApiError' in error_type or 'expired' in error_msg.lower() or 'invalid' in error_msg.lower() or 'jwt' in error_msg.lower():
        print(f"[get_current_user] ❌ Token validation error: {error_msg}")
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Invalid or expired token')
      
      # 如果异步调用失败，回退到同步调用（但可能仍然会超时）
      print(f"Async auth call failed, trying sync: {timeout_error}")
      try:
        user_response = supabase.auth.get_user(token)
      except (AuthApiError, AuthError) as sync_auth_error:
        # 直接捕获 Supabase Auth API 错误（包括 AuthError 基类）
        error_msg = str(sync_auth_error)
        error_type = type(sync_auth_error).__name__
        print(f"AuthApiError/AuthError (sync, type: {error_type}): {error_msg}")
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Invalid or expired token')
      except Exception as sync_error:
        sync_error_msg = str(sync_error)
        sync_error_type = type(sync_error).__name__
        print(f"Sync error (type: {sync_error_type}): {sync_error_msg}")
        # 检查是否是 AuthError 的子类
        if isinstance(sync_error, (AuthApiError, AuthError)) or 'AuthApiError' in sync_error_type or 'AuthError' in sync_error_type:
          print(f"Token validation error (sync, detected by type): {sync_error_msg}")
          raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Invalid or expired token')
        if 'expired' in sync_error_msg.lower() or 'invalid' in sync_error_msg.lower() or 'jwt' in sync_error_msg.lower():
          print(f"Token validation error (sync, detected by message): {sync_error_msg}")
          raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Invalid or expired token')
        if 'timeout' in sync_error_msg.lower() or 'timed out' in sync_error_msg.lower():
          raise HTTPException(status.HTTP_408_REQUEST_TIMEOUT, 'Authentication request timed out. Please try again.')
        raise
    
    user = getattr(user_response, 'user', None)

    if not user:
      # Check if there's an error in the response
      if hasattr(user_response, 'error'):
        error_msg = user_response.error
        if isinstance(error_msg, dict):
          error_msg = error_msg.get('message', str(error_msg))
        print(f"Auth error: {error_msg}")
      raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Invalid or expired token')

    user_obj = AuthenticatedUser(user.model_dump())
    
    # 检查并奖励每日登录积分
    try:
      check_daily_login(supabase, user_obj.id)
    except Exception as login_error:
      # 登录积分奖励失败不影响认证
      print(f"[AUTH] Failed to check daily login: {login_error}")
    
    return user_obj
  except HTTPException:
    raise
  except (AuthApiError, AuthError) as auth_error:
    # 直接捕获 Supabase Auth API 错误（包括 AuthError 基类）
    error_msg = str(auth_error)
    error_type = type(auth_error).__name__
    print(f"AuthApiError/AuthError in get_current_user (type: {error_type}): {error_msg}")
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Invalid or expired token')
  except Exception as e:
    error_msg = str(e)
    error_type = type(e).__name__
    print(f"Unexpected error in get_current_user: {error_type}: {error_msg}")
    import traceback
    print(traceback.format_exc())
    
    # 检查是否是 AuthError 的子类
    if isinstance(e, (AuthApiError, AuthError)) or 'AuthApiError' in error_type or 'AuthError' in error_type:
      print(f"Token validation error (detected by type): {error_msg}")
      raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Invalid or expired token')
    
    # 检查是否是 token 过期或无效的错误
    if 'expired' in error_msg.lower() or 'invalid' in error_msg.lower() or 'jwt' in error_msg.lower() or 'token' in error_msg.lower():
      raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Invalid or expired token')
    
    # 检查是否是超时错误
    if 'timeout' in error_msg.lower() or 'timed out' in error_msg.lower():
      raise HTTPException(status.HTTP_408_REQUEST_TIMEOUT, 'Authentication request timed out. Please try again.')
    
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, f'Authentication failed: {error_msg}')


async def get_optional_user(
  supabase: SupabaseClientDep,
  request: Request,
  authorization: Annotated[str | None, Header(alias='Authorization')] = None,
) -> Optional[AuthenticatedUser]:
  if not authorization:
    # 尝试从 request 中获取
    auth_header = request.headers.get('Authorization') or request.headers.get('authorization')
    if not auth_header:
      return None
    authorization = auth_header

  try:
    return await get_current_user(supabase, request, authorization)
  except HTTPException:
    return None


async def get_admin_user(
  supabase: SupabaseClientDep,
  request: Request,
  authorization: Annotated[str | None, Header(alias='Authorization')] = None,
  admin_id: Annotated[str | None, Header(alias='X-Admin-ID')] = None,
  admin_email: Annotated[str | None, Header(alias='X-Admin-Email')] = None,
) -> AuthenticatedUser:
  """支持两种认证方式：Supabase Auth token 或 Admin ID/Email，并验证用户是否为管理员"""
  user: AuthenticatedUser | None = None
  
  # 如果通过 Header 依赖没有获取到，尝试从 request 中获取（处理大小写问题）
  if not authorization:
    auth_header = request.headers.get('Authorization') or request.headers.get('authorization')
    if auth_header:
      authorization = auth_header
  
  # 优先使用 Supabase Auth token
  if authorization and authorization.lower().startswith('bearer '):
    try:
      user = await get_current_user(supabase, request, authorization)
    except HTTPException:
      pass  # 如果 token 无效，继续尝试 admin 认证
  
  # 如果通过 Header 依赖没有获取到，尝试从 request 中获取
  if not admin_id:
    admin_id = request.headers.get('X-Admin-ID') or request.headers.get('x-admin-id')
  if not admin_email:
    admin_email = request.headers.get('X-Admin-Email') or request.headers.get('x-admin-email')
  
  # 使用 Admin ID/Email 认证
  if not user and admin_id and admin_email:
    try:
      response = (
        supabase.table('admins')
        .select('id, email, username, is_active')
        .eq('id', admin_id)
        .eq('email', admin_email)
        .eq('is_active', True)
        .execute()
      )
      
      if hasattr(response, 'error') and response.error:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Admin authentication failed')
      
      if not response.data or len(response.data) == 0:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Admin not found or inactive')
      
      admin = response.data[0]
      # 返回一个类似 AuthenticatedUser 的对象
      user = AuthenticatedUser({
        'id': admin['id'],
        'email': admin['email'],
      })
    except HTTPException:
      raise
    except Exception as e:
      print(f"Admin authentication error: {e}")
      raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Admin authentication failed')
  
  if not user:
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Missing Authorization header or Admin credentials')
  
  # 验证用户是否为管理员
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
        return user  # 是 admins 表中的 admin
    
    # 检查是否是 profiles 表中的 admin/moderator/superadmin
    profile_resp = (
      supabase.table('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
      .execute()
    )
    if hasattr(profile_resp, 'error') and profile_resp.error:
      raise HTTPException(status.HTTP_403_FORBIDDEN, '非admin')
    
    role = profile_resp.data.get('role') if profile_resp.data else None
    if role not in ('admin', 'moderator', 'superadmin'):
      raise HTTPException(status.HTTP_403_FORBIDDEN, '非admin')
    
    return user
  except HTTPException:
    raise
  except Exception as e:
    print(f"Error checking admin role: {e}")
    raise HTTPException(status.HTTP_403_FORBIDDEN, '非admin')


async def get_user_or_admin(
  supabase: SupabaseClientDep,
  request: Request,
  authorization: Annotated[str | None, Header(alias='Authorization')] = None,
  admin_id: Annotated[str | None, Header(alias='X-Admin-ID')] = None,
  admin_email: Annotated[str | None, Header(alias='X-Admin-Email')] = None,
) -> AuthenticatedUser:
  """支持两种认证方式：Supabase Auth token 或 Admin ID/Email（用于需要支持普通用户的端点）"""
  # 如果通过 Header 依赖没有获取到，尝试从 request 中获取（处理大小写问题）
  if not authorization:
    auth_header = request.headers.get('Authorization') or request.headers.get('authorization')
    if auth_header:
      authorization = auth_header
  
  # 优先使用 Supabase Auth token
  if authorization and authorization.lower().startswith('bearer '):
    try:
      return await get_current_user(supabase, request, authorization)
    except HTTPException:
      pass  # 如果 token 无效，继续尝试 admin 认证
  
  # 如果通过 Header 依赖没有获取到，尝试从 request 中获取
  if not admin_id:
    admin_id = request.headers.get('X-Admin-ID') or request.headers.get('x-admin-id')
  if not admin_email:
    admin_email = request.headers.get('X-Admin-Email') or request.headers.get('x-admin-email')
  
  # 使用 Admin ID/Email 认证
  if admin_id and admin_email:
    try:
      response = (
        supabase.table('admins')
        .select('id, email, username, is_active')
        .eq('id', admin_id)
        .eq('email', admin_email)
        .eq('is_active', True)
        .execute()
      )
      
      if hasattr(response, 'error') and response.error:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Admin authentication failed')
      
      if not response.data or len(response.data) == 0:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Admin not found or inactive')
      
      admin = response.data[0]
      return AuthenticatedUser({
        'id': admin['id'],
        'email': admin['email'],
      })
    except HTTPException:
      raise
    except Exception as e:
      print(f"Admin authentication error: {e}")
      raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Admin authentication failed')
  
  raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Missing Authorization header or Admin credentials')


