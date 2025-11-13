import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { Link } from 'react-router-dom'
import { RichTextEditor } from '../components/editor/RichTextEditor'

type HotTag = {
  tag: string
  count: number
}

type SimilarPost = {
  id: string
  title: string
  reply_count: number
}

async function fetchHotTags(): Promise<HotTag[]> {
  return apiFetch<HotTag[]>('/posts/hot-tags?limit=30')
}

export function CreateThreadPage() {
  const { user, accessToken } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [debouncedTitle, setDebouncedTitle] = useState('')
  const [category, setCategory] = useState('General')
  const [content, setContent] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [shouldLoadTags, setShouldLoadTags] = useState(false)

  // Debounce title input - wait 500ms after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTitle(title)
    }, 500)

    return () => {
      clearTimeout(timer)
    }
  }, [title])


  useEffect(() => {

    const timer = setTimeout(() => {
      setShouldLoadTags(true)
    }, 100) 

    return () => {
      clearTimeout(timer)
    }
  }, [])


  const { data: hotTags = [], isLoading: tagsLoading, isError: tagsError } = useQuery({
    queryKey: ['hot-tags'],
    queryFn: fetchHotTags,
    enabled: shouldLoadTags, 
    staleTime: 10 * 60 * 1000, // 10 minutes 
    gcTime: 30 * 60 * 1000, // 30 minutes 
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })

  // Sort tags by count (hot tags first) and add fire icon for hot tags
  const sortedHotTags = [...hotTags].sort((a, b) => b.count - a.count)
  const hotTagThreshold = sortedHotTags.length > 0 ? sortedHotTags[0].count * 0.5 : 0

  const { data: similarPosts = [] } = useQuery<SimilarPost[]>({
    queryKey: ['similar-posts', debouncedTitle],
    queryFn: async () => {
      if (!debouncedTitle.trim() || debouncedTitle.length < 3) return []
      return apiFetch<SimilarPost[]>(`/posts/similar?title=${encodeURIComponent(debouncedTitle)}&limit=5`)
    },
    enabled: debouncedTitle.length >= 3,
  })

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      if (!user || !accessToken) {
        throw new Error('You must be logged in to create a thread.')
      }

      // Ensure all fields are properly formatted
      // tags is now required, so filter out empty tags and ensure they're strings
      const validTags = selectedTags.filter(tag => tag && tag.trim()).map(tag => tag.trim())
      if (validTags.length === 0) {
        throw new Error('At least one tag is required.')
      }
      
      const requestBody: {
        title: string
        category?: string
        summary?: string
        tags: string[]
      } = {
        title: title.trim(),
        tags: validTags,  // tags is required
      }
      
      // Only include optional fields if they have values
      if (category && category.trim()) {
        requestBody.category = category.trim()
      }
      
      if (content && content.trim()) {
        // Extract plain text from HTML for summary (first 500 chars)
        const textContent = content.replace(/<[^>]*>/g, '').trim()
        if (textContent) {
          requestBody.summary = textContent.substring(0, 500)
        }
      }

            await apiFetch('/posts', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        accessToken,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] })
      navigate('/')
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
    // Check if content has actual text (not just HTML tags)
    const textContent = content.replace(/<[^>]*>/g, '').trim()
    if (!textContent) {
      setError('Please provide thread content.')
      return
    }
    // Check if at least one tag is selected
    if (!selectedTags || selectedTags.length === 0) {
      setError('Please select at least one tag.')
      return
    }
    mutate()
  }

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag].slice(0, 10),
    )
  }


  if (!user) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <p className="text-primary/70 mb-4">Please login to create a thread.</p>
          <Link to="/login" className="text-accent hover:underline font-semibold">
            Go to Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-primary/70 hover:text-primary transition"
          >
            ← Back to Forum
          </Link>
          <h1 className="text-3xl font-bold text-primary mt-4">Create a New Post</h1>
          <p className="text-primary/70 mt-2">Share your thoughts, questions, or ideas with the community</p>
        </div>

        <form className="bg-white rounded-2xl p-6 border border-primary/10 shadow-sm space-y-6" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="thread-title" className="block text-sm font-semibold text-primary mb-2">
                Title *
              </label>
              <input
                id="thread-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="What's your question or topic?"
                required
                className="w-full px-4 py-2.5 rounded-xl border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
              />
              {similarPosts.length > 0 && (
                <div className="mt-3 p-3 bg-warm/10 border border-warm/20 rounded-lg">
                  <p className="text-xs font-semibold text-warm mb-2">Related posts you might want to check:</p>
                  <ul className="space-y-1.5">
                    {similarPosts.map((post) => (
                      <li key={post.id}>
                        <Link
                          to={`/thread/${post.id}`}
                          className="text-xs text-primary hover:text-accent underline flex items-center gap-2"
                        >
                          <span className="font-medium">{post.title}</span>
                          <span className="text-primary/50">({post.reply_count} replies)</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div>
              <label htmlFor="thread-category" className="block text-sm font-semibold text-primary mb-2">
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
            <label htmlFor="thread-content" className="block text-sm font-semibold text-primary mb-2">
              Content *
            </label>
            <RichTextEditor
              content={content}
              onChange={setContent}
              placeholder="Write your post content here..."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-primary mb-3">
              Tags * <span className="text-primary/60 text-xs font-normal">(at least one tag is required)</span>
            </label>
            {tagsLoading ? (
              <div className="text-sm text-primary/60">Loading tags...</div>
            ) : tagsError ? (
              <div className="text-sm text-warm">Failed to load tags. Please refresh the page to try again.</div>
            ) : sortedHotTags.length === 0 ? (
              <div className="text-sm text-warm mb-3">
                No tags available yet. Please contact an administrator to add tags to the system.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {sortedHotTags.map((hotTag) => {
                  const isHot = hotTag.count >= hotTagThreshold
                  return (
                    <button
                      key={hotTag.tag}
                      type="button"
                      onClick={() => handleTagToggle(hotTag.tag)}
                      className={`px-4 py-2 rounded-full text-sm font-semibold transition flex items-center gap-1.5 ${
                        selectedTags.includes(hotTag.tag)
                          ? 'bg-accent text-white shadow-md'
                          : 'bg-white text-primary/70 border border-primary/15 hover:border-accent/50 hover:text-accent'
                      }`}
                    >
                      {isHot && (
                        <i className="fa-solid fa-fire text-warm" title="Hot tag"></i>
                      )}
                      {hotTag.tag} ({hotTag.count})
                    </button>
                  )
                })}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedTags.length > 0 ? (
                <>
                  <span className="text-xs text-primary/60">Selected ({selectedTags.length}/10):</span>
                  {selectedTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-accent/10 text-accent"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleTagToggle(tag)}
                        className="hover:text-warm transition"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </>
              ) : (
                <span className="text-xs text-warm">Please select at least one tag to continue.</span>
              )}
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-warm/10 border border-warm/20 text-warm font-semibold">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-primary/10">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-5 py-2.5 rounded-xl font-semibold text-primary border border-primary/15 hover:bg-primary/5 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-8 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-primary to-accent hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? 'Posting…' : 'Post it'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
