from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from ..auth import AuthenticatedUser, get_current_user
from ..dependencies import SupabaseClientDep
from ..schemas import UserProfile

router = APIRouter(prefix='/superadmin', tags=['superadmin'])


class RoleUpdate(BaseModel):
  new_role: str


def _is_superadmin(user: AuthenticatedUser, supabase: SupabaseClientDep) -> bool:
  """Check if user is superadmin"""
  try:
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
    return role == 'superadmin'
  except Exception:
    return False


@router.get('/stats')
async def get_superadmin_stats(
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_current_user),
):
  """Get comprehensive system statistics (superadmin only)"""
  if not _is_superadmin(user, supabase):
    raise HTTPException(status.HTTP_403_FORBIDDEN, 'SuperAdmin access required')
  
  try:
    # Get counts
    users_resp = supabase.table('profiles').select('id', count='exact').execute()
    threads_resp = supabase.table('threads').select('id', count='exact').execute()
    posts_resp = supabase.table('posts').select('id', count='exact').execute()
    groups_resp = supabase.table('line_groups').select('id', count='exact').execute()
    applications_resp = supabase.table('line_group_applications').select('id', count='exact').execute()
    reports_resp = supabase.table('line_group_reports').select('id', count='exact').execute()
    
    # Get role distribution
    role_distribution = {}
    profiles_resp = supabase.table('profiles').select('role').execute()
    if profiles_resp.data:
      for profile in profiles_resp.data:
        role = profile.get('role', 'user')
        role_distribution[role] = role_distribution.get(role, 0) + 1
    
    return {
      'total_users': users_resp.count if hasattr(users_resp, 'count') else len(users_resp.data or []),
      'total_threads': threads_resp.count if hasattr(threads_resp, 'count') else len(threads_resp.data or []),
      'total_posts': posts_resp.count if hasattr(posts_resp, 'count') else len(posts_resp.data or []),
      'total_groups': groups_resp.count if hasattr(groups_resp, 'count') else len(groups_resp.data or []),
      'total_applications': applications_resp.count if hasattr(applications_resp, 'count') else len(applications_resp.data or []),
      'total_reports': reports_resp.count if hasattr(reports_resp, 'count') else len(reports_resp.data or []),
      'role_distribution': role_distribution,
    }
  except Exception as e:
    print(f"Error getting superadmin stats: {e}")
    import traceback
    print(traceback.format_exc())
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to get stats: {str(e)}")


@router.get('/users', response_model=List[UserProfile])
async def list_all_users(
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_current_user),
  limit: int = 100,
  offset: int = 0,
  role_filter: Optional[str] = None,
):
  """List all users with optional filtering (superadmin only)"""
  if not _is_superadmin(user, supabase):
    raise HTTPException(status.HTTP_403_FORBIDDEN, 'SuperAdmin access required')
  
  try:
    query = (
      supabase.table('profiles')
      .select('id, username, avatar_url, total_points, level, role, created_at')
      .order('created_at', desc=True)
    )
    
    response = query.execute()
    
    if hasattr(response, 'error') and response.error:
      error_msg = response.error
      if isinstance(response.error, dict):
        error_msg = response.error.get('message', str(response.error))
      raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to fetch users: {error_msg}")
    
    # Filter by role if specified
    all_data = response.data or []
    if role_filter:
      all_data = [item for item in all_data if item.get('role') == role_filter]
    
    # Manual pagination
    paginated_data = all_data[offset:offset + limit]
    
    return [UserProfile(**item) for item in paginated_data]
  except HTTPException:
    raise
  except Exception as e:
    print(f"Error listing users: {e}")
    import traceback
    print(traceback.format_exc())
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to list users: {str(e)}")


@router.patch('/users/{user_id}/role')
async def update_user_role(
  user_id: str,
  payload: RoleUpdate,
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_current_user),
):
  """Update user role (superadmin only)"""
  if not _is_superadmin(user, supabase):
    raise HTTPException(status.HTTP_403_FORBIDDEN, 'SuperAdmin access required')
  
  new_role = payload.new_role
  if new_role not in ('user', 'moderator', 'admin', 'superadmin'):
    raise HTTPException(status.HTTP_400_BAD_REQUEST, 'Invalid role')
  
  try:
    response = (
      supabase.table('profiles')
      .update({'role': new_role})
      .eq('id', user_id)
      .select('id, username, role')
      .single()
      .execute()
    )
    
    if hasattr(response, 'error') and response.error:
      error_msg = response.error
      if isinstance(response.error, dict):
        error_msg = response.error.get('message', str(response.error))
      raise HTTPException(status.HTTP_404_NOT_FOUND, f"User not found: {error_msg}")
    
    return {'success': True, 'user_id': user_id, 'new_role': new_role, 'user': response.data}
  except HTTPException:
    raise
  except Exception as e:
    print(f"Error updating user role: {e}")
    import traceback
    print(traceback.format_exc())
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to update role: {str(e)}")


@router.delete('/users/{user_id}')
async def delete_user(
  user_id: str,
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_current_user),
):
  """Delete a user (superadmin only)"""
  if not _is_superadmin(user, supabase):
    raise HTTPException(status.HTTP_403_FORBIDDEN, 'SuperAdmin access required')
  
  # Prevent deleting yourself
  if user_id == user.id:
    raise HTTPException(status.HTTP_400_BAD_REQUEST, 'Cannot delete your own account')
  
  try:
    # Delete from profiles (cascade will handle related data)
    response = (
      supabase.table('profiles')
      .delete()
      .eq('id', user_id)
      .execute()
    )
    
    return {'success': True, 'user_id': user_id, 'message': 'User deleted successfully'}
  except Exception as e:
    print(f"Error deleting user: {e}")
    import traceback
    print(traceback.format_exc())
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to delete user: {str(e)}")


@router.get('/system/logs')
async def get_system_logs(
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_current_user),
  limit: int = 100,
):
  """Get system logs (superadmin only) - placeholder for future implementation"""
  if not _is_superadmin(user, supabase):
    raise HTTPException(status.HTTP_403_FORBIDDEN, 'SuperAdmin access required')
  
  # This is a placeholder - in a real system, you'd have a logs table
  return {
    'message': 'System logs feature coming soon',
    'logs': [],
  }

