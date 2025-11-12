import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'

type ThreadComposerProps = {
  onSuccess?: () => void
}

type SimilarPost = {
  id: string
  title: string
  reply_count: number
}

export function ThreadComposer({ onSuccess }: ThreadComposerProps) {
  const { user, accessToken } = useAuth()
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('General')
  const [summary, setSummary] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: similarPosts } = useQuery<SimilarPost[]>({
    queryKey: ['similar-posts', title],
    queryFn: async () => {
      if (!title.trim() || title.length < 5) return []
      return apiFetch<SimilarPost[]>(`/posts/similar?title=${encodeURIComponent(title)}`)
    },
    enabled: title.length >= 5,
  })

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      if (!user || !accessToken) {
        throw new Error('You must be logged in to create a thread.')
      }

      // Filter out empty tags and ensure they're strings
      const validTags = tags.filter(tag => tag && tag.trim()).map(tag => tag.trim())
      if (validTags.length === 0) {
        throw new Error('At least one tag is required.')
      }

      await apiFetch('/posts', {
        method: 'POST',
        body: JSON.stringify({ title, category, summary, tags: validTags }),
        accessToken,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] })
      setTitle('')
      setSummary('')
      setCategory('General')
      setTags([])
      setTagInput('')
      setError(null)
      onSuccess?.()
    },
    onError: (mutationError: unknown) => {
      const message =
        mutationError instanceof Error
          ? mutationError.message
          : 'Failed to create thread. Please try again.'
      setError(message)
    },
  })

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!title.trim()) {
      setError('Please provide a thread title.')
      return
    }
    // Check if at least one tag is provided
    const validTags = tags.filter(tag => tag && tag.trim())
    if (validTags.length === 0) {
      setError('Please add at least one tag.')
      return
    }
    mutate()
  }

  const handleTagAdd = () => {
    const trimmed = tagInput.trim()
    if (trimmed && !tags.includes(trimmed) && tags.length < 10) {
      setTags([...tags, trimmed])
      setTagInput('')
      setError(null) // Clear error when a tag is added
    }
  }

  const handleTagRemove = (tag: string) => {
    setTags(tags.filter((t) => t !== tag))
  }

  if (!user) {
    return null
  }

  return (
    <section className="bg-white rounded-2xl p-6 border border-primary/10 shadow-sm">
      <h2 className="text-2xl font-bold text-primary mb-6">Create a new thread</h2>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="thread-title" className="block text-sm font-semibold text-primary mb-2">
              Title
            </label>
            <input
              id="thread-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Share your idea or question"
              required
              className="w-full px-4 py-2.5 rounded-xl border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
            />
            {similarPosts && similarPosts.length > 0 && (
              <div className="mt-2 p-3 bg-warm/10 border border-warm/20 rounded-lg">
                <p className="text-xs font-semibold text-warm mb-2">Similar posts found:</p>
                <ul className="space-y-1">
                  {similarPosts.map((post) => (
                    <li key={post.id}>
                      <Link
                        to={`/thread/${post.id}`}
                        className="text-sm text-primary hover:text-accent underline"
                      >
                        {post.title} ({post.reply_count} replies)
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div>
            <label
              htmlFor="thread-category"
              className="block text-sm font-semibold text-primary mb-2"
            >
              Category
            </label>
            <select
              id="thread-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
            >
              <option value="General">General</option>
              <option value="Academics">Academics</option>
              <option value="Research">Research</option>
              <option value="Student Life">Student Life</option>
              <option value="Events">Events</option>
            </select>
          </div>
        </div>

        <div>
          <label
            htmlFor="thread-summary"
            className="block text-sm font-semibold text-primary mb-2"
          >
            Summary
          </label>
          <textarea
            id="thread-summary"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="Write a short introduction to your discussion..."
            rows={4}
            className="w-full px-4 py-2.5 rounded-xl border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition resize-y"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-primary mb-2">
            Tags * <span className="text-primary/60 text-xs font-normal">(at least one tag is required)</span>
          </label>
          <div className="flex gap-2 mb-2">
            <input
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleTagAdd()
                }
              }}
              placeholder="Add a tag and press Enter"
              className="flex-1 px-4 py-2 rounded-lg border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
            />
            <button
              type="button"
              onClick={handleTagAdd}
              disabled={!tagInput.trim() || tags.length >= 10}
              className="px-4 py-2 rounded-lg font-semibold text-white bg-accent hover:bg-accent/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-primary/60 self-center">Selected ({tags.length}/10):</span>
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-accent/10 text-accent"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleTagRemove(tag)}
                    className="hover:text-warm transition"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <div className="text-xs text-warm">Please add at least one tag to continue.</div>
          )}
        </div>

        {error && <p className="text-warm font-semibold">{error}</p>}

        <button
          type="submit"
          disabled={isPending}
          className="px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-primary to-accent hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? 'Publishing…' : 'Publish Thread'}
        </button>
      </form>
    </section>
  )
}
