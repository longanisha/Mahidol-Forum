import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../lib/api'

export function AdminLoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      console.log('[AdminLogin] Attempting to login with email:', email.trim())
      
      // API
      const response = await apiFetch<{
        success: boolean
        admin_id: string
        email: string
        username: string | null
        message: string
      }>('/admin-auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      })

      console.log('[AdminLogin] Login response:', response)

      if (response.success) {
        console.log('[AdminLogin] ✅ Login successful, redirecting to admin dashboard...')
        
        
        localStorage.setItem('admin_id', response.admin_id)
        localStorage.setItem('admin_email', response.email)
        if (response.username) {
          localStorage.setItem('admin_username', response.username)
        }
        
      
        window.location.href = '/admin'
      } else {
        setError(response.message || 'Login failed, please try again.')
      }
    } catch (err) {
      console.error('[AdminLogin] Login error:', err)
      let errorMessage = 'Login failed, please try again.'
      
      if (err instanceof Error) {
        if (err.message.includes('401') || err.message.includes('Unauthorized')) {
          errorMessage = 'Account or password incorrect, please check your credentials.'
        } else if (err.message.includes('Failed to fetch') || err.message.includes('Network')) {
          errorMessage = 'Unable to connect to server, please check your network connection.'
        } else {
          errorMessage = err.message
        }
      }
      
      setError(errorMessage)
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
        <div className="bg-white rounded-2xl p-8 border border-primary/10 shadow-lg">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-accent to-sun flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4">
              MF
            </div>
            <h1 className="text-3xl font-bold text-primary mb-2">Admin Dashboard</h1>
            <p className="text-primary/70">Sign in with your admin account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 rounded-lg bg-warm/10 border border-warm/20 text-warm font-semibold">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="admin-email" className="block text-sm font-semibold text-primary mb-2">
                Email
              </label>
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="admin@example.com"
                autoComplete="email"
                className="w-full px-4 py-3 rounded-xl border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
              />
            </div>

            <div>
              <label htmlFor="admin-password" className="block text-sm font-semibold text-primary mb-2">
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-xl border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-primary to-accent hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
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
