# Admin Post Management and Tags Pagination Endpoints
# Add these to backend/app/routers/admin.py

@router.get('/posts', response_model=PaginatedPostResponse)
async def list_all_posts(
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_admin_user),
  page: int = 1,
  page_size: int = 10,
  category: Optional[str] = None,
  status_filter: Optional[str] = None, # 'active', 'closed'
  search: Optional[str] = None,
):
  """List all posts for admin management with pagination and filtering"""
  if not _is_admin(user, supabase):
    raise HTTPException(status.HTTP_403_FORBIDDEN, 'Admin access required')

  try:
    if page < 1:
      page = 1
    if page_size < 1 or page_size > 100:
      page_size = 10
    
    offset = (page - 1) * page_size
    
    query = (
      supabase.table('posts')
      .select(
        'id, title, category, summary, cover_image_url, author_id, created_at, updated_at, '
        'tags, view_count, upvote_count, downvote_count, is_closed, is_pinned, pinned_at, '
        'profiles(id, username, avatar_url)',
        count='exact'
      )
    )
    
    # Apply filters
    if category:
      query = query.eq('category', category)
    
    if status_filter == 'closed':
      query = query.eq('is_closed', True)
    elif status_filter == 'active':
      query = query.eq('is_closed', False)
    
    if search:
      # Search in title (Supabase doesn't support OR in filters easily, so we'll filter in Python)
      pass
      
    response = (
      query
      .order('created_at', desc=True)
      .range(offset, offset + page_size - 1)
      .execute()
    )
    
    if hasattr(response, 'error') and response.error:
      error_msg = response.error
      if isinstance(response.error, dict):
        error_msg = response.error.get('message', str(response.error))
      raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to fetch posts: {error_msg}")
      
    total = response.count if hasattr(response, 'count') and response.count is not None else 0
    items = response.data or []
    
    # Apply search filter if provided
    if search:
      search_lower = search.lower()
      items = [item for item in items if search_lower in item.get('title', '').lower()]
      total = len(items)
    
    result = []
    for item in items:
      try:
        author_data = {}
        if item.get('profiles'):
          profile_data = item['profiles']
          if isinstance(profile_data, list) and len(profile_data) > 0:
            profile_data = profile_data[0]
          author_data = {
            'id': profile_data.get('id'),
            'username': profile_data.get('username'),
            'avatar_url': profile_data.get('avatar_url'),
          }
        
        # Handle datetime conversion
        created_at = item.get('created_at')
        updated_at = item.get('updated_at')
        pinned_at = item.get('pinned_at')
        
        if isinstance(created_at, str):
          try:
            if created_at.endswith('Z'):
              created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            else:
              created_at = datetime.fromisoformat(created_at)
          except (ValueError, AttributeError):
            created_at = datetime.now()
            
        if isinstance(updated_at, str) and updated_at:
          try:
            if updated_at.endswith('Z'):
              updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
            else:
              updated_at = datetime.fromisoformat(updated_at)
          except (ValueError, AttributeError):
            updated_at = None
            
        if isinstance(pinned_at, str) and pinned_at:
          try:
            if pinned_at.endswith('Z'):
              pinned_at = datetime.fromisoformat(pinned_at.replace('Z', '+00:00'))
            else:
              pinned_at = datetime.fromisoformat(pinned_at)
          except (ValueError, AttributeError):
            pinned_at = None
            
        result.append(
          PostResponse(
            id=str(item['id']),
            title=str(item['title']),
            category=item.get('category'),
            summary=item.get('summary'),
            cover_image_url=item.get('cover_image_url'),
            author_id=str(item['author_id']),
            created_at=created_at,
            updated_at=updated_at,
            reply_count=0, # Not fetching reply count for admin list to save performance
            view_count=int(item.get('view_count', 0) or 0),
            upvote_count=int(item.get('upvote_count', 0) or 0),
            downvote_count=int(item.get('downvote_count', 0) or 0),
            tags=item.get('tags') if isinstance(item.get('tags'), list) else None,
            is_closed=bool(item.get('is_closed', False)),
            is_pinned=bool(item.get('is_pinned', False)),
            pinned_at=pinned_at,
            author=Author(**author_data) if author_data else None,
          )
        )
      except Exception as item_error:
        print(f"Error processing post item {item.get('id', 'unknown')}: {item_error}")
        continue
        
    return PaginatedPostResponse(
      items=result,
      total=total,
      page=page,
      page_size=page_size,
      total_pages=(total + page_size - 1) // page_size if total > 0 else 0
    )
  except HTTPException:
    raise
  except Exception as e:
    import traceback
    print(f"Error in list_all_posts: {e}")
    print(traceback.format_exc())
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to fetch posts: {str(e)}")


@router.patch('/posts/{post_id}')
async def update_post(
  post_id: str,
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_admin_user),
  title: Optional[str] = None,
  category: Optional[str] = None,
  tags: Optional[List[str]] = None,
  is_closed: Optional[bool] = None,
  is_pinned: Optional[bool] = None,
):
  """Update post (admin only)"""
  if not _is_admin(user, supabase):
    raise HTTPException(status.HTTP_403_FORBIDDEN, 'Admin access required')

  try:
    update_data = {}
    if title is not None:
      update_data['title'] = title
    if category is not None:
      update_data['category'] = category
    if tags is not None:
      update_data['tags'] = tags
    if is_closed is not None:
      update_data['is_closed'] = is_closed
    if is_pinned is not None:
      update_data['is_pinned'] = is_pinned
      if is_pinned:
        update_data['pinned_at'] = datetime.utcnow().isoformat() + 'Z'
      else:
        update_data['pinned_at'] = None
    
    if not update_data:
      raise HTTPException(status.HTTP_400_BAD_REQUEST, "No update data provided")
    
    response = (
      supabase.table('posts')
      .update(update_data)
      .eq('id', post_id)
      .execute()
    )
    
    if hasattr(response, 'error') and response.error:
      error_msg = response.error
      if isinstance(response.error, dict):
        error_msg = response.error.get('message', str(response.error))
      raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Failed to update post: {error_msg}")
    
    return {'success': True, 'post_id': post_id}
  except HTTPException:
    raise
  except Exception as e:
    import traceback
    print(f"Error in update_post: {e}")
    print(traceback.format_exc())
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to update post: {str(e)}")


@router.delete('/posts/{post_id}')
async def delete_post(
  post_id: str,
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_admin_user),
):
  """Delete post (admin only)"""
  if not _is_admin(user, supabase):
    raise HTTPException(status.HTTP_403_FORBIDDEN, 'Admin access required')

  try:
    # Delete post replies first
    supabase.table('post_replies').delete().eq('post_id', post_id).execute()
    
    # Delete post
    response = (
      supabase.table('posts')
      .delete()
      .eq('id', post_id)
      .execute()
    )
    
    if hasattr(response, 'error') and response.error:
      error_msg = response.error
      if isinstance(response.error, dict):
        error_msg = response.error.get('message', str(response.error))
      raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Failed to delete post: {error_msg}")
    
    return {'success': True, 'post_id': post_id}
  except HTTPException:
    raise
  except Exception as e:
    import traceback
    print(f"Error in delete_post: {e}")
    print(traceback.format_exc())
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to delete post: {str(e)}")
