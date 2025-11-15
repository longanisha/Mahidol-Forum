import asyncio
from datetime import datetime
from typing import Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status

from ..auth import AuthenticatedUser, get_current_user, get_optional_user
from ..dependencies import SupabaseClientDep
from ..schemas import ReportCreate, ReportResponse, VoteRequest
from ..utils.points import award_points

router = APIRouter(tags=['votes-reports'])


# Post Vote endpoints
@router.post('/posts/{post_id}/vote', status_code=status.HTTP_200_OK)
async def vote_post(
  post_id: str,
  payload: VoteRequest,
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_current_user),
):
  """Vote (upvote/downvote) on a post"""
  try:
    # Check if post exists (with timeout)
    try:
      post_check = await asyncio.wait_for(
        asyncio.to_thread(
          lambda: supabase.table('posts').select('id').eq('id', post_id).execute()
        ),
        timeout=10.0
      )
    except asyncio.TimeoutError:
      raise HTTPException(status.HTTP_408_REQUEST_TIMEOUT, 'Operation timed out. Please try again.')
    
    if not post_check.data or len(post_check.data) == 0:
      raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found")
    
    # Check if user already voted (with timeout)
    try:
      existing_vote = await asyncio.wait_for(
        asyncio.to_thread(
          lambda: (
            supabase.table('thread_votes')
            .select('id, vote_type')
            .eq('thread_id', post_id)
            .eq('user_id', user.id)
            .execute()
          )
        ),
        timeout=10.0
      )
    except asyncio.TimeoutError:
      raise HTTPException(status.HTTP_408_REQUEST_TIMEOUT, 'Operation timed out. Please try again.')
    
    if existing_vote.data and len(existing_vote.data) > 0:
      existing_vote_type = existing_vote.data[0]['vote_type']
      if existing_vote_type == payload.vote_type:
        # Same vote, remove it (toggle off)
        try:
          await asyncio.wait_for(
            asyncio.to_thread(
              lambda: supabase.table('thread_votes').delete().eq('id', existing_vote.data[0]['id']).execute()
            ),
            timeout=10.0
          )
        except asyncio.TimeoutError:
          raise HTTPException(status.HTTP_408_REQUEST_TIMEOUT, 'Operation timed out. Please try again.')
      else:
        # Different vote, update it
        try:
          await asyncio.wait_for(
            asyncio.to_thread(
              lambda: supabase.table('thread_votes').update({'vote_type': payload.vote_type}).eq('id', existing_vote.data[0]['id']).execute()
            ),
            timeout=10.0
          )
        except asyncio.TimeoutError:
          raise HTTPException(status.HTTP_408_REQUEST_TIMEOUT, 'Operation timed out. Please try again.')
    else:
      # New vote
      try:
        await asyncio.wait_for(
          asyncio.to_thread(
            lambda: supabase.table('thread_votes').insert({
              'thread_id': post_id,
              'user_id': user.id,
              'vote_type': payload.vote_type,
            }).execute()
          ),
          timeout=10.0
        )
      except asyncio.TimeoutError:
        raise HTTPException(status.HTTP_408_REQUEST_TIMEOUT, 'Operation timed out. Please try again.')
    
    # Recalculate vote counts (with timeout)
    try:
      upvotes, downvotes = await asyncio.wait_for(
        asyncio.to_thread(
          lambda: (
            supabase.table('thread_votes').select('id', count='exact').eq('thread_id', post_id).eq('vote_type', 'upvote').execute(),
            supabase.table('thread_votes').select('id', count='exact').eq('thread_id', post_id).eq('vote_type', 'downvote').execute()
          )
        ),
        timeout=10.0
      )
    except asyncio.TimeoutError:
      raise HTTPException(status.HTTP_408_REQUEST_TIMEOUT, 'Operation timed out. Please try again.')
    
    upvote_count = upvotes.count if hasattr(upvotes, 'count') and upvotes.count is not None else len(upvotes.data or [])
    downvote_count = downvotes.count if hasattr(downvotes, 'count') and downvotes.count is not None else len(downvotes.data or [])
    
    # Update post counts (with timeout)
    try:
      await asyncio.wait_for(
        asyncio.to_thread(
          lambda: supabase.table('posts').update({
            'upvote_count': upvote_count,
            'downvote_count': downvote_count,
          }).eq('id', post_id).execute()
        ),
        timeout=10.0
      )
    except asyncio.TimeoutError:
      raise HTTPException(status.HTTP_408_REQUEST_TIMEOUT, 'Operation timed out. Please try again.')
    
    # 如果用户点赞了帖子，奖励帖子作者积分 (+2/赞)
    # 只在真正新增点赞时奖励（不是切换或Cancel）
    if payload.vote_type == 'upvote':
      if not existing_vote.data or len(existing_vote.data) == 0:
        # 新点赞，奖励帖子作者
        try:
          post_author_resp = await asyncio.wait_for(
            asyncio.to_thread(
              lambda: supabase.table('posts').select('author_id').eq('id', post_id).limit(1).execute()
            ),
            timeout=10.0
          )
          if post_author_resp.data and len(post_author_resp.data) > 0:
            post_author_id = post_author_resp.data[0].get('author_id')
            if post_author_id and post_author_id != user.id:  # 不能给自己点赞奖励
              try:
                success = await asyncio.wait_for(
                  asyncio.to_thread(
                    lambda: award_points(supabase, post_author_id, 2, '帖子被点赞')
                  ),
                  timeout=10.0
                )
                if not success:
                  print(f"[VOTE_POST] Failed to award points to post author {post_author_id}")
              except asyncio.TimeoutError:
                print(f"[VOTE_POST] Timeout awarding points for post {post_id}")
              except Exception as e:
                print(f"[VOTE_POST] Error awarding points: {e}")
        except asyncio.TimeoutError:
          # 奖励积分失败不影响投票结果
          print(f"[VOTE_POST] Timeout fetching post author for post {post_id}")
    
    return {'upvote_count': upvote_count, 'downvote_count': downvote_count}
  except HTTPException:
    raise
  except Exception as e:
    error_msg = str(e)
    print(f"Error voting on post: {error_msg}")
    import traceback
    print(traceback.format_exc())
    
    # 检查是否是超时错误
    if 'timeout' in error_msg.lower() or 'timed out' in error_msg.lower():
      raise HTTPException(status.HTTP_408_REQUEST_TIMEOUT, 'Operation timed out. Please try again.')
    
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to vote: {error_msg}")


# Post Reply Vote endpoints
@router.post('/posts/{post_id}/replies/{reply_id}/vote', status_code=status.HTTP_200_OK)
async def vote_reply(
  post_id: str,
  reply_id: str,
  payload: VoteRequest,
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_current_user),
):
  """Vote (upvote/downvote) on a post reply"""
  try:
    # Check if reply exists and belongs to the post (with timeout)
    try:
      reply_check = await asyncio.wait_for(
        asyncio.to_thread(
          lambda: supabase.table('post_replies').select('id, post_id').eq('id', reply_id).execute()
        ),
        timeout=10.0
      )
    except asyncio.TimeoutError:
      raise HTTPException(status.HTTP_408_REQUEST_TIMEOUT, 'Operation timed out. Please try again.')
    
    if not reply_check.data or len(reply_check.data) == 0:
      raise HTTPException(status.HTTP_404_NOT_FOUND, "Reply not found")
    if reply_check.data[0]['post_id'] != post_id:
      raise HTTPException(status.HTTP_400_BAD_REQUEST, "Reply does not belong to this post")
    
    # Check if user already voted (with timeout)
    try:
      existing_vote = await asyncio.wait_for(
        asyncio.to_thread(
          lambda: (
            supabase.table('post_votes')
            .select('id, vote_type')
            .eq('post_id', reply_id)
            .eq('user_id', user.id)
            .execute()
          )
        ),
        timeout=10.0
      )
    except asyncio.TimeoutError:
      raise HTTPException(status.HTTP_408_REQUEST_TIMEOUT, 'Operation timed out. Please try again.')
    
    if existing_vote.data and len(existing_vote.data) > 0:
      existing_vote_type = existing_vote.data[0]['vote_type']
      if existing_vote_type == payload.vote_type:
        # Same vote, remove it (toggle off)
        try:
          await asyncio.wait_for(
            asyncio.to_thread(
              lambda: supabase.table('post_votes').delete().eq('id', existing_vote.data[0]['id']).execute()
            ),
            timeout=10.0
          )
        except asyncio.TimeoutError:
          raise HTTPException(status.HTTP_408_REQUEST_TIMEOUT, 'Operation timed out. Please try again.')
      else:
        # Different vote, update it
        try:
          await asyncio.wait_for(
            asyncio.to_thread(
              lambda: supabase.table('post_votes').update({'vote_type': payload.vote_type}).eq('id', existing_vote.data[0]['id']).execute()
            ),
            timeout=10.0
          )
        except asyncio.TimeoutError:
          raise HTTPException(status.HTTP_408_REQUEST_TIMEOUT, 'Operation timed out. Please try again.')
    else:
      # New vote
      try:
        await asyncio.wait_for(
          asyncio.to_thread(
            lambda: supabase.table('post_votes').insert({
              'post_id': reply_id,
              'user_id': user.id,
              'vote_type': payload.vote_type,
            }).execute()
          ),
          timeout=10.0
        )
      except asyncio.TimeoutError:
        raise HTTPException(status.HTTP_408_REQUEST_TIMEOUT, 'Operation timed out. Please try again.')
    
    # Recalculate vote counts (with timeout)
    try:
      upvotes, downvotes = await asyncio.wait_for(
        asyncio.to_thread(
          lambda: (
            supabase.table('post_votes').select('id', count='exact').eq('post_id', reply_id).eq('vote_type', 'upvote').execute(),
            supabase.table('post_votes').select('id', count='exact').eq('post_id', reply_id).eq('vote_type', 'downvote').execute()
          )
        ),
        timeout=10.0
      )
    except asyncio.TimeoutError:
      raise HTTPException(status.HTTP_408_REQUEST_TIMEOUT, 'Operation timed out. Please try again.')
    
    upvote_count = upvotes.count if hasattr(upvotes, 'count') and upvotes.count is not None else len(upvotes.data or [])
    downvote_count = downvotes.count if hasattr(downvotes, 'count') and downvotes.count is not None else len(downvotes.data or [])
    
    # Update reply counts (with timeout)
    try:
      await asyncio.wait_for(
        asyncio.to_thread(
          lambda: supabase.table('post_replies').update({
            'upvote_count': upvote_count,
            'downvote_count': downvote_count,
          }).eq('id', reply_id).execute()
        ),
        timeout=10.0
      )
    except asyncio.TimeoutError:
      raise HTTPException(status.HTTP_408_REQUEST_TIMEOUT, 'Operation timed out. Please try again.')
    
    # 如果用户点赞了评论，奖励评论作者积分 (+1/赞)
    # 只在真正新增点赞时奖励（不是切换或Cancel）
    if payload.vote_type == 'upvote':
      if not existing_vote.data or len(existing_vote.data) == 0:
        # 新点赞，奖励评论作者
        try:
          reply_author_resp = await asyncio.wait_for(
            asyncio.to_thread(
              lambda: supabase.table('post_replies').select('author_id').eq('id', reply_id).limit(1).execute()
            ),
            timeout=10.0
          )
          if reply_author_resp.data and len(reply_author_resp.data) > 0:
            reply_author_id = reply_author_resp.data[0].get('author_id')
            if reply_author_id and reply_author_id != user.id:  # 不能给自己点赞奖励
              try:
                success = await asyncio.wait_for(
                  asyncio.to_thread(
                    lambda: award_points(supabase, reply_author_id, 1, '评论被点赞')
                  ),
                  timeout=10.0
                )
                if not success:
                  print(f"[VOTE_REPLY] Failed to award points to reply author {reply_author_id}")
              except asyncio.TimeoutError:
                print(f"[VOTE_REPLY] Timeout awarding points for reply {reply_id}")
              except Exception as e:
                print(f"[VOTE_REPLY] Error awarding points: {e}")
        except asyncio.TimeoutError:
          # 奖励积分失败不影响投票结果
          print(f"[VOTE_REPLY] Timeout fetching reply author for reply {reply_id}")
    
    return {'upvote_count': upvote_count, 'downvote_count': downvote_count}
  except HTTPException:
    raise
  except Exception as e:
    error_msg = str(e)
    print(f"Error voting on reply: {error_msg}")
    import traceback
    print(traceback.format_exc())
    
    # 检查是否是超时错误
    if 'timeout' in error_msg.lower() or 'timed out' in error_msg.lower():
      raise HTTPException(status.HTTP_408_REQUEST_TIMEOUT, 'Operation timed out. Please try again.')
    
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to vote: {error_msg}")


# Post Report endpoints
@router.post('/posts/{post_id}/report', response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def report_post(
  post_id: str,
  payload: ReportCreate,
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_current_user),
):
  """Report a post"""
  try:
    # Check if post exists
    post_check = supabase.table('posts').select('id').eq('id', post_id).execute()
    if not post_check.data or len(post_check.data) == 0:
      raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found")
    
    # Check if user already reported this post
    existing_report = (
      supabase.table('thread_reports')
      .select('id')
      .eq('thread_id', post_id)
      .eq('reporter_id', user.id)
      .execute()
    )
    
    if existing_report.data and len(existing_report.data) > 0:
      raise HTTPException(status.HTTP_400_BAD_REQUEST, "You have already reported this post")
    
    # Create report
    insert_payload = {
      'thread_id': post_id,
      'reporter_id': user.id,
      'reason': payload.reason,
      'status': 'pending',
    }
    if payload.description:
      insert_payload['description'] = payload.description
    
    response = supabase.table('thread_reports').insert(insert_payload).execute()
    
    if not response.data:
      raise HTTPException(status.HTTP_400_BAD_REQUEST, "Failed to create report")
    
    record = response.data[0]
    
    # Get reporter info
    reporter_resp = supabase.table('profiles').select('id, username').eq('id', user.id).execute()
    reporter_data = {}
    if reporter_resp.data and len(reporter_resp.data) > 0:
      reporter_data = {
        'id': reporter_resp.data[0].get('id'),
        'username': reporter_resp.data[0].get('username'),
      }
    
    return ReportResponse(
      id=record['id'],
      post_id=record['thread_id'],
      reply_id=None,
      reporter_id=record['reporter_id'],
      reason=record['reason'],
      description=record.get('description'),
      status=record['status'],
      reviewed_by=record.get('reviewed_by'),
      reviewed_at=record.get('reviewed_at'),
      created_at=record['created_at'],
      reporter={'id': reporter_data.get('id'), 'username': reporter_data.get('username')} if reporter_data else None,
    )
  except HTTPException:
    raise
  except Exception as e:
    print(f"Error reporting post: {e}")
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to create report: {str(e)}")


# Post Reply Report endpoints
@router.post('/posts/{post_id}/replies/{reply_id}/report', response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def report_reply(
  post_id: str,
  reply_id: str,
  payload: ReportCreate,
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_current_user),
):
  """Report a post reply"""
  try:
    # Check if reply exists and belongs to the post
    reply_check = supabase.table('post_replies').select('id, post_id').eq('id', reply_id).execute()
    if not reply_check.data or len(reply_check.data) == 0:
      raise HTTPException(status.HTTP_404_NOT_FOUND, "Reply not found")
    if reply_check.data[0]['post_id'] != post_id:
      raise HTTPException(status.HTTP_400_BAD_REQUEST, "Reply does not belong to this post")
    
    # Check if user already reported this reply
    existing_report = (
      supabase.table('post_reports')
      .select('id')
      .eq('post_id', reply_id)
      .eq('reporter_id', user.id)
      .execute()
    )
    
    if existing_report.data and len(existing_report.data) > 0:
      raise HTTPException(status.HTTP_400_BAD_REQUEST, "You have already reported this reply")
    
    # Create report
    insert_payload = {
      'post_id': reply_id,
      'reporter_id': user.id,
      'reason': payload.reason,
      'status': 'pending',
    }
    if payload.description:
      insert_payload['description'] = payload.description
    
    response = supabase.table('post_reports').insert(insert_payload).execute()
    
    if not response.data:
      raise HTTPException(status.HTTP_400_BAD_REQUEST, "Failed to create report")
    
    record = response.data[0]
    
    # Get reporter info
    reporter_resp = supabase.table('profiles').select('id, username').eq('id', user.id).execute()
    reporter_data = {}
    if reporter_resp.data and len(reporter_resp.data) > 0:
      reporter_data = {
        'id': reporter_resp.data[0].get('id'),
        'username': reporter_resp.data[0].get('username'),
      }
    
    return ReportResponse(
      id=record['id'],
      post_id=None,
      reply_id=record['post_id'],
      reporter_id=record['reporter_id'],
      reason=record['reason'],
      description=record.get('description'),
      status=record['status'],
      reviewed_by=record.get('reviewed_by'),
      reviewed_at=record.get('reviewed_at'),
      created_at=record['created_at'],
      reporter={'id': reporter_data.get('id'), 'username': reporter_data.get('username')} if reporter_data else None,
    )
  except HTTPException:
    raise
  except Exception as e:
    print(f"Error reporting reply: {e}")
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Failed to create report: {str(e)}")

