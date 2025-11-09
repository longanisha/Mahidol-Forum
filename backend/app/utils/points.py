from datetime import datetime, date
from typing import Optional
from ..dependencies import SupabaseClientDep


def award_points(
  supabase: SupabaseClientDep,
  user_id: str,
  points: int,
  reason: str,
) -> bool:
  """
  奖励积分给用户
  
  Args:
    supabase: Supabase 客户端
    user_id: 用户 ID
    points: 积分数量（正数）
    reason: 积分原因
  
  Returns:
    bool: 是否成功
  """
  try:
    if points <= 0:
      return False
    
    # 创建积分记录
    record_resp = (
      supabase.table('point_records')
      .insert({
        'user_id': user_id,
        'points': points,
        'reason': reason,
      })
      .execute()
    )
    
    if hasattr(record_resp, 'error') and record_resp.error:
      print(f"[AWARD_POINTS] Failed to create point record: {record_resp.error}")
      return False
    
    # 获取当前积分
    profile_resp = (
      supabase.table('profiles')
      .select('total_points')
      .eq('id', user_id)
      .limit(1)
      .execute()
    )
    
    if hasattr(profile_resp, 'error') and profile_resp.error:
      print(f"[AWARD_POINTS] Failed to get user profile: {profile_resp.error}")
      return False
    
    if not profile_resp.data or len(profile_resp.data) == 0:
      print(f"[AWARD_POINTS] Profile not found for user {user_id}")
      return False
    
    current_points = profile_resp.data[0].get('total_points', 0) or 0
    new_total = current_points + points
    new_level = min(10, 1 + (new_total // 100))
    
    # 更新积分和等级
    update_resp = (
      supabase.table('profiles')
      .update({
        'total_points': new_total,
        'level': new_level,
      })
      .eq('id', user_id)
      .execute()
    )
    
    if hasattr(update_resp, 'error') and update_resp.error:
      print(f"[AWARD_POINTS] Failed to update points: {update_resp.error}")
      return False
    
    print(f"[AWARD_POINTS] ✅ Awarded {points} points to user {user_id} for: {reason}")
    return True
  except Exception as e:
    print(f"[AWARD_POINTS] Error: {e}")
    import traceback
    print(traceback.format_exc())
    return False


def deduct_points(
  supabase: SupabaseClientDep,
  user_id: str,
  points: int,
  reason: str,
) -> bool:
  """
  扣除用户积分
  
  Args:
    supabase: Supabase 客户端
    user_id: 用户 ID
    points: 积分数量（正数，实际会扣除）
    reason: 扣除原因
  
  Returns:
    bool: 是否成功
  """
  try:
    if points <= 0:
      return False
    
    # 获取当前积分
    profile_resp = (
      supabase.table('profiles')
      .select('total_points')
      .eq('id', user_id)
      .limit(1)
      .execute()
    )
    
    if hasattr(profile_resp, 'error') and profile_resp.error:
      print(f"[DEDUCT_POINTS] Failed to get user profile: {profile_resp.error}")
      return False
    
    if not profile_resp.data or len(profile_resp.data) == 0:
      print(f"[DEDUCT_POINTS] Profile not found for user {user_id}")
      return False
    
    current_points = profile_resp.data[0].get('total_points', 0) or 0
    
    if current_points < points:
      print(f"[DEDUCT_POINTS] Insufficient points: user has {current_points}, needs {points}")
      return False
    
    # 创建积分记录（负数）
    record_resp = (
      supabase.table('point_records')
      .insert({
        'user_id': user_id,
        'points': -points,
        'reason': reason,
      })
      .execute()
    )
    
    if hasattr(record_resp, 'error') and record_resp.error:
      print(f"[DEDUCT_POINTS] Failed to create point record: {record_resp.error}")
      return False
    
    new_total = current_points - points
    new_level = max(1, min(10, 1 + (new_total // 100)))
    
    # 更新积分和等级
    update_resp = (
      supabase.table('profiles')
      .update({
        'total_points': new_total,
        'level': new_level,
      })
      .eq('id', user_id)
      .execute()
    )
    
    if hasattr(update_resp, 'error') and update_resp.error:
      print(f"[DEDUCT_POINTS] Failed to update points: {update_resp.error}")
      return False
    
    print(f"[DEDUCT_POINTS] ✅ Deducted {points} points from user {user_id} for: {reason}")
    return True
  except Exception as e:
    print(f"[DEDUCT_POINTS] Error: {e}")
    import traceback
    print(traceback.format_exc())
    return False


def check_daily_login(
  supabase: SupabaseClientDep,
  user_id: str,
) -> bool:
  """
  检查并奖励每日登录积分
  
  Args:
    supabase: Supabase 客户端
    user_id: 用户 ID
  
  Returns:
    bool: 是否成功奖励（如果今天已经登录过，返回 False）
  """
  try:
    # 获取用户最后登录日期
    profile_resp = (
      supabase.table('profiles')
      .select('id, last_login_date, total_points')
      .eq('id', user_id)
      .limit(1)
      .execute()
    )
    
    if hasattr(profile_resp, 'error') and profile_resp.error:
      print(f"[DAILY_LOGIN] Failed to get user profile: {profile_resp.error}")
      return False
    
    if not profile_resp.data or len(profile_resp.data) == 0:
      print(f"[DAILY_LOGIN] Profile not found for user {user_id}")
      return False
    
    profile = profile_resp.data[0]
    last_login_date = profile.get('last_login_date')
    today = date.today()
    
    # 检查今天是否已经登录过
    if last_login_date:
      if isinstance(last_login_date, str):
        try:
          last_login = datetime.fromisoformat(last_login_date.replace('Z', '+00:00')).date()
        except (ValueError, AttributeError):
          last_login = None
      elif isinstance(last_login_date, date):
        last_login = last_login_date
      else:
        last_login = None
      
      if last_login == today:
        # 今天已经登录过，不重复奖励
        return False
    
    # 更新最后登录日期
    update_resp = (
      supabase.table('profiles')
      .update({
        'last_login_date': today.isoformat(),
      })
      .eq('id', user_id)
      .execute()
    )
    
    if hasattr(update_resp, 'error') and update_resp.error:
      print(f"[DAILY_LOGIN] Failed to update last_login_date: {update_resp.error}")
      # 即使更新失败，也尝试奖励积分
    
    # 奖励每日登录积分
    return award_points(supabase, user_id, 1, '每日登录')
  except Exception as e:
    print(f"[DAILY_LOGIN] Error: {e}")
    import traceback
    print(traceback.format_exc())
    return False

