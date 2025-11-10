import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ReplyComposer } from './ReplyComposer'
import { apiFetch } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'

export type PostWithAuthor = {
  id: string
  content: string
  post_id: string  // 原 thread_id
  author_id: string
  created_at: string
  upvote_count?: number
  downvote_count?: number
  user_vote?: string | null
  parent_reply_id?: string | null  // 原 parent_post_id
  replies?: PostWithAuthor[]
  author?: {
    username: string | null
    avatar_url: string | null
  } | null
}

type PostItemProps = {
  post: PostWithAuthor
  threadId: string
  depth?: number
}

export function PostItem({ post, threadId, depth = 0 }: PostItemProps) {
  const { user, accessToken } = useAuth()
  const queryClient = useQueryClient()
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportDescription, setReportDescription] = useState('')
  const createdAt = new Date(post.created_at)
  const maxDepth = 3 // Limit nesting depth to prevent UI issues

  const { mutate: votePost, isPending: isVoting } = useMutation({
    mutationFn: async (voteType: 'upvote' | 'downvote') => {
      if (!accessToken) throw new Error('Please login to vote')
      return apiFetch<{ upvote_count: number; downvote_count: number }>(`/posts/${threadId}/replies/${post.id}/vote`, {
        method: 'POST',
        body: JSON.stringify({ vote_type: voteType }),
        accessToken,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thread', threadId] })
    },
    onError: (error) => {
      alert(error instanceof Error ? error.message : 'Failed to vote')
    },
  })

  const { mutate: reportPost, isPending: isReporting } = useMutation({
    mutationFn: async () => {
      if (!accessToken) throw new Error('Please login to report')
      if (!reportReason.trim()) throw new Error('Please provide a reason')
      return apiFetch<{ id: string }>(`/posts/${threadId}/replies/${post.id}/report`, {
        method: 'POST',
        body: JSON.stringify({
          reason: reportReason.trim(),
          description: reportDescription.trim() || undefined,
        }),
        accessToken,
      })
    },
    onSuccess: () => {
      setShowReportModal(false)
      setReportReason('')
      setReportDescription('')
      alert('Report submitted! Admin will review it.')
    },
    onError: (error) => {
      alert(error instanceof Error ? error.message : 'Failed to submit report')
    },
  })

  const handleVote = (voteType: 'upvote' | 'downvote') => {
    if (!user) {
      alert('Please login to vote')
      return
    }
    votePost(voteType)
  }

  const handleReport = () => {
    if (!user) {
      alert('Please login to report')
      return
    }
    setShowReportModal(true)
  }

  const handleSubmitReport = (e: React.FormEvent) => {
    e.preventDefault()
    if (!reportReason.trim()) {
      alert('Please provide a reason for reporting')
      return
    }
    reportPost()
  }

  return (
    <div className={depth > 0 ? 'ml-8 mt-3' : ''}>
      <article className={`bg-white rounded-2xl p-5 border border-primary/10 shadow-sm ${depth > 0 ? 'border-l-4 border-l-accent/30' : ''}`}>
        <div className="flex gap-4">
          <div className="w-10 h-10 rounded-full bg-[#1D4F91] flex items-center justify-center text-white font-semibold text-sm shrink-0">
            {post.author?.username?.[0]?.toUpperCase() || 'M'}
          </div>
          <div className="flex-1 min-w-0">
            <header className="flex items-center gap-3 mb-2">
              <strong className="font-semibold text-primary">
                {post.author?.username || 'Mahidol Member'}
              </strong>
              <time
                dateTime={post.created_at}
                className="text-xs text-primary/50"
              >
                {createdAt.toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </time>
              {post.upvote_count !== undefined && post.upvote_count > 0 && (
                <span className="ml-auto flex items-center gap-1 text-xs text-accent font-semibold">
                  ⬆ {post.upvote_count}
                </span>
              )}
            </header>
            <p className="text-primary/80 leading-relaxed whitespace-pre-wrap mb-3">{post.content}</p>
            <div className="flex items-center gap-4 mt-3">
              {/* Vote buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleVote('upvote')}
                  disabled={isVoting || !user}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-sm transition ${
                    post.user_vote === 'upvote'
                      ? 'bg-accent/20 text-accent font-semibold'
                      : 'text-primary/60 hover:text-accent'
                  } ${!user ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={user ? 'Upvote' : 'Login to upvote'}
                >
                  <span>⬆</span>
                  <span>{post.upvote_count ?? 0}</span>
                </button>
                <button
                  onClick={() => handleVote('downvote')}
                  disabled={isVoting || !user}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-sm transition ${
                    post.user_vote === 'downvote'
                      ? 'bg-warm/20 text-warm font-semibold'
                      : 'text-primary/60 hover:text-warm'
                  } ${!user ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={user ? 'Downvote' : 'Login to downvote'}
                >
                  <span>⬇</span>
                  <span>{post.downvote_count ?? 0}</span>
                </button>
              </div>
              {/* Reply button */}
              {depth < maxDepth && (
                <button
                  onClick={() => setShowReplyForm(!showReplyForm)}
                  className="text-sm text-accent hover:text-accent/80 font-semibold transition"
                >
                  {showReplyForm ? 'Cancel回复' : '回复'}
                </button>
              )}
              {/* Report button */}
              {user && (
                <button
                  onClick={handleReport}
                  className="text-sm text-warm hover:text-warm/80 font-semibold transition"
                  title="Report this post"
                >
                  <i className="fa-solid fa-triangle-exclamation"></i> Report
                </button>
              )}
            </div>
          </div>
        </div>
      </article>
      
      {showReplyForm && (
        <div className="mt-3 ml-4">
          <ReplyComposer threadId={threadId} parentPostId={post.id} onSuccess={() => setShowReplyForm(false)} />
        </div>
      )}
      
      {/* Render nested replies */}
      {post.replies && post.replies.length > 0 && (
        <div className="mt-3 space-y-3">
          {post.replies.map((reply) => (
            <PostItem key={reply.id} post={reply} threadId={threadId} depth={depth + 1} />
          ))}
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-primary mb-4">Report Comment</h3>
            <form onSubmit={handleSubmitReport} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-primary mb-2">
                  Reason <span className="text-warm">*</span>
                </label>
                <input
                  type="text"
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="Brief reason for reporting..."
                  className="w-full px-4 py-2 rounded-lg border border-primary/15 focus:outline-none focus:ring-2 focus:ring-accent/30"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-primary mb-2">Description (optional)</label>
                <textarea
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="Additional details..."
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg border border-primary/15 focus:outline-none focus:ring-2 focus:ring-accent/30 resize-y"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isReporting || !reportReason.trim()}
                  className="flex-1 px-4 py-2 rounded-lg font-semibold text-white bg-warm hover:bg-warm/90 transition disabled:opacity-50"
                >
                  {isReporting ? 'Submitting...' : 'Submit Report'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowReportModal(false)
                    setReportReason('')
                    setReportDescription('')
                  }}
                  className="px-4 py-2 rounded-lg font-semibold text-primary/70 bg-primary/10 hover:bg-primary/20 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
