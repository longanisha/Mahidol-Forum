import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { translateTag } from '../../utils/tagTranslations'

export type ThreadWithAuthor = {
  id: string
  title: string
  category: string | null
  summary: string | null
  cover_image_url: string | null
  author_id: string
  created_at: string
  updated_at: string | null
  author?: {
    id?: string | null
    username: string | null
    avatar_url: string | null
  } | null
  reply_count?: number
  tags?: string[] | null
  view_count?: number | null
  upvote_count?: number | null
  downvote_count?: number | null
  user_vote?: string | null
  is_closed?: boolean
  is_pinned?: boolean
}

type ThreadCardProps = {
  thread: ThreadWithAuthor
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const diffMs = Date.now() - date.getTime()
  const minutes = Math.round(diffMs / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr${hours > 1 ? 's' : ''} ago`
  const days = Math.round(hours / 24)
  return `${days} day${days > 1 ? 's' : ''} ago`
}

function buildTags(thread: ThreadWithAuthor): string[] {
  if (thread.tags && thread.tags.length > 0) {
    return thread.tags
  }
  const fallbackTags = new Set<string>()
  if (thread.category) fallbackTags.add(thread.category)
  if (thread.summary) {
    thread.summary
      .split(' ')
      .slice(0, 3)
      .forEach((word) => {
        const clean = word.replace(/[^a-z]/gi, '')
        if (clean.length > 3) {
          fallbackTags.add(clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase())
        }
      })
  }
  if (fallbackTags.size === 0) {
    fallbackTags.add('General')
  }
  return Array.from(fallbackTags).slice(0, 3)
}

function synthesizeStat(id: string, multiplier: number, base: number) {
  return (
    base +
    (id
      .split('')
      .map((char) => char.charCodeAt(0))
      .reduce((sum, code) => sum + code, 0) %
      multiplier)
  )
}

export function ThreadCard({ thread }: ThreadCardProps) {
  const { t, i18n } = useTranslation()
  const { user, accessToken } = useAuth()
  const queryClient = useQueryClient()
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportDescription, setReportDescription] = useState('')
  
  const replies = thread.reply_count ?? 0
  const views = thread.view_count ?? synthesizeStat(thread.id, 180, 120) + replies * 4
  const upvotes = thread.upvote_count ?? Math.max(4, Math.round(replies * 0.8) + 12)
  const downvotes = thread.downvote_count ?? 0
  const tags = buildTags(thread)
  const authorInitial =
    thread.author?.username?.[0]?.toUpperCase() || thread.category?.[0]?.toUpperCase() || 'M'

  const { mutate: voteThread, isPending: isVoting } = useMutation({
    mutationFn: async (voteType: 'upvote' | 'downvote') => {
      if (!accessToken) throw new Error('Please login to vote')
      return apiFetch<{ upvote_count: number; downvote_count: number }>(`/posts/${thread.id}/vote`, {
        method: 'POST',
        body: JSON.stringify({ vote_type: voteType }),
        accessToken,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] })
    },
    onError: (error) => {
      alert(error instanceof Error ? error.message : 'Failed to vote')
    },
  })

  const { mutate: reportThread, isPending: isReporting } = useMutation({
    mutationFn: async () => {
      if (!accessToken) throw new Error('Please login to report')
      if (!reportReason.trim()) throw new Error('Please provide a reason')
      return apiFetch<{ id: string }>(`/posts/${thread.id}/report`, {
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
    voteThread(voteType)
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
    reportThread()
  }

  return (
    <article className="bg-white rounded-2xl border border-primary/10 shadow-sm hover:shadow-md transition p-5">
      <header className="flex items-center justify-between mb-3 relative">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-warm flex items-center justify-center text-white font-semibold text-sm">
            {authorInitial}
          </div>
          <div>
            <div className="font-semibold text-sm text-primary">
              {thread.author?.username || 'Mahidol Member'}
            </div>
            <div className="text-xs text-primary/50">{formatTimeAgo(thread.created_at)}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {thread.is_pinned && (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-accent/20 text-accent flex items-center gap-1">
              📌 {t('thread.pinned')}
            </span>
          )}
          {thread.is_closed && (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary/70">
              {t('thread.closed')}
            </span>
          )}
        </div>
      </header>

      {/* Threads 和 Announcements 可以点击查看详情，LINE Groups 不可点击 */}
      {thread.category === 'LINE Group' ? (
        <div className="mb-3">
          <h3 className="text-lg font-bold text-primary mb-2">
            {thread.title}
          </h3>
          {thread.summary && (
            <p className="text-sm text-primary/70 line-clamp-2 leading-relaxed">{thread.summary}</p>
          )}
        </div>
      ) : (
        <Link 
          to={thread.category === 'Announcement' ? `/announcement/${thread.id}` : `/thread/${thread.id}`} 
          className="block mb-3 group"
        >
          <h3 className="text-lg font-bold text-primary mb-2 group-hover:text-accent transition">
            {thread.title}
          </h3>
          {thread.summary && (
            <p className="text-sm text-primary/70 line-clamp-2 leading-relaxed">{thread.summary}</p>
          )}
        </Link>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {tags.map((tag) => (
          <span
            key={`${thread.id}-${tag}`}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-accent/10 text-accent"
          >
            {translateTag(tag, i18n.language)}
          </span>
        ))}
      </div>

      <footer className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-primary/5">
        <div className="flex items-center gap-2 sm:gap-4 text-sm flex-wrap">
          <div className="flex items-center gap-1.5 text-primary/60">
            <span aria-hidden="true">👁</span>
            <strong className="text-primary">{views}</strong>
            <span className="text-xs">{t('home.views')}</span>
          </div>
          <div className="flex items-center gap-1.5 text-primary/60">
            <span aria-hidden="true">💬</span>
            <strong className="text-primary">{replies}</strong>
            <span className="text-xs">{t('home.replies')}</span>
          </div>
          {/* Vote buttons - only for real threads */}
          {thread.category !== 'Announcement' && thread.category !== 'LINE Group' && (
            <>
              <button
                onClick={() => handleVote('upvote')}
                disabled={isVoting || !user}
                className={`flex items-center gap-1 px-2 py-1 rounded text-sm transition ${
                  thread.user_vote === 'upvote'
                    ? 'bg-accent/20 text-accent font-semibold'
                    : 'text-primary/60 hover:text-accent'
                } ${!user ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={user ? t('thread.upvote') : t('thread.loginToUpvote')}
              >
                <span>⬆</span>
                <span>{upvotes}</span>
              </button>
              <button
                onClick={() => handleVote('downvote')}
                disabled={isVoting || !user}
                className={`flex items-center gap-1 px-2 py-1 rounded text-sm transition ${
                  thread.user_vote === 'downvote'
                    ? 'bg-warm/20 text-warm font-semibold'
                    : 'text-primary/60 hover:text-warm'
                } ${!user ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={user ? t('thread.downvote') : t('thread.loginToDownvote')}
              >
                <span>⬇</span>
                <span>{downvotes}</span>
              </button>
              {user && (
                <button
                  onClick={handleReport}
                  className="text-xs text-warm hover:text-warm/80 transition flex-shrink-0"
                  title={t('thread.reportThisThread')}
                >
                  ⚠️
                </button>
              )}
            </>
          )}
        </div>
        {/* 只对真正的 threads 显示 "View post" 按钮，Announcements 和 LINE Groups 不显示 */}
        {thread.category !== 'Announcement' && thread.category !== 'LINE Group' && (
          <Link
            to={`/thread/${thread.id}`}
            className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-warm to-sun hover:shadow-lg transition flex-shrink-0 self-start sm:self-auto"
          >
            {t('home.viewPost')}
          </Link>
        )}
      </footer>

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
<<<<<<< Updated upstream
            <h3 className="text-xl font-bold text-primary mb-4">举报帖子</h3>
            <form onSubmit={handleSubmitReport} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-primary mb-2">
                  原因 <span className="text-warm">*</span>
=======
            <h3 className="text-xl font-bold text-primary mb-4">{t('post.reportComment')}</h3>
            <form onSubmit={handleSubmitReport} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-primary mb-2">
                  {t('post.reason')} <span className="text-warm">*</span>
>>>>>>> Stashed changes
                </label>
                <input
                  type="text"
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder={t('post.briefReason')}
                  className="w-full px-4 py-2 rounded-lg border border-primary/15 focus:outline-none focus:ring-2 focus:ring-accent/30"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-primary mb-2">详细描述（可选）</label>
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
                  {isReporting ? '提交中...' : '提交举报'}
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
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </article>
  )
}
