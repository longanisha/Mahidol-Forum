import { useMemo } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import { useAuth } from '../context/AuthContext'

type AnnouncementResponse = {
  id: string
  title: string
  content: string
  created_by: string
  is_active: boolean
  priority: number
  created_at: string
  updated_at: string | null
  author: {
    id: string | null
    username: string | null
  } | null
}

async function fetchAnnouncement(id: string): Promise<AnnouncementResponse | null> {
  const data = await apiFetch<AnnouncementResponse>(`/announcements/${id}`)
  return data
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

export function AnnouncementPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()

  const announcementId = useMemo(() => id ?? '', [id])
  
  // Check if we came from profile page
  const fromProfile = (location.state as { fromProfile?: boolean })?.fromProfile ?? false

  const {
    data: announcement,
    isLoading,
    isError,
    error,
  } = useQuery({
    enabled: Boolean(announcementId),
    queryKey: ['announcement', announcementId],
    queryFn: () => fetchAnnouncement(announcementId),
  })

  if (!announcementId) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-primary/60">No announcement selected.</div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-primary/60">Loading announcement…</div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-warm">
          {error instanceof Error ? error.message : 'Failed to load announcement'}
        </div>
      </div>
    )
  }

  if (!announcement) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-primary/60">Announcement not found.</div>
      </div>
    )
  }

  const authorInitial = announcement.author?.username
    ? announcement.author.username.charAt(0).toUpperCase()
    : 'A'

  return (
    <div className="min-h-screen bg-muted py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back button */}
        <button
          onClick={() => {
            if (fromProfile) {
              navigate('/profile')
            } else {
              navigate(-1)
            }
          }}
          className="mb-6 text-primary/70 hover:text-primary transition flex items-center gap-2"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back
        </button>

        {/* Announcement content */}
        <article className="bg-white rounded-2xl border border-primary/10 shadow-sm p-8">
          <header className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent to-warm flex items-center justify-center text-white font-semibold text-lg">
                {authorInitial}
              </div>
              <div>
                <div className="font-semibold text-primary">
                  {announcement.author?.username || 'Admin'}
                </div>
                <div className="text-sm text-primary/50">
                  {formatTimeAgo(announcement.created_at)}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 mb-4">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-accent/10 text-accent">
                Announcement
              </span>
              {announcement.priority > 0 && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-warm/10 text-warm">
                  Priority: {announcement.priority}
                </span>
              )}
              {!announcement.is_active && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary/70">
                  Inactive
                </span>
              )}
            </div>

            <h1 className="text-3xl font-bold text-primary mb-4">
              {announcement.title}
            </h1>
          </header>

          <div className="prose prose-sm max-w-none">
            <div className="text-primary/80 leading-relaxed whitespace-pre-wrap">
              {announcement.content}
            </div>
          </div>

          {announcement.updated_at && announcement.updated_at !== announcement.created_at && (
            <div className="mt-6 pt-6 border-t border-primary/10 text-sm text-primary/50">
              Last updated: {formatTimeAgo(announcement.updated_at)}
            </div>
          )}
        </article>
      </div>
    </div>
  )
}

