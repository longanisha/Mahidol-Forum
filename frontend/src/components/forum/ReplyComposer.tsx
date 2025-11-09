import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'

type ReplyComposerProps = {
  threadId: string
  parentPostId?: string | null
  onSuccess?: () => void
}

export function ReplyComposer({ threadId, parentPostId, onSuccess }: ReplyComposerProps) {
  const { user, accessToken } = useAuth()
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      if (!user || !accessToken) {
        throw new Error('Please login to reply.')
      }

      const trimmed = content.trim()
      if (!trimmed) {
        throw new Error('Reply cannot be empty.')
      }

      const payload: { content: string; parent_reply_id?: string } = { content: trimmed }
      if (parentPostId) {
        payload.parent_reply_id = parentPostId
      }

      await apiFetch(`/posts/${threadId}/replies`, {
        method: 'POST',
        body: JSON.stringify(payload),
        accessToken,
      })
    },
    onSuccess: () => {
      setContent('')
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['thread', threadId] })
      queryClient.invalidateQueries({ queryKey: ['posts'] })
      if (onSuccess) {
        onSuccess()
      }
    },
    onError: (mutationError: unknown) => {
      const message =
        mutationError instanceof Error
          ? mutationError.message
          : 'Failed to post reply.'
      setError(message)
    },
  })

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    mutate()
  }

  if (!user) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-primary/10 text-center text-primary/70">
        <p>
          Please <Link to="/login" className="text-accent hover:underline font-semibold">login</Link> or{' '}
          <Link to="/register" className="text-accent hover:underline font-semibold">create an account</Link> to join
          the discussion.
        </p>
      </div>
    )
  }

  return (
    <form className="bg-white rounded-2xl p-5 border border-primary/10 shadow-sm space-y-4" onSubmit={handleSubmit}>
      <label htmlFor="reply-message" className="block text-sm font-semibold text-primary">
        Join the conversation
      </label>
      <textarea
        id="reply-message"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="Share your thoughts..."
        rows={4}
        className="w-full px-4 py-3 rounded-xl border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition resize-y"
      />
      {error && <p className="text-warm font-semibold">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="px-6 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-warm to-sun hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? 'Sending…' : 'Post Reply'}
      </button>
    </form>
  )
}
