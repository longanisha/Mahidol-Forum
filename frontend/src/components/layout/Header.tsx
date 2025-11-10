import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const MENU_ITEMS = [
  { id: 'discussions', label: 'Discussions', description: 'Live topics from every faculty' },
  { id: 'line-group', label: 'Line Group', description: 'Join LINE groups and communities' },
  { id: 'announcements', label: 'Announcements', description: 'Moderation and campus updates' },
]

export function Header() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  
  // 在 admin 页面隐藏导航项
  const isAdminPage = location.pathname.startsWith('/admin') || location.pathname.startsWith('/superadmin')
  
  // 获取当前视图（只在首页时使用）
  const currentView = location.pathname === '/' ? (searchParams.get('view') || 'discussions') : null
  
  // 点击外部关闭菜单
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
  
  // 判断菜单项是否激活
  const isActive = (itemId: string) => {
    if (!currentView) return false
    if (itemId === 'line-group') {
      return currentView === 'line-groups'
    }
    return currentView === itemId
  }
  
  // 处理菜单点击
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
      // 直接清除所有状态和 localStorage
      if (typeof window !== 'undefined') {
        // 清除所有 localStorage
        localStorage.clear()
        // 清除 sessionStorage
        sessionStorage.clear()
      }
      
      // 调用 signOut
      await signOut()
      
      // 立即导航到首页并重新加载
      navigate('/', { replace: true })
      window.location.href = '/' // 使用 href 而不是 reload，确保完全刷新
    } catch (error) {
      console.error('Sign out error:', error)
      // 即使出错也清除并重定向
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
            {/* 移动端菜单按钮 */}
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
                alt="Mahidol Forum" 
                className="h-10 w-auto"
              />
              <div>
                <div className="font-bold text-lg leading-tight">Mahidol Forum</div>
                <div className="text-xs text-primary/60">Connect · Learn · Inspire</div>
              </div>
            </Link>
          </div>

          {/* 移动端菜单下拉 */}
          {!isAdminPage && isMenuOpen && (
            <div 
              ref={menuRef}
              className="absolute top-16 left-0 right-0 bg-white border-b border-primary/10 shadow-lg lg:hidden z-50"
            >
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <div className="text-xs font-semibold text-primary/50 uppercase tracking-wider mb-3">
                  Menu
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
                className="w-10 h-10 rounded-full bg-[#1D4F91] flex items-center justify-center text-white font-semibold text-sm hover:opacity-80 transition cursor-pointer overflow-hidden relative"
                title="View profile"
              >
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile?.username || user.email || 'User'}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // 如果图片加载失败，显示首字母
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                      const parent = target.parentElement
                      if (parent) {
                        parent.innerHTML = profile?.username?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'M'
                      }
                    }}
                  />
                ) : (
                  profile?.username?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'M'
                )}
              </Link>
              <div className="hidden sm:flex items-center gap-2">
                <div className="text-sm font-semibold text-primary">
                  {profile?.username || user.email?.split('@')[0] || 'Member'}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    // Language switcher - placeholder
                    console.log('Language switcher clicked')
                  }}
                  className="p-1.5 rounded hover:bg-primary/10 transition"
                  title="Change language"
                >
                  🌐
                </button>
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
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="px-4 py-2 rounded-full font-semibold text-primary bg-primary/10 hover:bg-primary/20 transition"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="px-4 py-2 rounded-full font-semibold text-white bg-gradient-to-r from-primary to-accent hover:shadow-lg transition shadow-md"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
