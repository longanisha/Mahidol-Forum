from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, EmailStr
import bcrypt
from datetime import datetime

from ..dependencies import SupabaseClientDep

router = APIRouter(prefix='/admin-auth', tags=['admin-auth'])


class AdminLoginRequest(BaseModel):
  email: EmailStr
  password: str


class AdminLoginResponse(BaseModel):
  success: bool
  admin_id: str
  email: str
  username: str | None
  message: str


def verify_password(plain_password: str, hashed_password: str) -> bool:
  """验证密码"""
  try:
    # 确保密码不超过 72 字节
    password_bytes = plain_password.encode('utf-8')
    if len(password_bytes) > 72:
      password_bytes = password_bytes[:72]
    return bcrypt.checkpw(password_bytes, hashed_password.encode('utf-8'))
  except Exception as e:
    print(f"Password verification error: {e}")
    return False


def get_password_hash(password: str) -> str:
  """生成密码哈希"""
  # bcrypt 限制密码长度为 72 字节
  password_bytes = password.encode('utf-8')
  if len(password_bytes) > 72:
    password_bytes = password_bytes[:72]
  salt = bcrypt.gensalt()
  hashed = bcrypt.hashpw(password_bytes, salt)
  return hashed.decode('utf-8')


@router.post('/login', response_model=AdminLoginResponse)
async def admin_login(
  credentials: AdminLoginRequest,
  supabase: SupabaseClientDep,
):
  """Admin 登录 - 只验证账号密码"""
  try:
    print(f"[admin_login] Attempting login for email: {credentials.email}")
    
    # 查询 admin（不使用 .single()，因为可能没有记录）
    response = (
      supabase.table('admins')
      .select('id, email, password_hash, username, is_active')
      .eq('email', credentials.email)
      .eq('is_active', True)
      .execute()
    )
    
    if hasattr(response, 'error') and response.error:
      error_msg = response.error
      if isinstance(response.error, dict):
        error_msg = response.error.get('message', str(response.error))
      print(f"[admin_login] Database error: {error_msg}")
      raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=f'查询失败: {error_msg}'
      )
    
    # 检查是否有数据
    if not response.data or len(response.data) == 0:
      print(f"[admin_login] No admin found with email: {credentials.email} or admin is inactive")
      raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail='账号或密码错误'
      )
    
    # 获取第一条记录（应该只有一条，因为 email 是唯一的）
    admin = response.data[0]
    print(f"[admin_login] Admin found: {admin['id']}, username: {admin.get('username')}")
    
    # 验证密码
    password_valid = verify_password(credentials.password, admin['password_hash'])
    print(f"[admin_login] Password verification result: {password_valid}")
    
    if not password_valid:
      print(f"[admin_login] Password verification failed for admin: {admin['id']}")
      raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail='账号或密码错误'
      )
    
    # 更新最后登录时间
    try:
      supabase.table('admins').update({
        'last_login_at': datetime.utcnow().isoformat()
      }).eq('id', admin['id']).execute()
    except Exception as e:
      print(f"Failed to update last_login_at: {e}")
      # 不阻止登录，只是记录错误
    
    return AdminLoginResponse(
      success=True,
      admin_id=admin['id'],
      email=admin['email'],
      username=admin.get('username'),
      message='登录成功'
    )
    
  except HTTPException:
    raise
  except Exception as e:
    print(f"Admin login error: {e}")
    import traceback
    print(traceback.format_exc())
    raise HTTPException(
      status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
      detail=f'登录失败: {str(e)}'
    )


class AdminRegisterRequest(BaseModel):
  email: EmailStr
  password: str
  username: str | None = None


@router.post('/register')
async def admin_register(
  data: AdminRegisterRequest,
  supabase: SupabaseClientDep,
):
  """注册新的 admin（仅用于初始化，生产环境应该禁用）"""
  try:
    # 检查是否已存在
    check_response = (
      supabase.table('admins')
      .select('id')
      .eq('email', data.email)
      .execute()
    )
    
    if check_response.data and len(check_response.data) > 0:
      raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail='该邮箱已被注册'
      )
    
    # 创建新 admin
    password_hash = get_password_hash(data.password)
    
    insert_data = {
      'email': data.email,
      'password_hash': password_hash,
      'username': data.username,
      'is_active': True
    }
    
    insert_response = (
      supabase.table('admins')
      .insert(insert_data)
      .execute()
    )
    
    if hasattr(insert_response, 'error') and insert_response.error:
      error_msg = insert_response.error
      if isinstance(insert_response.error, dict):
        error_msg = insert_response.error.get('message', str(insert_response.error))
      raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=f'注册失败: {error_msg}'
      )
    
    if not insert_response.data or len(insert_response.data) == 0:
      # 如果插入成功但没有返回数据，重新查询
      check_response = (
        supabase.table('admins')
        .select('id, email, username')
        .eq('email', data.email)
        .execute()
      )
      if check_response.data and len(check_response.data) > 0:
        admin_data = check_response.data[0]
      else:
        raise HTTPException(
          status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
          detail='注册失败：未返回数据'
        )
    else:
      admin_data = insert_response.data[0]
    
    return {
      'success': True,
      'admin_id': admin_data['id'],
      'email': admin_data['email'],
      'username': admin_data.get('username'),
      'message': '注册成功'
    }
    
  except HTTPException:
    raise
  except Exception as e:
    print(f"Admin register error: {e}")
    import traceback
    print(traceback.format_exc())
    raise HTTPException(
      status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
      detail=f'注册失败: {str(e)}'
    )

