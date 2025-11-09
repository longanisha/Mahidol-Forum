from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status

from ..auth import AuthenticatedUser, get_current_user, get_optional_user, get_admin_user, get_user_or_admin
from ..dependencies import SupabaseClientDep
from ..schemas import (
  Author,
  LineGroupApplicationCreate,
  LineGroupApplicationResponse,
  LineGroupApplicationReview,
  LineGroupCreate,
  LineGroupCreationRequestCreate,
  LineGroupCreationRequestResponse,
  LineGroupCreationRequestReview,
  LineGroupReportCreate,
  LineGroupReportResponse,
  LineGroupResponse,
  LineGroupUpdate,
)
from ..utils.points import award_points, deduct_points


router = APIRouter(prefix='/line-groups', tags=['line-groups'])


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


def _serialize_manager(record: Dict[str, Any]) -> Dict[str, Any]:
  """Serialize manager/author information"""
  manager_data = record.get('manager') or record.get('profiles')
  if manager_data:
    if isinstance(manager_data, list) and len(manager_data) > 0:
      manager_data = manager_data[0]
    if isinstance(manager_data, dict):
      return {
        'id': manager_data.get('id'),
        'username': manager_data.get('username'),
        # avatar_url 列不存在，不包含
      }
  return {}


# ============================================
# LINE 群组 CRUD
# ============================================

@router.get('/', response_model=List[LineGroupResponse])
async def list_groups(
  supabase: SupabaseClientDep,
  user: Optional[AuthenticatedUser] = Depends(get_optional_user),
  active_only: bool = True,
):
  """List all LINE groups (public endpoint, shows active groups that are admin approved)"""
  try:
    query = (
      supabase.table('line_groups')
      .select('id, name, description, qr_code_url, manager_id, is_active, member_count, created_at, updated_at, admin_approved, profiles!manager_id(id, username)')
      .order('created_at', desc=True)
    )
    
    # 只显示经过 admin 审核通过的群组
    query = query.eq('admin_approved', True)
    
    if active_only:
      query = query.eq('is_active', True)
    
    response = query.execute()
    
    if hasattr(response, 'error') and response.error:
      error_msg = response.error
      if isinstance(response.error, dict):
        error_msg = response.error.get('message', str(response.error))
      print(f"Error listing groups: {error_msg}")
      return []
    
    items = response.data or []
    result = []
    
    for item in items:
      try:
        manager_data = _serialize_manager(item)
        
        created_at = item.get('created_at')
        updated_at = item.get('updated_at')
        
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
        
        result.append(
          LineGroupResponse(
            id=str(item['id']),
            name=str(item['name']),
            description=item.get('description'),
            qr_code_url=str(item['qr_code_url']),
            manager_id=str(item['manager_id']),
            is_active=bool(item.get('is_active', True)),
            member_count=int(item.get('member_count', 0) or 0),
            created_at=created_at,
            updated_at=updated_at,
            manager=Author(**manager_data) if manager_data else None,
          )
        )
      except Exception as item_error:
        print(f"Error processing group item {item.get('id', 'unknown')}: {item_error}")
        continue
    
    return result
  except Exception as e:
    print(f"Error in list_groups: {e}")
    import traceback
    print(traceback.format_exc())
    return []


# ============================================
# LINE 群组举报（必须在 /{group_id} 之前）
# ============================================

@router.get('/reports', response_model=List[LineGroupReportResponse])
async def list_reports(
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_admin_user),
  status_filter: Optional[str] = None,
):
  """List all reports (admin only)"""
  if not _is_admin(user, supabase):
    raise HTTPException(status.HTTP_403_FORBIDDEN, 'Admin access required')
  
  try:
    query = (
      supabase.table('line_group_reports')
      .select('id, group_id, reporter_id, reason, description, status, reviewed_by, reviewed_at, created_at, profiles!reporter_id(id, username), line_groups!group_id(id, name, description, qr_code_url, manager_id, is_active, member_count, created_at, updated_at)')
      .order('created_at', desc=True)
    )
    
    if status_filter:
      query = query.eq('status', status_filter)
    
    response = query.execute()
    
    if hasattr(response, 'error') and response.error:
      error_msg = response.error
      if isinstance(response.error, dict):
        error_msg = response.error.get('message', str(response.error))
      print(f"Error listing reports: {error_msg}")
      return []
    
    items = response.data or []
    result = []
    
    for item in items:
      try:
        reporter_data = _serialize_manager(item) if item.get('profiles') else {}
        group_data = item.get('line_groups')
        
        created_at = item.get('created_at')
        reviewed_at = item.get('reviewed_at')
        
        if isinstance(created_at, str):
          try:
            if created_at.endswith('Z'):
              created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            else:
              created_at = datetime.fromisoformat(created_at)
          except (ValueError, AttributeError):
            pass
        
        if isinstance(reviewed_at, str) and reviewed_at:
          try:
            if reviewed_at.endswith('Z'):
              reviewed_at = datetime.fromisoformat(reviewed_at.replace('Z', '+00:00'))
            else:
              reviewed_at = datetime.fromisoformat(reviewed_at)
          except (ValueError, AttributeError):
            reviewed_at = None
        
        group_response_obj = None
        if group_data:
          group_created_at = group_data.get('created_at')
          group_updated_at = group_data.get('updated_at')
          
          if isinstance(group_created_at, str):
            try:
              if group_created_at.endswith('Z'):
                group_created_at = datetime.fromisoformat(group_created_at.replace('Z', '+00:00'))
              else:
                group_created_at = datetime.fromisoformat(group_created_at)
            except (ValueError, AttributeError):
              pass
          
          if isinstance(group_updated_at, str) and group_updated_at:
            try:
              if group_updated_at.endswith('Z'):
                group_updated_at = datetime.fromisoformat(group_updated_at.replace('Z', '+00:00'))
              else:
                group_updated_at = datetime.fromisoformat(group_updated_at)
            except (ValueError, AttributeError):
              group_updated_at = None
          
          group_response_obj = LineGroupResponse(
            id=str(group_data['id']),
            name=str(group_data['name']),
            description=group_data.get('description'),
            qr_code_url=str(group_data['qr_code_url']),
            manager_id=str(group_data['manager_id']),
            is_active=bool(group_data.get('is_active', True)),
            member_count=int(group_data.get('member_count', 0) or 0),
            created_at=group_created_at,
            updated_at=group_updated_at,
            manager=None,
          )
        
        result.append(
          LineGroupReportResponse(
            id=str(item['id']),
            group_id=str(item['group_id']),
            reporter_id=str(item['reporter_id']),
            reason=str(item['reason']),
            description=item.get('description'),
            status=str(item['status']),
            reviewed_by=item.get('reviewed_by'),
            reviewed_at=reviewed_at,
            created_at=created_at,
            reporter=Author(**reporter_data) if reporter_data else None,
            group=group_response_obj,
          )
        )
      except Exception as item_error:
        print(f"Error processing report item {item.get('id', 'unknown')}: {item_error}")
        continue
    
    return result
  except HTTPException:
    raise
  except Exception as e:
    print(f"Error in list_reports: {e}")
    import traceback
    print(traceback.format_exc())
    return []


# ============================================
# LINE 群组创建申请（必须在 /{group_id} 之前）
# ============================================

@router.get('/creation-requests', response_model=List[LineGroupCreationRequestResponse])
async def list_creation_requests(
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_user_or_admin),
  status_filter: Optional[str] = None,
):
  """列出创建群组申请（用户只能看到自己的，admin 可以看到所有）"""
  try:
    # 检查是否是 admin（admins 表或 profiles 表中的 admin）
    is_admin_user = _is_admin(user, supabase)
    
    # Try to select with is_private, fallback if column doesn't exist
    try:
      query = (
        supabase.table('line_group_creation_requests')
        .select('id, requester_id, name, description, qr_code_url, is_private, status, reviewed_by, reviewed_at, rejection_reason, created_at, updated_at, profiles!requester_id(id, username)')
        .order('created_at', desc=True)
      )
    except Exception as select_error:
      # If is_private column doesn't exist, select without it
      print(f"[list_creation_requests] Warning: is_private column may not exist, trying without it: {select_error}")
      query = (
        supabase.table('line_group_creation_requests')
        .select('id, requester_id, name, description, qr_code_url, status, reviewed_by, reviewed_at, rejection_reason, created_at, updated_at, profiles!requester_id(id, username)')
        .order('created_at', desc=True)
      )
    
    # 普通用户只能看到自己的申请
    if not is_admin_user:
      query = query.eq('requester_id', user.id)
    
    if status_filter:
      query = query.eq('status', status_filter)
    
    response = query.execute()
    
    if hasattr(response, 'error') and response.error:
      error_msg = response.error
      if isinstance(response.error, dict):
        error_msg = response.error.get('message', str(response.error))
      print(f"Error listing creation requests: {error_msg}")
      
      # If error is about is_private column, try without it
      if 'is_private' in str(error_msg).lower() or 'PGRST204' in str(error_msg):
        print(f"[list_creation_requests] Retrying without is_private column...")
        try:
          query = (
            supabase.table('line_group_creation_requests')
            .select('id, requester_id, name, description, qr_code_url, status, reviewed_by, reviewed_at, rejection_reason, created_at, updated_at, profiles!requester_id(id, username)')
            .order('created_at', desc=True)
          )
          if not is_admin_user:
            query = query.eq('requester_id', user.id)
          if status_filter:
            query = query.eq('status', status_filter)
          response = query.execute()
          if hasattr(response, 'error') and response.error:
            print(f"Error listing creation requests (retry): {response.error}")
            return []
        except Exception as retry_error:
          print(f"Error in retry: {retry_error}")
          return []
      else:
        return []
    
    items = response.data or []
    result = []
    
    for item in items:
      try:
        requester_data = _serialize_manager(item) if item.get('profiles') else {}
        
        created_at = item.get('created_at')
        updated_at = item.get('updated_at')
        reviewed_at = item.get('reviewed_at')
        
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
        
        if isinstance(reviewed_at, str) and reviewed_at:
          try:
            if reviewed_at.endswith('Z'):
              reviewed_at = datetime.fromisoformat(reviewed_at.replace('Z', '+00:00'))
            else:
              reviewed_at = datetime.fromisoformat(reviewed_at)
          except (ValueError, AttributeError):
            reviewed_at = None
        
        # Build requester Author object safely
        requester = None
        if requester_data and requester_data.get('id'):
          try:
            requester = Author(**requester_data)
          except Exception as author_error:
            print(f"Error creating Author object: {author_error}, data: {requester_data}")
            requester = None
        
        result.append(
          LineGroupCreationRequestResponse(
            id=str(item['id']),
            requester_id=str(item['requester_id']),
            name=str(item['name']),
            description=item.get('description'),
            qr_code_url=str(item['qr_code_url']),
            is_private=item.get('is_private', False),
            status=str(item['status']),
            reviewed_by=item.get('reviewed_by'),
            reviewed_at=reviewed_at,
            rejection_reason=item.get('rejection_reason'),
            created_at=created_at,
            updated_at=updated_at,
            requester=requester,
          )
        )
      except Exception as item_error:
        print(f"Error processing creation request item {item.get('id', 'unknown')}: {item_error}")
        import traceback
        print(traceback.format_exc())
        continue
    
    return result
  except HTTPException:
    raise
  except Exception as e:
    error_type = type(e).__name__
    error_msg = str(e)
    print(f"[list_creation_requests] Error: {error_type}: {error_msg}")
    import traceback
    print(traceback.format_exc())
    # Re-raise as HTTPException to get proper error response
    raise HTTPException(
      status.HTTP_500_INTERNAL_SERVER_ERROR,
      f"Failed to list creation requests: {error_msg}"
    )


# ============================================
# User-specific endpoints (must be before /{group_id})
# ============================================

@router.get('/my-applications', response_model=List[LineGroupApplicationResponse])
async def list_my_applications(
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_current_user),
  status_filter: Optional[str] = None,
):
  """List all applications submitted by the current user"""
  try:
    print(f"[LIST_MY_APPLICATIONS] Starting for user {user.id}")
    query = (
      supabase.table('line_group_applications')
      .select('id, user_id, group_id, message, status, reviewed_by, reviewed_at, created_at, profiles!line_group_applications_user_id_fkey(id, username), line_groups!line_group_applications_group_id_fkey(id, name, description, qr_code_url, manager_id, is_active, member_count, created_at, updated_at)')
      .eq('user_id', user.id)
      .order('created_at', desc=True)
    )
    
    if status_filter:
      query = query.eq('status', status_filter)
    
    response = query.execute()
    
    if hasattr(response, 'error') and response.error:
      error_msg = response.error
      if isinstance(response.error, dict):
        error_msg = response.error.get('message', str(response.error))
      print(f"[LIST_MY_APPLICATIONS] Error listing applications: {error_msg}")
      raise HTTPException(
        status.HTTP_500_INTERNAL_SERVER_ERROR,
        f"Failed to list applications: {error_msg}"
      )
    
    items = response.data or []
    result = []
    
    print(f"[LIST_MY_APPLICATIONS] Found {len(items)} applications for user {user.id}")
    
    for item in items:
      try:
        # 处理用户数据
        user_data = {}
        if item.get('profiles'):
          user_data = _serialize_manager(item)
        
        group_data = item.get('line_groups')
        
        # 处理时间字段
        created_at = item.get('created_at')
        if created_at:
          if isinstance(created_at, str):
            try:
              if created_at.endswith('Z'):
                created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
              else:
                created_at = datetime.fromisoformat(created_at)
            except (ValueError, AttributeError) as e:
              print(f"[LIST_MY_APPLICATIONS] Error parsing created_at: {e}, value: {created_at}")
              created_at = datetime.now()  # 默认值
          elif not isinstance(created_at, datetime):
            print(f"[LIST_MY_APPLICATIONS] Unexpected created_at type: {type(created_at)}")
            created_at = datetime.now()
        else:
          created_at = datetime.now()
        
        reviewed_at = item.get('reviewed_at')
        if reviewed_at and isinstance(reviewed_at, str):
          try:
            if reviewed_at.endswith('Z'):
              reviewed_at = datetime.fromisoformat(reviewed_at.replace('Z', '+00:00'))
            else:
              reviewed_at = datetime.fromisoformat(reviewed_at)
          except (ValueError, AttributeError):
            reviewed_at = None
        
        # 处理群组数据
        group_response_obj = None
        if group_data:
          try:
            group_created_at = group_data.get('created_at')
            if group_created_at and isinstance(group_created_at, str):
              try:
                if group_created_at.endswith('Z'):
                  group_created_at = datetime.fromisoformat(group_created_at.replace('Z', '+00:00'))
                else:
                  group_created_at = datetime.fromisoformat(group_created_at)
              except (ValueError, AttributeError):
                group_created_at = datetime.now()
            elif not isinstance(group_created_at, datetime):
              group_created_at = datetime.now()
            else:
              group_created_at = datetime.now()
            
            group_updated_at = group_data.get('updated_at')
            if group_updated_at and isinstance(group_updated_at, str):
              try:
                if group_updated_at.endswith('Z'):
                  group_updated_at = datetime.fromisoformat(group_updated_at.replace('Z', '+00:00'))
                else:
                  group_updated_at = datetime.fromisoformat(group_updated_at)
              except (ValueError, AttributeError):
                group_updated_at = None
            
            # 确保所有必需字段都存在（qr_code_url 可以为空字符串）
            if not group_data.get('id') or not group_data.get('name') or not group_data.get('manager_id'):
              print(f"[LIST_MY_APPLICATIONS] Missing required group fields: {group_data}")
              group_response_obj = None
            else:
              # qr_code_url 可以为空字符串
              qr_code_url = group_data.get('qr_code_url') or ''
              print(f"[LIST_MY_APPLICATIONS] Group {group_data.get('name')} qr_code_url: '{qr_code_url}' (type: {type(qr_code_url).__name__})")
              
              group_response_obj = LineGroupResponse(
                id=str(group_data.get('id', '')),
                name=str(group_data.get('name', '')),
                description=group_data.get('description'),
                qr_code_url=str(qr_code_url),
                manager_id=str(group_data.get('manager_id', '')),
                is_active=bool(group_data.get('is_active', True)),
                member_count=int(group_data.get('member_count', 0) or 0),
                created_at=group_created_at,
                updated_at=group_updated_at,
                manager=None,
              )
              print(f"[LIST_MY_APPLICATIONS] Created group_response_obj for {group_data.get('name')} with qr_code_url: '{group_response_obj.qr_code_url}'")
          except Exception as group_error:
            print(f"[LIST_MY_APPLICATIONS] Error processing group data: {group_error}")
            import traceback
            print(traceback.format_exc())
            group_response_obj = None
        
        # 创建用户对象
        user_obj = None
        if user_data:
          try:
            user_obj = Author(**user_data)
          except Exception as author_error:
            print(f"[LIST_MY_APPLICATIONS] Error creating Author object: {author_error}, data: {user_data}")
            user_obj = None
        
        # 创建响应对象
        try:
          application_response = LineGroupApplicationResponse(
            id=str(item.get('id', '')),
            user_id=str(item.get('user_id', '')),
            group_id=str(item.get('group_id', '')),
            message=item.get('message'),
            status=str(item.get('status', 'pending')),
            reviewed_by=item.get('reviewed_by'),
            reviewed_at=reviewed_at,
            created_at=created_at,
            user=user_obj,
            group=group_response_obj,
          )
          result.append(application_response)
          print(f"[LIST_MY_APPLICATIONS] Successfully added application {item.get('id')} to result")
        except Exception as response_error:
          print(f"[LIST_MY_APPLICATIONS] Error creating LineGroupApplicationResponse: {response_error}")
          import traceback
          print(traceback.format_exc())
          # 跳过这个项目，继续处理下一个
          continue
      except Exception as item_error:
        print(f"[LIST_MY_APPLICATIONS] Error processing application item {item.get('id', 'unknown')}: {item_error}")
        import traceback
        print(traceback.format_exc())
        continue
    
    print(f"[LIST_MY_APPLICATIONS] Returning {len(result)} applications")
    return result
  except HTTPException:
    raise
  except Exception as e:
    print(f"[LIST_MY_APPLICATIONS] Error in list_my_applications: {e}")
    import traceback
    traceback.print_exc()
    raise HTTPException(
      status.HTTP_500_INTERNAL_SERVER_ERROR,
      f"Failed to list applications: {str(e)}"
    )


@router.get('/my-managed-groups/applications', response_model=List[LineGroupApplicationResponse])
async def list_my_managed_groups_applications(
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_current_user),
  status_filter: Optional[str] = None,
):
  """List all applications for groups managed by the current user"""
  try:
    # 获取用户管理的所有群组
    groups_response = (
      supabase.table('line_groups')
      .select('id')
      .eq('manager_id', user.id)
      .eq('is_active', True)
      .execute()
    )
    
    if hasattr(groups_response, 'error') and groups_response.error:
      error_msg = groups_response.error
      if isinstance(groups_response.error, dict):
        error_msg = groups_response.error.get('message', str(groups_response.error))
      print(f"Error fetching managed groups: {error_msg}")
      return []
    
    managed_group_ids = [group['id'] for group in (groups_response.data or [])]
    
    if not managed_group_ids:
      return []
    
    # 获取这些群组的所有申请
    query = (
      supabase.table('line_group_applications')
      .select('id, user_id, group_id, message, status, reviewed_by, reviewed_at, created_at, profiles!line_group_applications_user_id_fkey(id, username), line_groups!line_group_applications_group_id_fkey(id, name, description, qr_code_url, manager_id, is_active, member_count, created_at, updated_at)')
      .in_('group_id', managed_group_ids)
      .order('created_at', desc=True)
    )
    
    if status_filter:
      query = query.eq('status', status_filter)
    
    response = query.execute()
    
    if hasattr(response, 'error') and response.error:
      error_msg = response.error
      if isinstance(response.error, dict):
        error_msg = response.error.get('message', str(response.error))
      print(f"Error listing applications: {error_msg}")
      return []
    
    items = response.data or []
    result = []
    
    for item in items:
      try:
        user_data = _serialize_manager(item) if item.get('profiles') else {}
        group_data = item.get('line_groups')
        
        created_at = item.get('created_at')
        reviewed_at = item.get('reviewed_at')
        
        if isinstance(created_at, str):
          try:
            if created_at.endswith('Z'):
              created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            else:
              created_at = datetime.fromisoformat(created_at)
          except (ValueError, AttributeError):
            pass
        
        if isinstance(reviewed_at, str) and reviewed_at:
          try:
            if reviewed_at.endswith('Z'):
              reviewed_at = datetime.fromisoformat(reviewed_at.replace('Z', '+00:00'))
            else:
              reviewed_at = datetime.fromisoformat(reviewed_at)
          except (ValueError, AttributeError):
            reviewed_at = None
        
        group_response_obj = None
        if group_data:
          group_created_at = group_data.get('created_at')
          group_updated_at = group_data.get('updated_at')
          
          if isinstance(group_created_at, str):
            try:
              if group_created_at.endswith('Z'):
                group_created_at = datetime.fromisoformat(group_created_at.replace('Z', '+00:00'))
              else:
                group_created_at = datetime.fromisoformat(group_created_at)
            except (ValueError, AttributeError):
              pass
          
          if isinstance(group_updated_at, str) and group_updated_at:
            try:
              if group_updated_at.endswith('Z'):
                group_updated_at = datetime.fromisoformat(group_updated_at.replace('Z', '+00:00'))
              else:
                group_updated_at = datetime.fromisoformat(group_updated_at)
            except (ValueError, AttributeError):
              group_updated_at = None
          
          group_response_obj = LineGroupResponse(
            id=str(group_data['id']),
            name=str(group_data['name']),
            description=group_data.get('description'),
            qr_code_url=str(group_data['qr_code_url']),
            manager_id=str(group_data['manager_id']),
            is_active=bool(group_data.get('is_active', True)),
            member_count=int(group_data.get('member_count', 0) or 0),
            created_at=group_created_at,
            updated_at=group_updated_at,
            manager=None,
          )
        
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
            group=group_response_obj,
          )
        )
      except Exception as item_error:
        print(f"Error processing application item {item.get('id', 'unknown')}: {item_error}")
        continue
    
    return result
  except HTTPException:
    raise
  except Exception as e:
    print(f"Error in list_my_managed_groups_applications: {e}")
    import traceback
    print(traceback.format_exc())
    return []


@router.get('/{group_id}', response_model=LineGroupResponse)
async def get_group(
  group_id: str,
  supabase: SupabaseClientDep,
):
  """Get a specific LINE group"""
  try:
    response = (
      supabase.table('line_groups')
      .select('id, name, description, qr_code_url, manager_id, is_active, is_private, member_count, created_at, updated_at, profiles!manager_id(id, username)')
      .eq('id', group_id)
      .single()
      .execute()
    )
    
    if hasattr(response, 'error') and response.error:
      error_msg = response.error
      if isinstance(response.error, dict):
        error_msg = response.error.get('message', str(response.error))
      raise HTTPException(status.HTTP_404_NOT_FOUND, f"Group not found: {error_msg}")
    
    if not response.data:
      raise HTTPException(status.HTTP_404_NOT_FOUND, "Group not found")
    
    item = response.data
    manager_data = _serialize_manager(item)
    
    created_at = item.get('created_at')
    updated_at = item.get('updated_at')
    
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
    
    return LineGroupResponse(
      id=str(item['id']),
      name=str(item['name']),
      description=item.get('description'),
      qr_code_url=str(item['qr_code_url']),
      manager_id=str(item['manager_id']),
      is_active=bool(item.get('is_active', True)),
      member_count=int(item.get('member_count', 0) or 0),
      created_at=created_at,
      updated_at=updated_at,
      manager=Author(**manager_data) if manager_data else None,
    )
  except HTTPException:
    raise
  except Exception as e:
    print(f"Error in get_group: {e}")
    import traceback
    print(traceback.format_exc())
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to get group: {str(e)}")


@router.post('/', response_model=LineGroupResponse, status_code=status.HTTP_201_CREATED)
async def create_group(
  payload: LineGroupCreate,
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_admin_user),
):
  """Create a new LINE group (admin only)"""
  if not _is_admin(user, supabase):
    raise HTTPException(status.HTTP_403_FORBIDDEN, 'Admin access required')
  
  try:
    # 如果是私人群组，检查并扣除积分
    if payload.is_private:
      profile_resp = (
        supabase.table('profiles')
        .select('total_points')
        .eq('id', user.id)
        .limit(1)
        .execute()
      )
      if profile_resp.data and len(profile_resp.data) > 0:
        current_points = profile_resp.data[0].get('total_points', 0) or 0
        if current_points < 30:
          raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Insufficient points to create private group. Required: 30, Current: {current_points}"
          )
        # 扣除积分
        if not deduct_points(supabase, user.id, 30, '创建私人群组'):
          raise HTTPException(status.HTTP_400_BAD_REQUEST, "Failed to deduct points for private group creation")
    
    insert_payload = {
      'name': payload.name,
      'qr_code_url': payload.qr_code_url,
      'manager_id': user.id,
      'is_active': True,
      'is_private': payload.is_private or False,
      'member_count': 0,
    }
    
    if payload.description:
      insert_payload['description'] = payload.description
    
    response = supabase.table('line_groups').insert(insert_payload).execute()
    
    if hasattr(response, 'error') and response.error:
      error_msg = response.error
      if isinstance(response.error, dict):
        error_msg = response.error.get('message', str(response.error))
      raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Failed to create group: {error_msg}")
    
    if not response.data:
      raise HTTPException(status.HTTP_400_BAD_REQUEST, "Failed to create group")
    
    group_id = response.data[0]['id']
    
    # 奖励创建群组积分 (+20)
    try:
      success = award_points(supabase, user.id, 20, '创建群组')
      if not success:
        print(f"[CREATE_GROUP] Failed to award points to user {user.id} for creating group")
    except Exception as e:
      print(f"[CREATE_GROUP] Error awarding points: {e}")
      import traceback
      print(traceback.format_exc())
      # 积分奖励失败不影响群组创建
    
    return await get_group(str(group_id), supabase)
  except HTTPException:
    raise
  except Exception as e:
    print(f"Error in create_group: {e}")
    import traceback
    print(traceback.format_exc())
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to create group: {str(e)}")


@router.patch('/{group_id}', response_model=LineGroupResponse)
async def update_group(
  group_id: str,
  payload: LineGroupUpdate,
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_admin_user),
):
  """Update a LINE group (admin or manager only)"""
  # Check if user is admin or manager of the group
  group_response = (
    supabase.table('line_groups')
    .select('manager_id')
    .eq('id', group_id)
    .single()
    .execute()
  )
  
  if hasattr(group_response, 'error') or not group_response.data:
    raise HTTPException(status.HTTP_404_NOT_FOUND, "Group not found")
  
  is_manager = group_response.data.get('manager_id') == user.id
  is_admin_user = _is_admin(user, supabase)
  
  if not is_manager and not is_admin_user:
    raise HTTPException(status.HTTP_403_FORBIDDEN, 'Only group manager or admin can update')
  
  try:
    update_payload: Dict[str, Any] = {}
    
    if payload.name is not None:
      update_payload['name'] = payload.name
    if payload.description is not None:
      update_payload['description'] = payload.description
    if payload.qr_code_url is not None:
      update_payload['qr_code_url'] = payload.qr_code_url
    if payload.is_active is not None:
      update_payload['is_active'] = payload.is_active
    
    update_payload['updated_at'] = datetime.utcnow().isoformat()
    
    if not update_payload:
      raise HTTPException(status.HTTP_400_BAD_REQUEST, "No fields to update")
    
    response = (
      supabase.table('line_groups')
      .update(update_payload)
      .eq('id', group_id)
      .execute()
    )
    
    if hasattr(response, 'error') and response.error:
      error_msg = response.error
      if isinstance(response.error, dict):
        error_msg = response.error.get('message', str(response.error))
      raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Failed to update group: {error_msg}")
    
    return await get_group(group_id, supabase)
  except HTTPException:
    raise
  except Exception as e:
    print(f"Error in update_group: {e}")
    import traceback
    print(traceback.format_exc())
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to update group: {str(e)}")


@router.delete('/{group_id}', status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(
  group_id: str,
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_admin_user),
):
  """Delete a LINE group (admin or manager only)"""
  # Check if user is admin or manager
  group_response = (
    supabase.table('line_groups')
    .select('manager_id')
    .eq('id', group_id)
    .single()
    .execute()
  )
  
  if hasattr(group_response, 'error') or not group_response.data:
    raise HTTPException(status.HTTP_404_NOT_FOUND, "Group not found")
  
  is_manager = group_response.data.get('manager_id') == user.id
  is_admin_user = _is_admin(user, supabase)
  
  if not is_manager and not is_admin_user:
    raise HTTPException(status.HTTP_403_FORBIDDEN, 'Only group manager or admin can delete')
  
  try:
    response = (
      supabase.table('line_groups')
      .delete()
      .eq('id', group_id)
      .execute()
    )
    
    if hasattr(response, 'error') and response.error:
      error_msg = response.error
      if isinstance(response.error, dict):
        error_msg = response.error.get('message', str(response.error))
      raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Failed to delete group: {error_msg}")
    
    return None
  except HTTPException:
    raise
  except Exception as e:
    print(f"Error in delete_group: {e}")
    import traceback
    print(traceback.format_exc())
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to delete group: {str(e)}")


# ============================================
# LINE 群组申请
# ============================================

@router.post('/{group_id}/apply', response_model=LineGroupApplicationResponse, status_code=status.HTTP_201_CREATED)
async def apply_to_group(
  group_id: str,
  payload: LineGroupApplicationCreate,
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_current_user),
):
  """Apply to join a LINE group"""
  if payload.group_id != group_id:
    raise HTTPException(status.HTTP_400_BAD_REQUEST, "Group ID mismatch")
  
  try:
    # Ensure profile exists before applying
    profile_check = (
      supabase.table('profiles')
      .select('id')
      .eq('id', user.id)
      .execute()
    )
    
    if not profile_check.data or len(profile_check.data) == 0:
      # Profile doesn't exist, create it
      print(f"[APPLY_TO_GROUP] Profile not found for user {user.id}, creating profile...")
      profile_insert = {
        'id': user.id,
        'username': user.email.split('@')[0] if user.email else 'User',
      }
      profile_response = supabase.table('profiles').insert(profile_insert).execute()
      
      if hasattr(profile_response, 'error') and profile_response.error:
        error_msg = profile_response.error
        if isinstance(profile_response.error, dict):
          error_msg = profile_response.error.get('message', str(profile_response.error))
        print(f"[APPLY_TO_GROUP] Failed to create profile: {error_msg}")
        raise HTTPException(
          status.HTTP_500_INTERNAL_SERVER_ERROR,
          f"Failed to create user profile: {error_msg}"
        )
      
      print(f"[APPLY_TO_GROUP] ✅ Profile created for user {user.id}")
    
    # Check if group exists and is active
    group_response = (
      supabase.table('line_groups')
      .select('id, is_active')
      .eq('id', group_id)
      .single()
      .execute()
    )
    
    if hasattr(group_response, 'error') or not group_response.data:
      raise HTTPException(status.HTTP_404_NOT_FOUND, "Group not found")
    
    if not group_response.data.get('is_active', True):
      raise HTTPException(status.HTTP_400_BAD_REQUEST, "Group is not active")
    
    # Check if user already applied
    existing_response = (
      supabase.table('line_group_applications')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('group_id', group_id)
      .limit(1)
      .execute()
    )
    
    if hasattr(existing_response, 'error') and existing_response.error:
      # If there's an error, continue (might be a new application)
      pass
    elif existing_response.data and len(existing_response.data) > 0:
      existing_status = existing_response.data[0].get('status')
      if existing_status == 'pending':
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You already have a pending application")
      elif existing_status == 'approved':
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You are already approved for this group")
    
    insert_payload = {
      'user_id': user.id,
      'group_id': group_id,
      'status': 'pending',
    }
    
    if payload.message:
      insert_payload['message'] = payload.message
    
    response = supabase.table('line_group_applications').insert(insert_payload).execute()
    
    if hasattr(response, 'error') and response.error:
      error_msg = response.error
      if isinstance(response.error, dict):
        error_msg = response.error.get('message', str(response.error))
      raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Failed to create application: {error_msg}")
    
    if not response.data:
      raise HTTPException(status.HTTP_400_BAD_REQUEST, "Failed to create application")
    
    application_id = response.data[0]['id']
    
    # Fetch the created application with user and group info
    detail_response = (
      supabase.table('line_group_applications')
      .select('id, user_id, group_id, message, status, reviewed_by, reviewed_at, created_at, profiles!line_group_applications_user_id_fkey(id, username), line_groups!line_group_applications_group_id_fkey(id, name, description, qr_code_url, manager_id, is_active, member_count, created_at, updated_at)')
      .eq('id', application_id)
      .single()
      .execute()
    )
    
    if hasattr(detail_response, 'error') or not detail_response.data:
      # Fallback to basic info
      record = response.data[0]
      return LineGroupApplicationResponse(
        id=str(record['id']),
        user_id=str(record['user_id']),
        group_id=str(record['group_id']),
        message=record.get('message'),
        status=str(record['status']),
        reviewed_by=record.get('reviewed_by'),
        reviewed_at=datetime.fromisoformat(record['reviewed_at']) if record.get('reviewed_at') else None,
        created_at=datetime.fromisoformat(record['created_at']) if isinstance(record.get('created_at'), str) else record.get('created_at'),
      )
    
    record = detail_response.data
    user_data = _serialize_manager(record) if record.get('profiles') else {}
    group_data = record.get('line_groups')
    
    created_at = record.get('created_at')
    reviewed_at = record.get('reviewed_at')
    
    if isinstance(created_at, str):
      try:
        if created_at.endswith('Z'):
          created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        else:
          created_at = datetime.fromisoformat(created_at)
      except (ValueError, AttributeError):
        pass
    
    if isinstance(reviewed_at, str) and reviewed_at:
      try:
        if reviewed_at.endswith('Z'):
          reviewed_at = datetime.fromisoformat(reviewed_at.replace('Z', '+00:00'))
        else:
          reviewed_at = datetime.fromisoformat(reviewed_at)
      except (ValueError, AttributeError):
        reviewed_at = None
    
    group_response_obj = None
    if group_data:
      group_created_at = group_data.get('created_at')
      group_updated_at = group_data.get('updated_at')
      
      if isinstance(group_created_at, str):
        try:
          if group_created_at.endswith('Z'):
            group_created_at = datetime.fromisoformat(group_created_at.replace('Z', '+00:00'))
          else:
            group_created_at = datetime.fromisoformat(group_created_at)
        except (ValueError, AttributeError):
          pass
      
      if isinstance(group_updated_at, str) and group_updated_at:
        try:
          if group_updated_at.endswith('Z'):
            group_updated_at = datetime.fromisoformat(group_updated_at.replace('Z', '+00:00'))
          else:
            group_updated_at = datetime.fromisoformat(group_updated_at)
        except (ValueError, AttributeError):
          group_updated_at = None
      
      group_response_obj = LineGroupResponse(
        id=str(group_data['id']),
        name=str(group_data['name']),
        description=group_data.get('description'),
        qr_code_url=str(group_data['qr_code_url']),
        manager_id=str(group_data['manager_id']),
        is_active=bool(group_data.get('is_active', True)),
        member_count=int(group_data.get('member_count', 0) or 0),
        created_at=group_created_at,
        updated_at=group_updated_at,
        manager=None,
      )
    
    return LineGroupApplicationResponse(
      id=str(record['id']),
      user_id=str(record['user_id']),
      group_id=str(record['group_id']),
      message=record.get('message'),
      status=str(record['status']),
      reviewed_by=record.get('reviewed_by'),
      reviewed_at=reviewed_at,
      created_at=created_at,
      user=Author(**user_data) if user_data else None,
      group=group_response_obj,
    )
  except HTTPException:
    raise
  except Exception as e:
    print(f"Error in apply_to_group: {e}")
    import traceback
    print(traceback.format_exc())
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to apply to group: {str(e)}")


@router.get('/my-applications', response_model=List[LineGroupApplicationResponse])
async def list_my_applications(
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_current_user),
  status_filter: Optional[str] = None,
):
  """List all applications submitted by the current user"""
  try:
    print(f"[LIST_MY_APPLICATIONS] Starting for user {user.id}")
    query = (
      supabase.table('line_group_applications')
      .select('id, user_id, group_id, message, status, reviewed_by, reviewed_at, created_at, profiles!line_group_applications_user_id_fkey(id, username), line_groups!line_group_applications_group_id_fkey(id, name, description, qr_code_url, manager_id, is_active, member_count, created_at, updated_at)')
      .eq('user_id', user.id)
      .order('created_at', desc=True)
    )
    
    if status_filter:
      query = query.eq('status', status_filter)
    
    response = query.execute()
    
    if hasattr(response, 'error') and response.error:
      error_msg = response.error
      if isinstance(response.error, dict):
        error_msg = response.error.get('message', str(response.error))
      print(f"[LIST_MY_APPLICATIONS] Error listing applications: {error_msg}")
      raise HTTPException(
        status.HTTP_500_INTERNAL_SERVER_ERROR,
        f"Failed to list applications: {error_msg}"
      )
    
    items = response.data or []
    result = []
    
    print(f"[LIST_MY_APPLICATIONS] Found {len(items)} applications for user {user.id}")
    
    for item in items:
      try:
        # 处理用户数据
        user_data = {}
        if item.get('profiles'):
          user_data = _serialize_manager(item)
        
        group_data = item.get('line_groups')
        
        # 处理时间字段
        created_at = item.get('created_at')
        if created_at:
          if isinstance(created_at, str):
            try:
              if created_at.endswith('Z'):
                created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
              else:
                created_at = datetime.fromisoformat(created_at)
            except (ValueError, AttributeError) as e:
              print(f"[LIST_MY_APPLICATIONS] Error parsing created_at: {e}, value: {created_at}")
              created_at = datetime.now()  # 默认值
          elif not isinstance(created_at, datetime):
            print(f"[LIST_MY_APPLICATIONS] Unexpected created_at type: {type(created_at)}")
            created_at = datetime.now()
        else:
          created_at = datetime.now()
        
        reviewed_at = item.get('reviewed_at')
        if reviewed_at and isinstance(reviewed_at, str):
          try:
            if reviewed_at.endswith('Z'):
              reviewed_at = datetime.fromisoformat(reviewed_at.replace('Z', '+00:00'))
            else:
              reviewed_at = datetime.fromisoformat(reviewed_at)
          except (ValueError, AttributeError):
            reviewed_at = None
        
        # 处理群组数据
        group_response_obj = None
        if group_data:
          try:
            group_created_at = group_data.get('created_at')
            if group_created_at and isinstance(group_created_at, str):
              try:
                if group_created_at.endswith('Z'):
                  group_created_at = datetime.fromisoformat(group_created_at.replace('Z', '+00:00'))
                else:
                  group_created_at = datetime.fromisoformat(group_created_at)
              except (ValueError, AttributeError):
                group_created_at = datetime.now()
            elif not isinstance(group_created_at, datetime):
              group_created_at = datetime.now()
            else:
              group_created_at = datetime.now()
            
            group_updated_at = group_data.get('updated_at')
            if group_updated_at and isinstance(group_updated_at, str):
              try:
                if group_updated_at.endswith('Z'):
                  group_updated_at = datetime.fromisoformat(group_updated_at.replace('Z', '+00:00'))
                else:
                  group_updated_at = datetime.fromisoformat(group_updated_at)
              except (ValueError, AttributeError):
                group_updated_at = None
            
            # 确保所有必需字段都存在（qr_code_url 可以为空字符串）
            if not group_data.get('id') or not group_data.get('name') or not group_data.get('manager_id'):
              print(f"[LIST_MY_APPLICATIONS] Missing required group fields: {group_data}")
              group_response_obj = None
            else:
              # qr_code_url 可以为空字符串
              qr_code_url = group_data.get('qr_code_url') or ''
              print(f"[LIST_MY_APPLICATIONS] Group {group_data.get('name')} qr_code_url: '{qr_code_url}' (type: {type(qr_code_url).__name__})")
              
              group_response_obj = LineGroupResponse(
                id=str(group_data.get('id', '')),
                name=str(group_data.get('name', '')),
                description=group_data.get('description'),
                qr_code_url=str(qr_code_url),
                manager_id=str(group_data.get('manager_id', '')),
                is_active=bool(group_data.get('is_active', True)),
                member_count=int(group_data.get('member_count', 0) or 0),
                created_at=group_created_at,
                updated_at=group_updated_at,
                manager=None,
              )
              print(f"[LIST_MY_APPLICATIONS] Created group_response_obj for {group_data.get('name')} with qr_code_url: '{group_response_obj.qr_code_url}'")
          except Exception as group_error:
            print(f"[LIST_MY_APPLICATIONS] Error processing group data: {group_error}")
            import traceback
            print(traceback.format_exc())
            group_response_obj = None
        
        # 创建用户对象
        user_obj = None
        if user_data:
          try:
            user_obj = Author(**user_data)
          except Exception as author_error:
            print(f"[LIST_MY_APPLICATIONS] Error creating Author object: {author_error}, data: {user_data}")
            user_obj = None
        
        # 创建响应对象
        try:
          application_response = LineGroupApplicationResponse(
            id=str(item.get('id', '')),
            user_id=str(item.get('user_id', '')),
            group_id=str(item.get('group_id', '')),
            message=item.get('message'),
            status=str(item.get('status', 'pending')),
            reviewed_by=item.get('reviewed_by'),
            reviewed_at=reviewed_at,
            created_at=created_at,
            user=user_obj,
            group=group_response_obj,
          )
          result.append(application_response)
          print(f"[LIST_MY_APPLICATIONS] Successfully added application {item.get('id')} to result")
        except Exception as response_error:
          print(f"[LIST_MY_APPLICATIONS] Error creating LineGroupApplicationResponse: {response_error}")
          import traceback
          print(traceback.format_exc())
          # 跳过这个项目，继续处理下一个
          continue
      except Exception as item_error:
        print(f"[LIST_MY_APPLICATIONS] Error processing application item {item.get('id', 'unknown')}: {item_error}")
        import traceback
        print(traceback.format_exc())
        continue
    
    print(f"[LIST_MY_APPLICATIONS] Returning {len(result)} applications")
    return result
  except HTTPException:
    raise
  except Exception as e:
    print(f"[LIST_MY_APPLICATIONS] Error in list_my_applications: {e}")
    import traceback
    traceback.print_exc()
    raise HTTPException(
      status.HTTP_500_INTERNAL_SERVER_ERROR,
      f"Failed to list applications: {str(e)}"
    )


@router.get('/my-managed-groups/applications', response_model=List[LineGroupApplicationResponse])
async def list_my_managed_groups_applications(
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_current_user),
  status_filter: Optional[str] = None,
):
  """List all applications for groups managed by the current user"""
  try:
    # 获取用户管理的所有群组
    groups_response = (
      supabase.table('line_groups')
      .select('id')
      .eq('manager_id', user.id)
      .eq('is_active', True)
      .execute()
    )
    
    if hasattr(groups_response, 'error') and groups_response.error:
      error_msg = groups_response.error
      if isinstance(groups_response.error, dict):
        error_msg = groups_response.error.get('message', str(groups_response.error))
      print(f"Error fetching managed groups: {error_msg}")
      return []
    
    managed_group_ids = [group['id'] for group in (groups_response.data or [])]
    
    if not managed_group_ids:
      return []
    
    # 获取这些群组的所有申请
    query = (
      supabase.table('line_group_applications')
      .select('id, user_id, group_id, message, status, reviewed_by, reviewed_at, created_at, profiles!line_group_applications_user_id_fkey(id, username), line_groups!line_group_applications_group_id_fkey(id, name, description, qr_code_url, manager_id, is_active, member_count, created_at, updated_at)')
      .in_('group_id', managed_group_ids)
      .order('created_at', desc=True)
    )
    
    if status_filter:
      query = query.eq('status', status_filter)
    
    response = query.execute()
    
    if hasattr(response, 'error') and response.error:
      error_msg = response.error
      if isinstance(response.error, dict):
        error_msg = response.error.get('message', str(response.error))
      print(f"Error listing applications: {error_msg}")
      return []
    
    items = response.data or []
    result = []
    
    for item in items:
      try:
        user_data = _serialize_manager(item) if item.get('profiles') else {}
        group_data = item.get('line_groups')
        
        created_at = item.get('created_at')
        reviewed_at = item.get('reviewed_at')
        
        if isinstance(created_at, str):
          try:
            if created_at.endswith('Z'):
              created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            else:
              created_at = datetime.fromisoformat(created_at)
          except (ValueError, AttributeError):
            pass
        
        if isinstance(reviewed_at, str) and reviewed_at:
          try:
            if reviewed_at.endswith('Z'):
              reviewed_at = datetime.fromisoformat(reviewed_at.replace('Z', '+00:00'))
            else:
              reviewed_at = datetime.fromisoformat(reviewed_at)
          except (ValueError, AttributeError):
            reviewed_at = None
        
        group_response_obj = None
        if group_data:
          group_created_at = group_data.get('created_at')
          group_updated_at = group_data.get('updated_at')
          
          if isinstance(group_created_at, str):
            try:
              if group_created_at.endswith('Z'):
                group_created_at = datetime.fromisoformat(group_created_at.replace('Z', '+00:00'))
              else:
                group_created_at = datetime.fromisoformat(group_created_at)
            except (ValueError, AttributeError):
              pass
          
          if isinstance(group_updated_at, str) and group_updated_at:
            try:
              if group_updated_at.endswith('Z'):
                group_updated_at = datetime.fromisoformat(group_updated_at.replace('Z', '+00:00'))
              else:
                group_updated_at = datetime.fromisoformat(group_updated_at)
            except (ValueError, AttributeError):
              group_updated_at = None
          
          group_response_obj = LineGroupResponse(
            id=str(group_data['id']),
            name=str(group_data['name']),
            description=group_data.get('description'),
            qr_code_url=str(group_data['qr_code_url']),
            manager_id=str(group_data['manager_id']),
            is_active=bool(group_data.get('is_active', True)),
            member_count=int(group_data.get('member_count', 0) or 0),
            created_at=group_created_at,
            updated_at=group_updated_at,
            manager=None,
          )
        
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
            group=group_response_obj,
          )
        )
      except Exception as item_error:
        print(f"Error processing application item {item.get('id', 'unknown')}: {item_error}")
        continue
    
    return result
  except HTTPException:
    raise
  except Exception as e:
    print(f"Error in list_my_managed_groups_applications: {e}")
    import traceback
    print(traceback.format_exc())
    return []


@router.get('/{group_id}/applications', response_model=List[LineGroupApplicationResponse])
async def list_group_applications(
  group_id: str,
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_admin_user),
  status_filter: Optional[str] = None,
):
  """List applications for a group (manager or admin only)"""
  # Check if user is admin or manager
  group_response = (
    supabase.table('line_groups')
    .select('manager_id')
    .eq('id', group_id)
    .single()
    .execute()
  )
  
  if hasattr(group_response, 'error') or not group_response.data:
    raise HTTPException(status.HTTP_404_NOT_FOUND, "Group not found")
  
  is_manager = group_response.data.get('manager_id') == user.id
  is_admin_user = _is_admin(user, supabase)
  
  if not is_manager and not is_admin_user:
    raise HTTPException(status.HTTP_403_FORBIDDEN, 'Only group manager or admin can view applications')
  
  try:
    query = (
      supabase.table('line_group_applications')
      .select('id, user_id, group_id, message, status, reviewed_by, reviewed_at, created_at, profiles!line_group_applications_user_id_fkey(id, username)')
      .eq('group_id', group_id)
    )
    
    if status_filter:
      query = query.eq('status', status_filter)
    
    # 先按 created_at 降序获取所有数据
    query = query.order('created_at', desc=True)
    
    response = query.execute()
    
    if hasattr(response, 'error') and response.error:
      error_msg = response.error
      if isinstance(response.error, dict):
        error_msg = response.error.get('message', str(response.error))
      print(f"Error listing applications: {error_msg}")
      return []
    
    items = response.data or []
    
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
      return (status_priority, -created_at_dt.timestamp() if hasattr(created_at_dt, 'timestamp') else 0)
    
    items.sort(key=sort_key)
    
    result = []
    
    for item in items:
      try:
        user_data = _serialize_manager(item) if item.get('profiles') else {}
        
        created_at = item.get('created_at')
        reviewed_at = item.get('reviewed_at')
        
        if isinstance(created_at, str):
          try:
            if created_at.endswith('Z'):
              created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            else:
              created_at = datetime.fromisoformat(created_at)
          except (ValueError, AttributeError):
            pass
        
        if isinstance(reviewed_at, str) and reviewed_at:
          try:
            if reviewed_at.endswith('Z'):
              reviewed_at = datetime.fromisoformat(reviewed_at.replace('Z', '+00:00'))
            else:
              reviewed_at = datetime.fromisoformat(reviewed_at)
          except (ValueError, AttributeError):
            reviewed_at = None
        
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
            group=None,
          )
        )
      except Exception as item_error:
        print(f"Error processing application item {item.get('id', 'unknown')}: {item_error}")
        continue
    
    return result
  except HTTPException:
    raise
  except Exception as e:
    print(f"Error in list_group_applications: {e}")
    import traceback
    print(traceback.format_exc())
    return []


@router.patch('/applications/{application_id}/review', response_model=LineGroupApplicationResponse)
async def review_application(
  application_id: str,
  payload: LineGroupApplicationReview,
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_admin_user),
):
  """Review a group application (manager or admin only)"""
  try:
    # Get application to check group
    app_response = (
      supabase.table('line_group_applications')
      .select('group_id')
      .eq('id', application_id)
      .single()
      .execute()
    )
    
    if hasattr(app_response, 'error') or not app_response.data:
      raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
    
    group_id = app_response.data.get('group_id')
    
    # Check if user is admin or manager
    group_response = (
      supabase.table('line_groups')
      .select('manager_id')
      .eq('id', group_id)
      .single()
      .execute()
    )
    
    if hasattr(group_response, 'error') or not group_response.data:
      raise HTTPException(status.HTTP_404_NOT_FOUND, "Group not found")
    
    is_manager = group_response.data.get('manager_id') == user.id
    is_admin_user = _is_admin(user, supabase)
    
    if not is_manager and not is_admin_user:
      raise HTTPException(status.HTTP_403_FORBIDDEN, 'Only group manager or admin can review applications')
    
    # Ensure reviewer's profile exists (required for foreign key constraint)
    try:
      profile_check = (
        supabase.table('profiles')
        .select('id')
        .eq('id', user.id)
        .limit(1)
        .execute()
      )
      
      if not profile_check.data or len(profile_check.data) == 0:
        # Profile doesn't exist, create it
        print(f"[review_application] Profile not found for reviewer {user.id}, creating profile...")
        profile_insert = {
          'id': user.id,
          'username': user.email.split('@')[0] if user.email else 'Admin',
        }
        profile_response = supabase.table('profiles').insert(profile_insert).execute()
        
        if hasattr(profile_response, 'error') and profile_response.error:
          error_msg = profile_response.error
          if isinstance(profile_response.error, dict):
            error_msg = profile_response.error.get('message', str(profile_response.error))
          print(f"[review_application] Failed to create profile: {error_msg}")
          # Continue anyway - the update might still work if the constraint allows NULL
    except Exception as profile_error:
      print(f"[review_application] Error checking/creating profile: {profile_error}")
      # Continue anyway
    
    update_payload = {
      'status': payload.status,
      'reviewed_by': user.id,
      'reviewed_at': datetime.utcnow().isoformat(),
    }
    
    response = (
      supabase.table('line_group_applications')
      .update(update_payload)
      .eq('id', application_id)
      .execute()
    )
    
    if hasattr(response, 'error') and response.error:
      error_msg = response.error
      if isinstance(response.error, dict):
        error_msg = response.error.get('message', str(response.error))
      raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Failed to review application: {error_msg}")
    
    if not response.data:
      raise HTTPException(status.HTTP_400_BAD_REQUEST, "Failed to review application")
    
    # If approved, increment member count
    if payload.status == 'approved':
      try:
        current_group = (
          supabase.table('line_groups')
          .select('member_count')
          .eq('id', group_id)
          .single()
          .execute()
        )
        if current_group.data:
          new_count = (current_group.data.get('member_count', 0) or 0) + 1
          supabase.table('line_groups').update({'member_count': new_count}).eq('id', group_id).execute()
      except Exception as count_error:
        print(f"Failed to increment member count: {count_error}")
        # Don't fail the review if count update fails
    
    # Fetch updated application
    detail_response = (
      supabase.table('line_group_applications')
      .select('id, user_id, group_id, message, status, reviewed_by, reviewed_at, created_at, profiles!line_group_applications_user_id_fkey(id, username)')
      .eq('id', application_id)
      .single()
      .execute()
    )
    
    if hasattr(detail_response, 'error') or not detail_response.data:
      record = response.data[0]
      return LineGroupApplicationResponse(
        id=str(record['id']),
        user_id=str(record['user_id']),
        group_id=str(record['group_id']),
        message=record.get('message'),
        status=str(record['status']),
        reviewed_by=record.get('reviewed_by'),
        reviewed_at=datetime.fromisoformat(record['reviewed_at']) if record.get('reviewed_at') else None,
        created_at=datetime.fromisoformat(record['created_at']) if isinstance(record.get('created_at'), str) else record.get('created_at'),
      )
    
    record = detail_response.data
    user_data = _serialize_manager(record) if record.get('profiles') else {}
    
    created_at = record.get('created_at')
    reviewed_at = record.get('reviewed_at')
    
    if isinstance(created_at, str):
      try:
        if created_at.endswith('Z'):
          created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        else:
          created_at = datetime.fromisoformat(created_at)
      except (ValueError, AttributeError):
        pass
    
    if isinstance(reviewed_at, str) and reviewed_at:
      try:
        if reviewed_at.endswith('Z'):
          reviewed_at = datetime.fromisoformat(reviewed_at.replace('Z', '+00:00'))
        else:
          reviewed_at = datetime.fromisoformat(reviewed_at)
      except (ValueError, AttributeError):
        reviewed_at = None
    
    return LineGroupApplicationResponse(
      id=str(record['id']),
      user_id=str(record['user_id']),
      group_id=str(record['group_id']),
      message=record.get('message'),
      status=str(record['status']),
      reviewed_by=record.get('reviewed_by'),
      reviewed_at=reviewed_at,
      created_at=created_at,
      user=Author(**user_data) if user_data else None,
      group=None,
    )
  except HTTPException:
    raise
  except Exception as e:
    print(f"Error in review_application: {e}")
    import traceback
    print(traceback.format_exc())
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to review application: {str(e)}")


# ============================================
# LINE 群组举报
# ============================================

@router.post('/{group_id}/report', response_model=LineGroupReportResponse, status_code=status.HTTP_201_CREATED)
async def report_group(
  group_id: str,
  payload: LineGroupReportCreate,
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_current_user),
):
  """Report a LINE group"""
  if payload.group_id != group_id:
    raise HTTPException(status.HTTP_400_BAD_REQUEST, "Group ID mismatch")
  
  try:
    # Check if group exists
    group_response = (
      supabase.table('line_groups')
      .select('id')
      .eq('id', group_id)
      .single()
      .execute()
    )
    
    if hasattr(group_response, 'error') or not group_response.data:
      raise HTTPException(status.HTTP_404_NOT_FOUND, "Group not found")
    
    insert_payload = {
      'group_id': group_id,
      'reporter_id': user.id,
      'reason': payload.reason,
      'status': 'pending',
    }
    
    if payload.description:
      insert_payload['description'] = payload.description
    
    response = supabase.table('line_group_reports').insert(insert_payload).execute()
    
    if hasattr(response, 'error') and response.error:
      error_msg = response.error
      if isinstance(response.error, dict):
        error_msg = response.error.get('message', str(response.error))
      raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Failed to create report: {error_msg}")
    
    if not response.data:
      raise HTTPException(status.HTTP_400_BAD_REQUEST, "Failed to create report")
    
    report_id = response.data[0]['id']
    
    # Fetch the created report
    detail_response = (
      supabase.table('line_group_reports')
      .select('id, group_id, reporter_id, reason, description, status, reviewed_by, reviewed_at, created_at, profiles!line_group_reports_reporter_id_fkey(id, username), line_groups!line_group_reports_group_id_fkey(id, name, description, qr_code_url, manager_id, is_active, member_count, created_at, updated_at)')
      .eq('id', report_id)
      .single()
      .execute()
    )
    
    if hasattr(detail_response, 'error') or not detail_response.data:
      record = response.data[0]
      return LineGroupReportResponse(
        id=str(record['id']),
        group_id=str(record['group_id']),
        reporter_id=str(record['reporter_id']),
        reason=str(record['reason']),
        description=record.get('description'),
        status=str(record['status']),
        reviewed_by=record.get('reviewed_by'),
        reviewed_at=datetime.fromisoformat(record['reviewed_at']) if record.get('reviewed_at') else None,
        created_at=datetime.fromisoformat(record['created_at']) if isinstance(record.get('created_at'), str) else record.get('created_at'),
      )
    
    record = detail_response.data
    reporter_data = _serialize_manager(record) if record.get('profiles') else {}
    group_data = record.get('line_groups')
    
    created_at = record.get('created_at')
    reviewed_at = record.get('reviewed_at')
    
    if isinstance(created_at, str):
      try:
        if created_at.endswith('Z'):
          created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        else:
          created_at = datetime.fromisoformat(created_at)
      except (ValueError, AttributeError):
        pass
    
    if isinstance(reviewed_at, str) and reviewed_at:
      try:
        if reviewed_at.endswith('Z'):
          reviewed_at = datetime.fromisoformat(reviewed_at.replace('Z', '+00:00'))
        else:
          reviewed_at = datetime.fromisoformat(reviewed_at)
      except (ValueError, AttributeError):
        reviewed_at = None
    
    group_response_obj = None
    if group_data:
      group_created_at = group_data.get('created_at')
      group_updated_at = group_data.get('updated_at')
      
      if isinstance(group_created_at, str):
        try:
          if group_created_at.endswith('Z'):
            group_created_at = datetime.fromisoformat(group_created_at.replace('Z', '+00:00'))
          else:
            group_created_at = datetime.fromisoformat(group_created_at)
        except (ValueError, AttributeError):
          pass
      
      if isinstance(group_updated_at, str) and group_updated_at:
        try:
          if group_updated_at.endswith('Z'):
            group_updated_at = datetime.fromisoformat(group_updated_at.replace('Z', '+00:00'))
          else:
            group_updated_at = datetime.fromisoformat(group_updated_at)
        except (ValueError, AttributeError):
          group_updated_at = None
      
      group_response_obj = LineGroupResponse(
        id=str(group_data['id']),
        name=str(group_data['name']),
        description=group_data.get('description'),
        qr_code_url=str(group_data['qr_code_url']),
        manager_id=str(group_data['manager_id']),
        is_active=bool(group_data.get('is_active', True)),
        member_count=int(group_data.get('member_count', 0) or 0),
        created_at=group_created_at,
        updated_at=group_updated_at,
        manager=None,
      )
    
    return LineGroupReportResponse(
      id=str(record['id']),
      group_id=str(record['group_id']),
      reporter_id=str(record['reporter_id']),
      reason=str(record['reason']),
      description=record.get('description'),
      status=str(record['status']),
      reviewed_by=record.get('reviewed_by'),
      reviewed_at=reviewed_at,
      created_at=created_at,
      reporter=Author(**reporter_data) if reporter_data else None,
      group=group_response_obj,
    )
  except HTTPException:
    raise
  except Exception as e:
    print(f"Error in report_group: {e}")
    import traceback
    print(traceback.format_exc())
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to create report: {str(e)}")


@router.patch('/reports/{report_id}/review', response_model=LineGroupReportResponse)
async def review_report(
  report_id: str,
  payload: LineGroupApplicationReview,  # Reuse same schema for status update
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_admin_user),
):
  """Review a report (admin only)"""
  if not _is_admin(user, supabase):
    raise HTTPException(status.HTTP_403_FORBIDDEN, 'Admin access required')
  
  try:
    # Map status values for reports
    status_mapping = {
      'approved': 'resolved',
      'rejected': 'dismissed',
    }
    report_status = status_mapping.get(payload.status, payload.status)
    
    # Ensure reviewer's profile exists (required for foreign key constraint)
    try:
      profile_check = (
        supabase.table('profiles')
        .select('id')
        .eq('id', user.id)
        .limit(1)
        .execute()
      )
      
      if not profile_check.data or len(profile_check.data) == 0:
        # Profile doesn't exist, create it
        print(f"[review_report] Profile not found for reviewer {user.id}, creating profile...")
        profile_insert = {
          'id': user.id,
          'username': user.email.split('@')[0] if user.email else 'Admin',
        }
        profile_response = supabase.table('profiles').insert(profile_insert).execute()
        
        if hasattr(profile_response, 'error') and profile_response.error:
          error_msg = profile_response.error
          if isinstance(profile_response.error, dict):
            error_msg = profile_response.error.get('message', str(profile_response.error))
          print(f"[review_report] Failed to create profile: {error_msg}")
    except Exception as profile_error:
      print(f"[review_report] Error checking/creating profile: {profile_error}")
    
    update_payload = {
      'status': report_status,
      'reviewed_by': user.id,
      'reviewed_at': datetime.utcnow().isoformat(),
    }
    
    response = (
      supabase.table('line_group_reports')
      .update(update_payload)
      .eq('id', report_id)
      .execute()
    )
    
    if hasattr(response, 'error') and response.error:
      error_msg = response.error
      if isinstance(response.error, dict):
        error_msg = response.error.get('message', str(response.error))
      raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Failed to review report: {error_msg}")
    
    if not response.data:
      raise HTTPException(status.HTTP_400_BAD_REQUEST, "Failed to review report")
    
    # Fetch updated report
    detail_response = (
      supabase.table('line_group_reports')
      .select('id, group_id, reporter_id, reason, description, status, reviewed_by, reviewed_at, created_at, profiles!line_group_reports_reporter_id_fkey(id, username), line_groups!line_group_reports_group_id_fkey(id, name, description, qr_code_url, manager_id, is_active, member_count, created_at, updated_at)')
      .eq('id', report_id)
      .single()
      .execute()
    )
    
    if hasattr(detail_response, 'error') or not detail_response.data:
      record = response.data[0]
      return LineGroupReportResponse(
        id=str(record['id']),
        group_id=str(record['group_id']),
        reporter_id=str(record['reporter_id']),
        reason=str(record['reason']),
        description=record.get('description'),
        status=str(record['status']),
        reviewed_by=record.get('reviewed_by'),
        reviewed_at=datetime.fromisoformat(record['reviewed_at']) if record.get('reviewed_at') else None,
        created_at=datetime.fromisoformat(record['created_at']) if isinstance(record.get('created_at'), str) else record.get('created_at'),
      )
    
    record = detail_response.data
    reporter_data = _serialize_manager(record) if record.get('profiles') else {}
    group_data = record.get('line_groups')
    
    created_at = record.get('created_at')
    reviewed_at = record.get('reviewed_at')
    
    if isinstance(created_at, str):
      try:
        if created_at.endswith('Z'):
          created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        else:
          created_at = datetime.fromisoformat(created_at)
      except (ValueError, AttributeError):
        pass
    
    if isinstance(reviewed_at, str) and reviewed_at:
      try:
        if reviewed_at.endswith('Z'):
          reviewed_at = datetime.fromisoformat(reviewed_at.replace('Z', '+00:00'))
        else:
          reviewed_at = datetime.fromisoformat(reviewed_at)
      except (ValueError, AttributeError):
        reviewed_at = None
    
    group_response_obj = None
    if group_data:
      group_created_at = group_data.get('created_at')
      group_updated_at = group_data.get('updated_at')
      
      if isinstance(group_created_at, str):
        try:
          if group_created_at.endswith('Z'):
            group_created_at = datetime.fromisoformat(group_created_at.replace('Z', '+00:00'))
          else:
            group_created_at = datetime.fromisoformat(group_created_at)
        except (ValueError, AttributeError):
          pass
      
      if isinstance(group_updated_at, str) and group_updated_at:
        try:
          if group_updated_at.endswith('Z'):
            group_updated_at = datetime.fromisoformat(group_updated_at.replace('Z', '+00:00'))
          else:
            group_updated_at = datetime.fromisoformat(group_updated_at)
        except (ValueError, AttributeError):
          group_updated_at = None
      
      group_response_obj = LineGroupResponse(
        id=str(group_data['id']),
        name=str(group_data['name']),
        description=group_data.get('description'),
        qr_code_url=str(group_data['qr_code_url']),
        manager_id=str(group_data['manager_id']),
        is_active=bool(group_data.get('is_active', True)),
        member_count=int(group_data.get('member_count', 0) or 0),
        created_at=group_created_at,
        updated_at=group_updated_at,
        manager=None,
      )
    
    return LineGroupReportResponse(
      id=str(record['id']),
      group_id=str(record['group_id']),
      reporter_id=str(record['reporter_id']),
      reason=str(record['reason']),
      description=record.get('description'),
      status=str(record['status']),
      reviewed_by=record.get('reviewed_by'),
      reviewed_at=reviewed_at,
      created_at=created_at,
      reporter=Author(**reporter_data) if reporter_data else None,
      group=group_response_obj,
    )
  except HTTPException:
    raise
  except Exception as e:
    print(f"Error in review_report: {e}")
    import traceback
    print(traceback.format_exc())
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to review report: {str(e)}")


# ============================================
# LINE 群组创建申请（POST 和 PATCH 路由）
# ============================================

@router.post('/creation-requests', response_model=LineGroupCreationRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_group_request(
  payload: LineGroupCreationRequestCreate,
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_current_user),
):
  """普通用户申请创建新的 LINE 群组"""
  try:
    # Ensure profile exists before creating request
    profile_check = (
      supabase.table('profiles')
      .select('id')
      .eq('id', user.id)
      .execute()
    )
    
    if not profile_check.data or len(profile_check.data) == 0:
      # Profile doesn't exist, create it
      print(f"[CREATE_GROUP_REQUEST] Profile not found for user {user.id}, creating profile...")
      profile_insert = {
        'id': user.id,
        'username': user.email.split('@')[0] if user.email else 'User',
      }
      profile_response = supabase.table('profiles').insert(profile_insert).execute()
      
      if hasattr(profile_response, 'error') and profile_response.error:
        error_msg = profile_response.error
        if isinstance(profile_response.error, dict):
          error_msg = profile_response.error.get('message', str(profile_response.error))
        print(f"[CREATE_GROUP_REQUEST] Failed to create profile: {error_msg}")
        raise HTTPException(
          status.HTTP_500_INTERNAL_SERVER_ERROR,
          f"Failed to create user profile: {error_msg}"
        )
      
      print(f"[CREATE_GROUP_REQUEST] ✅ Profile created for user {user.id}")
    
    insert_payload = {
      'requester_id': user.id,
      'name': payload.name,
      'qr_code_url': payload.qr_code_url,
      'is_private': payload.is_private or False,
      'status': 'pending',
    }
    
    if payload.description:
      insert_payload['description'] = payload.description
    
    response = supabase.table('line_group_creation_requests').insert(insert_payload).execute()
    
    if hasattr(response, 'error') and response.error:
      error_msg = response.error
      if isinstance(response.error, dict):
        error_msg = response.error.get('message', str(response.error))
      raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Failed to create request: {error_msg}")
    
    if not response.data:
      raise HTTPException(status.HTTP_400_BAD_REQUEST, "Failed to create request")
    
    request_id = response.data[0]['id']
    
    # Fetch the created request with requester info
    detail_response = (
      supabase.table('line_group_creation_requests')
      .select('id, requester_id, name, description, qr_code_url, is_private, status, reviewed_by, reviewed_at, rejection_reason, created_at, updated_at, profiles!requester_id(id, username)')
      .eq('id', request_id)
      .single()
      .execute()
    )
    
    if hasattr(detail_response, 'error') or not detail_response.data:
      record = response.data[0]
      return LineGroupCreationRequestResponse(
        id=str(record['id']),
        requester_id=str(record['requester_id']),
        name=str(record['name']),
        description=record.get('description'),
        qr_code_url=str(record['qr_code_url']),
        is_private=record.get('is_private', False),
        status=str(record['status']),
        reviewed_by=record.get('reviewed_by'),
        reviewed_at=datetime.fromisoformat(record['reviewed_at']) if record.get('reviewed_at') else None,
        rejection_reason=record.get('rejection_reason'),
        created_at=datetime.fromisoformat(record['created_at']) if isinstance(record.get('created_at'), str) else record.get('created_at'),
        updated_at=datetime.fromisoformat(record['updated_at']) if record.get('updated_at') else None,
      )
    
    record = detail_response.data
    requester_data = _serialize_manager(record) if record.get('profiles') else {}
    
    created_at = record.get('created_at')
    updated_at = record.get('updated_at')
    reviewed_at = record.get('reviewed_at')
    
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
    
    if isinstance(reviewed_at, str) and reviewed_at:
      try:
        if reviewed_at.endswith('Z'):
          reviewed_at = datetime.fromisoformat(reviewed_at.replace('Z', '+00:00'))
        else:
          reviewed_at = datetime.fromisoformat(reviewed_at)
      except (ValueError, AttributeError):
        reviewed_at = None
    
    return LineGroupCreationRequestResponse(
      id=str(record['id']),
      requester_id=str(record['requester_id']),
      name=str(record['name']),
      description=record.get('description'),
      qr_code_url=str(record['qr_code_url']),
      is_private=record.get('is_private', False),
      status=str(record['status']),
      reviewed_by=record.get('reviewed_by'),
      reviewed_at=reviewed_at,
      rejection_reason=record.get('rejection_reason'),
      created_at=created_at,
      updated_at=updated_at,
      requester=Author(**requester_data) if requester_data else None,
    )
  except HTTPException:
    raise
  except Exception as e:
    print(f"Error in create_group_request: {e}")
    import traceback
    print(traceback.format_exc())
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to create request: {str(e)}")


@router.patch('/creation-requests/{request_id}/review', response_model=LineGroupCreationRequestResponse)
async def review_creation_request(
  request_id: str,
  payload: LineGroupCreationRequestReview,
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_admin_user),
):
  """Admin 审核创建群组申请"""
  if not _is_admin(user, supabase):
    raise HTTPException(status.HTTP_403_FORBIDDEN, 'Admin access required')
  
  try:
    # 获取申请信息
    request_response = (
      supabase.table('line_group_creation_requests')
      .select('*')
      .eq('id', request_id)
      .single()
      .execute()
    )
    
    if hasattr(request_response, 'error') or not request_response.data:
      raise HTTPException(status.HTTP_404_NOT_FOUND, "Request not found")
    
    request_data = request_response.data
    
    # 如果已经审核过，不允许再次审核
    if request_data.get('status') != 'pending':
      raise HTTPException(status.HTTP_400_BAD_REQUEST, "Request has already been reviewed")
    
    # Ensure reviewer's profile exists (required for foreign key constraint)
    try:
      profile_check = (
        supabase.table('profiles')
        .select('id')
        .eq('id', user.id)
        .limit(1)
        .execute()
      )
      
      if not profile_check.data or len(profile_check.data) == 0:
        # Profile doesn't exist, create it
        print(f"[review_creation_request] Profile not found for reviewer {user.id}, creating profile...")
        profile_insert = {
          'id': user.id,
          'username': user.email.split('@')[0] if user.email else 'Admin',
        }
        profile_response = supabase.table('profiles').insert(profile_insert).execute()
        
        if hasattr(profile_response, 'error') and profile_response.error:
          error_msg = profile_response.error
          if isinstance(profile_response.error, dict):
            error_msg = profile_response.error.get('message', str(profile_response.error))
          print(f"[review_creation_request] Failed to create profile: {error_msg}")
    except Exception as profile_error:
      print(f"[review_creation_request] Error checking/creating profile: {profile_error}")
    
    update_payload = {
      'status': payload.status,
      'reviewed_by': user.id,
      'reviewed_at': datetime.utcnow().isoformat(),
    }
    
    if payload.status == 'rejected' and payload.rejection_reason:
      update_payload['rejection_reason'] = payload.rejection_reason
    
    # 更新申请状态
    response = (
      supabase.table('line_group_creation_requests')
      .update(update_payload)
      .eq('id', request_id)
      .execute()
    )
    
    if hasattr(response, 'error') and response.error:
      error_msg = response.error
      if isinstance(response.error, dict):
        error_msg = response.error.get('message', str(response.error))
      raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Failed to review request: {error_msg}")
    
    # 如果审核通过，创建群组
    if payload.status == 'approved':
      # 检查是否是私人群组
      is_private = request_data.get('is_private', False)
      
      # 如果是私人群组，检查并扣除积分
      if is_private:
        profile_resp = (
          supabase.table('profiles')
          .select('total_points')
          .eq('id', request_data['requester_id'])
          .limit(1)
          .execute()
        )
        if profile_resp.data and len(profile_resp.data) > 0:
          current_points = profile_resp.data[0].get('total_points', 0) or 0
          if current_points < 30:
            raise HTTPException(
              status.HTTP_400_BAD_REQUEST,
              f"Insufficient points to create private group. Required: 30, Current: {current_points}"
            )
          # 扣除积分
          if not deduct_points(supabase, request_data['requester_id'], 30, '创建私人群组'):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Failed to deduct points for private group creation")
      
      group_insert_payload = {
        'name': request_data['name'],
        'description': request_data.get('description'),
        'qr_code_url': request_data['qr_code_url'],
        'manager_id': request_data['requester_id'],  # 申请创建的用户成为版主
        'is_active': True,
        'is_private': is_private,
        'member_count': 0,
        'admin_approved': True,  # 标记为已通过 admin 审核
      }
      
      group_response = supabase.table('line_groups').insert(group_insert_payload).execute()
      
      if hasattr(group_response, 'error') and group_response.error:
        error_msg = group_response.error
        if isinstance(group_response.error, dict):
          error_msg = group_response.error.get('message', str(group_response.error))
        print(f"Warning: Failed to create group after approval: {error_msg}")
        # 不抛出异常，因为申请状态已经更新
      else:
        # 奖励创建群组积分 (+20) - 只有非私人群组才奖励，私人群组已经扣除积分
        if not is_private:
          try:
            success = award_points(supabase, request_data['requester_id'], 20, '创建群组')
            if not success:
              print(f"[REVIEW_GROUP_REQUEST] Failed to award points to user {request_data['requester_id']} for creating group")
          except Exception as e:
            print(f"[REVIEW_GROUP_REQUEST] Error awarding points: {e}")
    
    # 获取更新后的申请信息
    detail_response = (
      supabase.table('line_group_creation_requests')
      .select('id, requester_id, name, description, qr_code_url, is_private, status, reviewed_by, reviewed_at, rejection_reason, created_at, updated_at, profiles!requester_id(id, username)')
      .eq('id', request_id)
      .single()
      .execute()
    )
    
    if hasattr(detail_response, 'error') or not detail_response.data:
      record = response.data[0] if response.data else request_data
      return LineGroupCreationRequestResponse(
        id=str(record['id']),
        requester_id=str(record['requester_id']),
        name=str(record['name']),
        description=record.get('description'),
        qr_code_url=str(record['qr_code_url']),
        is_private=record.get('is_private', False),
        status=str(record['status']),
        reviewed_by=record.get('reviewed_by'),
        reviewed_at=datetime.fromisoformat(record['reviewed_at']) if record.get('reviewed_at') else None,
        rejection_reason=record.get('rejection_reason'),
        created_at=datetime.fromisoformat(record['created_at']) if isinstance(record.get('created_at'), str) else record.get('created_at'),
        updated_at=datetime.fromisoformat(record['updated_at']) if record.get('updated_at') else None,
      )
    
    record = detail_response.data
    requester_data = _serialize_manager(record) if record.get('profiles') else {}
    
    created_at = record.get('created_at')
    updated_at = record.get('updated_at')
    reviewed_at = record.get('reviewed_at')
    
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
    
    if isinstance(reviewed_at, str) and reviewed_at:
      try:
        if reviewed_at.endswith('Z'):
          reviewed_at = datetime.fromisoformat(reviewed_at.replace('Z', '+00:00'))
        else:
          reviewed_at = datetime.fromisoformat(reviewed_at)
      except (ValueError, AttributeError):
        reviewed_at = None
    
    return LineGroupCreationRequestResponse(
      id=str(record['id']),
      requester_id=str(record['requester_id']),
      name=str(record['name']),
      description=record.get('description'),
      qr_code_url=str(record['qr_code_url']),
      is_private=record.get('is_private', False),
      status=str(record['status']),
      reviewed_by=record.get('reviewed_by'),
      reviewed_at=reviewed_at,
      rejection_reason=record.get('rejection_reason'),
      created_at=created_at,
      updated_at=updated_at,
      requester=Author(**requester_data) if requester_data else None,
    )
  except HTTPException:
    raise
  except Exception as e:
    print(f"Error in review_creation_request: {e}")
    import traceback
    print(traceback.format_exc())
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to review request: {str(e)}")

