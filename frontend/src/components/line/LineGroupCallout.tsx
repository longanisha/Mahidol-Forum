import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { apiFetch } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'

export function LineGroupCallout() {
  const { user, accessToken } = useAuth()
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      if (!user || !accessToken) {
        throw new Error('Please sign in to apply.')
      }
      const content = message.trim()
      if (!content) {
        throw new Error('Please share a short introduction.')
      }

      await apiFetch('/line-applications', {
        method: 'POST',
        body: JSON.stringify({ message: content }),
        accessToken,
      })
    },
    onSuccess: () => {
      setSuccess('Application sent! Our community team will contact you soon via email.')
      setError(null)
      setMessage('')
    },
    onError: (mutationError: unknown) => {
      const errMessage =
        mutationError instanceof Error ? mutationError.message : 'Could not submit application.'
      setError(errMessage)
      setSuccess(null)
    },
  })

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    mutate()
  }

  return (
    <section className="bg-white rounded-2xl p-8 border border-primary/10 shadow-sm">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-start justify-between gap-8 flex-wrap">
          <div className="flex-1 min-w-[280px]">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-accent/10 text-accent uppercase tracking-wider mb-4">
              Mahidol LINE Community
            </span>
            <h2 className="text-2xl font-bold text-primary mb-3">Join our verified LINE group</h2>
            <p className="text-primary/70 mb-6 leading-relaxed">
              Stay connected with mentors, receive instant event updates, and collaborate with peers.
              Submit a short introduction and we&apos;ll send you the invite QR code.
            </p>

            {user ? (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <label htmlFor="line-message" className="block text-sm font-semibold text-primary">
                  Introduce yourself
                </label>
                <textarea
                  id="line-message"
                  placeholder="Tell us your faculty, interests, or why you'd like to join..."
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition resize-y"
                />
                {error && (
                  <p className="text-warm font-semibold text-sm">{error}</p>
                )}
                {success && (
                  <p className="text-accent font-semibold text-sm">{success}</p>
                )}
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-6 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-accent to-primary hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? 'Submitting…' : 'Request Invite'}
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <p className="text-primary/70">
                  Login or register first to access the LINE group invite. We verify every request to
                  keep the space safe and welcoming.
                </p>
                <div className="flex gap-3">
                  <Link
                    to="/login"
                    className="px-5 py-2.5 rounded-xl font-semibold text-accent border-2 border-accent hover:bg-accent/10 transition"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="px-5 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-accent to-primary hover:shadow-lg transition"
                  >
                    Create account
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div className="relative shrink-0">
            <div className="absolute top-2 right-2 px-3 py-1 rounded-full bg-green-500 text-white text-xs font-bold uppercase tracking-wider shadow-lg">
              Line
            </div>
            <div className="w-56 h-64 rounded-3xl bg-gradient-to-br from-primary to-accent p-6 flex flex-col items-center justify-center text-center text-white shadow-xl">
              <strong className="text-xl mb-2">Mahidol Community</strong>
              <span className="text-sm opacity-90">Approved members only</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
