import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    if (user) {
      navigate('/')
    }
  }, [user, navigate])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setError('Please enter your email address.')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.')
      setLoading(false)
      return
    }

    const {
      data,
      error: signUpError,
    } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          username: username.trim() || trimmedEmail.split('@')[0] || 'Member',
        },
      },
    })

    if (signUpError) {
      let errorMessage = signUpError.message
      if (signUpError.message.includes('already registered')) {
        errorMessage = 'This email is already registered. Please log in instead.'
      } else if (signUpError.message.includes('Password')) {
        errorMessage = 'Password is too weak. Please use a stronger password.'
      }
      setError(errorMessage)
      setLoading(false)
      return
    }

    if (!data.user) {
      setError('Registration failed. Please try again.')
      setLoading(false)
      return
    }

    // The database trigger should automatically create the profile via handle_new_user()
    // If user is immediately logged in (email confirmation disabled), we can optionally update username
    if (data.session && username.trim()) {
      // Wait a bit for the trigger to execute
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Try to update username if provided (trigger may have created profile with email prefix)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          username: username.trim(),
        })
        .eq('id', data.user.id)

      if (profileError) {
        // Log but don't fail registration - profile was created by trigger
        console.warn('Could not update username:', profileError.message)
      }
    }

    // If email confirmation is required, show a message
    if (data.user && !data.session) {
      setError(
        'Registration successful! Please check your email to verify your account before logging in.',
      )
      setLoading(false)
      setTimeout(() => {
        navigate('/login')
      }, 3000)
      return
    }

    navigate('/')
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative pt-24"
      style={{
        backgroundImage: 'url(/mahidol_bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="absolute inset-0 bg-primary/80 backdrop-blur-sm z-0"></div>
      <div className="w-full max-w-md relative z-10">
        <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-8 border border-white/20">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-primary mb-2">Join the community</h1>
            <p className="text-primary/70">Get started with your Mahidol account.</p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="username" className="block text-sm font-semibold text-primary mb-2">
                Display name
              </label>
              <input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="e.g. Ari"
                className="w-full px-4 py-3 rounded-xl border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
              />
            </div>

            <div>
              <label
                htmlFor="register-email"
                className="block text-sm font-semibold text-primary mb-2"
              >
                Email
              </label>
              <input
                id="register-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@mahidol.edu"
                required
                className="w-full px-4 py-3 rounded-xl border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
              />
            </div>

            <div>
              <label
                htmlFor="register-password"
                className="block text-sm font-semibold text-primary mb-2"
              >
                Password
              </label>
              <input
                id="register-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 rounded-xl border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-warm/10 border border-warm/20 text-warm font-semibold text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-primary to-accent hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating account…' : 'Register'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-primary/70">
            Already have an account?{' '}
            <Link to="/login" className="text-accent hover:underline font-semibold">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
