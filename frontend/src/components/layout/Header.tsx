import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { LanguageSwitcher } from './LanguageSwitcher'

export function Header() {
  const { t } = useTranslation()
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [avatarError, setAvatarError] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const MENU_ITEMS = [
    { id: 'discussions', label: t('header.discussions'), description: t('header.discussionsDesc') },
    { id: 'line-group', label: t('header.lineGroup'), description: t('header.lineGroupDesc') },
    { id: 'announcements', label: t('header.announcements'), description: t('header.announcementsDesc') },
  ]
  
  // Admin
  const isAdminPage = location.pathname.startsWith('/admin') || location.pathname.startsWith('/superadmin')
  
  // Current View
  const currentView = location.pathname === '/' ? (searchParams.get('view') || 'discussions') : null
  

  useEffect(() => {
    if (profile?.avatar_url && profile.avatar_url.trim() !== '') {
      console.log('[Header] Avatar URL changed, resetting error state')
      setAvatarError(false)
    }
  }, [profile?.avatar_url])
  
  // Profile
  useEffect(() => {
    if (user) {
      console.log('[Header] ====== Avatar Display Debug ======')
      console.log('[Header] User logged in:', user.id)
      console.log('[Header] Profile exists:', !!profile)
      console.log('[Header] Profile data:', profile)
      console.log('[Header] Avatar URL:', profile?.avatar_url || 'none')
      console.log('[Header] Avatar URL type:', typeof profile?.avatar_url)
      console.log('[Header] Avatar URL length:', profile?.avatar_url?.length || 0)
      console.log('[Header] Avatar URL trimmed:', profile?.avatar_url?.trim() || 'empty')
      console.log('[Header] Should show image:', !!(profile?.avatar_url && profile.avatar_url.trim() !== '' && !avatarError))
      console.log('[Header] Avatar Error:', avatarError)
      console.log('[Header] ====================================')
    }
  }, [user, profile, avatarError])
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }
    
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isMenuOpen])
  
  const isActive = (itemId: string) => {
    if (!currentView) return false
    if (itemId === 'line-group') {
      return currentView === 'line-groups'
    }
    return currentView === itemId
  }
  

  const handleMenuClick = (itemId: string) => {
    setIsMenuOpen(false)
    if (itemId === 'line-group') {
      navigate('/?view=line-groups')
    } else if (itemId === 'discussions') {
      navigate('/?view=discussions')
    } else if (itemId === 'announcements') {
      navigate('/?view=announcements')
    } else {
      navigate('/')
    }
  }

  const handleSignOut = async () => {
    try {
      if (typeof window !== 'undefined') {
        // localStorage
        localStorage.clear()
        // sessionStorage
        sessionStorage.clear()
      }
      
      await signOut()
      
      navigate('/', { replace: true })
      window.location.href = '/' 
    } catch (error) {
      console.error('Sign out error:', error)
      if (typeof window !== 'undefined') {
        localStorage.clear()
        sessionStorage.clear()
      }
      navigate('/', { replace: true })
      window.location.href = '/'
    }
  }

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-primary/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          <div className="flex items-center gap-3">
            {!isAdminPage && (
              <button
                type="button"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-primary/10 transition"
                aria-label="Toggle menu"
              >
                <svg
                  className="w-6 h-6 text-primary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {isMenuOpen ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  )}
                </svg>
              </button>
            )}
            
            <Link to="/" className="flex items-center gap-3 text-primary hover:opacity-80 transition">
              <img 
                src="/forum_logo.png" 
                alt={t('header.mahidolForum')} 
                className="h-10 w-auto"
              />
              <div>
                <div className="font-bold text-lg leading-tight">{t('header.mahidolForum')}</div>
                <div className="text-xs text-primary/60">{t('header.tagline')}</div>
              </div>
            </Link>
          </div>

          {!isAdminPage && isMenuOpen && (
            <div 
              ref={menuRef}
              className="absolute top-16 left-0 right-0 bg-white border-b border-primary/10 shadow-lg lg:hidden z-50"
            >
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <div className="text-xs font-semibold text-primary/50 uppercase tracking-wider mb-3">
                  {t('common.menu')}
                </div>
                <ul className="space-y-1">
                  {MENU_ITEMS.map((item) => {
                    const active = isActive(item.id)
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => handleMenuClick(item.id)}
                          className={`w-full flex items-center justify-between p-2.5 rounded-lg transition text-left ${
                            active
                              ? 'bg-accent/10 border border-accent/30'
                              : 'hover:bg-primary/5'
                          }`}
                        >
                          <div>
                            <div className={`font-semibold text-sm ${
                              active ? 'text-accent' : 'text-primary'
                            }`}>
                              {item.label}
                            </div>
                            <div className="text-xs text-primary/60 mt-0.5">{item.description}</div>
                          </div>
                          <span className={`transition ${active ? 'text-accent' : 'text-primary/30'}`} aria-hidden="true">
                            →
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
          )}

          {user ? (
            <div className="flex items-center gap-3">
              <Link
                to="/profile"
                className="w-10 h-10 rounded-full bg-[#1D4F91] flex items-center justify-center text-white font-semibold text-sm hover:opacity-80 transition cursor-pointer overflow-hidden relative shrink-0"
                title={t('common.viewProfile')}
              >
                {profile?.avatar_url && profile.avatar_url.trim() !== '' && !avatarError ? (
                  <img
                    key={profile.avatar_url}
                    src={profile.avatar_url}
                    alt={profile?.username || user.email || 'User'}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      console.warn('[Header] Avatar image failed to load:', profile.avatar_url, e)
                      setAvatarError(true)
                    }}
                    onLoad={() => {
                      setAvatarError(false)
                    }}
                  />
                ) : (
                  <span className="select-none">
                    {profile?.username?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'M'}
                  </span>
                )}
              </Link>
              <div className="hidden sm:flex items-center gap-2">
                <div className="text-sm font-semibold text-primary">
                  {profile?.username || user.email?.split('@')[0] || t('common.member')}
                </div>
                <LanguageSwitcher />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    console.log('Sign out button clicked')
                    handleSignOut()
                  }}
                  className="px-3 py-1.5 text-sm font-semibold text-warm bg-warm/10 hover:bg-warm/20 rounded-full transition"
                >
                  {t('common.signOut')}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <Link
                to="/login"
                className="px-4 py-2 rounded-full font-semibold text-primary bg-primary/10 hover:bg-primary/20 transition"
              >
                {t('common.login')}
              </Link>
              <Link
                to="/register"
                className="px-4 py-2 rounded-full font-semibold text-white bg-gradient-to-r from-primary to-accent hover:shadow-lg transition shadow-md"
              >
                {t('common.register')}
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
