import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function SuperAdminLoginPage() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // If already logged in and is superadmin, redirect
  useEffect(() => {
    async function checkAndRedirect() {
      if (!authLoading && user) {
        console.log('[SuperAdminLogin] User already logged in, checking role...')
        try {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

          if (!profileError && profileData) {
            console.log('[SuperAdminLogin] Current user role:', profileData.role)
            if (profileData.role === 'superadmin') {
              console.log('[SuperAdminLogin] ✅ Already superadmin, redirecting...')
              window.location.href = '/superadmin'
            }
          }
        } catch (err) {
          console.error('[SuperAdminLogin] Error checking role:', err)
        }
      }
    }

    checkAndRedirect()
  }, [user, authLoading])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (signInError) {
        let errorMessage = signInError.message
        if (signInError.message.includes('Invalid login credentials')) {
          errorMessage = 'Invalid email or password. Please check your credentials.'
        } else if (signInError.message.includes('Email not confirmed')) {
          errorMessage = 'Please verify your email address before logging in.'
        }
        setError(errorMessage)
        setLoading(false)
        return
      }

      if (data.user) {
        // Check if user is superadmin
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role, username')
          .eq('id', data.user.id)
          .single()

        console.log('[SuperAdminLogin] Profile check:', { profile, profileError })

        if (profileError) {
          console.error('[SuperAdminLogin] Profile error:', profileError)
          if (profileError.code === 'PGRST116') {
            setError('Profile not found. Please contact administrator.')
          } else {
            setError(`Failed to verify superadmin access: ${profileError.message}`)
          }
          setLoading(false)
          return
        }

        if (!profile) {
          setError('Profile not found. Please contact administrator.')
          setLoading(false)
          return
        }

        console.log('[SuperAdminLogin] User role:', profile.role)

        if (profile.role !== 'superadmin') {
          const roleMessage = profile.role 
            ? `Your current role is "${profile.role}". SuperAdmin role required.`
            : 'Your account does not have superadmin privileges.'
          setError(roleMessage)
          await supabase.auth.signOut()
          setLoading(false)
          return
        }

        // Success - redirect to superadmin dashboard
        console.log('[SuperAdminLogin] ✅ Access granted, redirecting to superadmin dashboard')
        
        setTimeout(() => {
          window.location.href = '/superadmin'
        }, 300)
      }
    } catch (err) {
      console.error('Login error:', err)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        backgroundImage: 'url(/mahidol_bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="absolute inset-0 bg-primary/80 backdrop-blur-sm"></div>
      <div className="w-full max-w-md relative z-10">
        <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-8 border border-white/20">
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent via-sun to-warm flex items-center justify-center text-white font-bold text-3xl mx-auto mb-4 shadow-lg">
              ⚡
            </div>
            <h1 className="text-3xl font-bold text-primary mb-2">SuperAdmin Portal</h1>
            <p className="text-primary/70">System administration and management</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 rounded-lg bg-warm/10 border border-warm/20 text-warm font-semibold">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="superadmin-email" className="block text-sm font-semibold text-primary mb-2">
                Email
              </label>
              <input
                id="superadmin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="superadmin@example.com"
                className="w-full px-4 py-3 rounded-xl border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
              />
            </div>

            <div>
              <label htmlFor="superadmin-password" className="block text-sm font-semibold text-primary mb-2">
                Password
              </label>
              <input
                id="superadmin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
                className="w-full px-4 py-3 rounded-xl border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-primary via-accent to-sun hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/')}
              className="text-sm text-primary/70 hover:text-primary transition"
            >
              ← Back to Forum
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

