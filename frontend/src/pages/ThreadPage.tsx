import { useMemo } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import { PostItem, type PostWithAuthor } from '../components/forum/PostItem'
import { ReplyComposer } from '../components/forum/ReplyComposer'
import { useAuth } from '../context/AuthContext'

type ThreadResponse = {
  id: string
  title: string
  category: string | null
  summary: string | null
  cover_image_url: string | null
  author_id: string
  created_at: string
  updated_at: string | null
  reply_count: number
  is_closed?: boolean
  is_pinned?: boolean
  pinned_at?: string | null  // Timestamp when post was pinned (expires after 7 days)
  author: {
    id?: string | null
    username: string | null
    avatar_url: string | null
  } | null
  replies: PostWithAuthor[]
}

async function fetchThread(id: string): Promise<ThreadResponse | null> {
  const data = await apiFetch<ThreadResponse>(`/posts/${id}`)
  return data
}

export function ThreadPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, accessToken } = useAuth()
  const queryClient = useQueryClient()

  const threadId = useMemo(() => id ?? '', [id])
  
  // Check if we came from profile page
  const fromProfile = (location.state as { fromProfile?: boolean })?.fromProfile ?? false

  const {
    data: thread,
    isLoading,
    isError,
    error,
  } = useQuery({
    enabled: Boolean(threadId),
    queryKey: ['thread', threadId],
    queryFn: () => fetchThread(threadId),
  })

  const { mutate: pinPost, isPending: isPinning } = useMutation({
    mutationFn: async () => {
      if (!accessToken) {
        console.error('[ThreadPage] No accessToken available for pin post')
        throw new Error('Please login to pin post')
      }
      console.log('[ThreadPage] Pinning post:', threadId)
      console.log('[ThreadPage] AccessToken exists:', !!accessToken)
      console.log('[ThreadPage] AccessToken length:', accessToken?.length || 0)
      return apiFetch<ThreadResponse>(`/posts/${threadId}/pin`, {
        method: 'POST',
        accessToken,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thread', threadId] })
      queryClient.invalidateQueries({ queryKey: ['posts'] })
      alert('Post pinned successfully! 50 points deducted.')
    },
    onError: (error) => {
      console.error('[ThreadPage] Pin post error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to pin post'
      alert(errorMessage)
    },
  })

  // Sort replies by creation time (newest first)
  const sortedReplies = useMemo(() => {
    if (!thread?.replies) return []
    const replies = [...thread.replies]
    // Sort by creation time (newest first)
    return replies.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
  }, [thread?.replies])

  if (!threadId) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-primary/60">No thread selected.</div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-primary/60">Loading discussion…</div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-warm">
          Unable to load thread: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      </div>
    )
  }

  if (!thread) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-primary/60">Thread not found.</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-4">
          <button
            onClick={() => {
              if (fromProfile) {
                navigate('/profile')
              } else {
                navigate(-1)
              }
            }}
            className="inline-flex items-center gap-2 text-primary/70 hover:text-primary transition"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            Back
          </button>
        </div>
        <header className="bg-white rounded-2xl p-6 border border-primary/10 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-accent/10 text-accent">
                {thread.category || 'General'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {thread.is_pinned && thread.pinned_at && (() => {
                const pinnedDate = new Date(thread.pinned_at)
                const now = new Date()
                const daysSincePinned = Math.floor((now.getTime() - pinnedDate.getTime()) / (1000 * 60 * 60 * 24))
                const daysRemaining = Math.max(0, 7 - daysSincePinned)
                return (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-accent/20 text-accent">
                    📌 Pinned {daysRemaining > 0 ? `(${daysRemaining}d left)` : '(Expired)'}
                  </span>
                )
              })()}
              {thread.is_pinned && !thread.pinned_at && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-accent/20 text-accent">
                  📌 Pinned
                </span>
              )}
              {thread.is_closed && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary/70">
                  Closed
                </span>
              )}
              {user && thread.author_id === user.id && !thread.is_pinned && (
                <button
                  onClick={() => {
                    if (confirm('Pin this post to the top? This will cost 50 points.')) {
                      pinPost()
                    }
                  }}
                  disabled={isPinning}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-yellow-500 to-orange-500 hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPinning ? 'Pinning...' : '📌 Pin Post (50 pts)'}
                </button>
              )}
            </div>
          </div>
          <h1 className="text-3xl font-bold text-primary mb-3">{thread.title}</h1>
          {thread.summary && (
            <p className="text-primary/70 mb-4 leading-relaxed">{thread.summary}</p>
          )}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1D4F91] flex items-center justify-center text-white font-semibold text-sm overflow-hidden relative shrink-0">
              {thread.author?.avatar_url ? (
                <img
                  src={thread.author.avatar_url}
                  alt={thread.author?.username || 'User'}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                    const parent = target.parentElement
                    if (parent) {
                      parent.innerHTML = thread.author?.username?.[0]?.toUpperCase() || 'M'
                    }
                  }}
                />
              ) : (
                thread.author?.username?.[0]?.toUpperCase() || 'M'
              )}
            </div>
            <div>
              <div className="font-semibold text-primary">
                {thread.author?.username || 'Mahidol Member'}
              </div>
              <div className="text-sm text-primary/60">
                Started on{' '}
                {new Date(thread.created_at).toLocaleDateString(undefined, {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>
            </div>
          </div>
        </header>

        <section className="space-y-4 mb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-primary">
              {sortedReplies.length} {sortedReplies.length === 1 ? 'Reply' : 'Replies'}
          </h2>
        </div>

        {sortedReplies.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-primary/60 border border-dashed border-primary/20">
            No replies yet. Start the conversation below.
          </div>
        ) : (
          sortedReplies.map((reply) => (
            <PostItem key={reply.id} post={reply} threadId={threadId} threadIsClosed={Boolean(thread.is_closed)} />
          ))
        )}
        </section>

        {thread.is_closed ? (
          <div className="bg-white rounded-2xl p-6 border border-primary/10 text-center text-primary/60">
            This thread is closed. No new replies can be posted.
          </div>
        ) : (
          <ReplyComposer threadId={threadId} />
        )}
      </div>
    </div>
  )
}
