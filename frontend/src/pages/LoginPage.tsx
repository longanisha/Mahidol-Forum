import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function LoginPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()

  const redirectTo = useMemo(() => {
    const state = location.state as { from?: { pathname?: string } } | null
    return state?.from?.pathname || '/'
  }, [location.state])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setError(t('auth.enterEmail'))
      setLoading(false)
      return
    }

    if (!password) {
      setError(t('auth.enterPassword'))
      setLoading(false)
      return
    }

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    })

    if (signInError) {
      // Provide more user-friendly error messages
      let errorMessage = signInError.message
      if (signInError.message.includes('Invalid login credentials')) {
        errorMessage = t('auth.invalidCredentials')
      } else if (signInError.message.includes('Email not confirmed')) {
        errorMessage = t('auth.emailNotConfirmed')
      } else if (signInError.status === 400) {
        errorMessage = t('auth.invalidRequest')
      }
      setError(errorMessage)
      setLoading(false)
      return
    }

    if (!data.user) {
      setError(t('auth.loginError'))
      setLoading(false)
      return
    }

    navigate(redirectTo)
  }

  useEffect(() => {
    if (user) {
      navigate('/')
    }
  }, [user, navigate])

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
            <h1 className="text-3xl font-bold text-primary mb-2">{t('auth.welcomeBack')}</h1>
            <p className="text-primary/70">{t('auth.loginToAccount')}</p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-primary mb-2">
                {t('auth.email')}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@mahidol.edu"
                required
                className="w-full px-4 py-3 rounded-xl border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-primary mb-2">
                {t('auth.password')}
              </label>
              <input
                id="password"
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
              {loading ? t('auth.signingIn') : t('auth.login')}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-primary/70">
            {t('auth.noAccount')}{' '}
            <Link to="/register" className="text-accent hover:underline font-semibold">
              {t('auth.createAccount')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
