import { useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../../lib/api'

type MenuItem = {
  id: string
  label: string
  icon: string
  section?: 'menu' | 'others'
}

const MENU_ITEMS: MenuItem[] = [
  { id: 'overview', label: 'Overview', icon: '📊', section: 'menu' },
  { id: 'users', label: 'Users', icon: '👥', section: 'menu' },
  { id: 'groups', label: 'Groups', icon: '👨‍👩‍👧‍👦', section: 'menu' },
  { id: 'applications', label: 'Applications', icon: '📋', section: 'menu' },
  { id: 'reports', label: 'Reports', icon: '📝', section: 'menu' },
  { id: 'creation-requests', label: 'Creation Requests', icon: '➕', section: 'menu' },
  { id: 'points', label: 'Points', icon: '⭐', section: 'others' },
  { id: 'announcements', label: 'Announcements', icon: '📢', section: 'others' },
]

type AdminLayoutProps = {
  activeMenu: string
  onMenuChange: (menuId: string) => void
  children: ReactNode
}

type TopUser = {
  id: string
  username: string | null
  total_points?: number
  level?: number
}

function getAdminCredentials() {
  const adminId = localStorage.getItem('admin_id')
  const adminEmail = localStorage.getItem('admin_email')
  return { adminId, adminEmail }
}

async function fetchTopUsers(): Promise<TopUser[]> {
  const { adminId, adminEmail } = getAdminCredentials()
  try {
    const users = await apiFetch<TopUser[]>('/admin/users?limit=100&exclude_admins=true', {
      adminId,
      adminEmail,
    })
    // 按积分降序排序并取前5名
    return users
      .filter(user => user.total_points !== undefined && user.total_points !== null)
      .sort((a, b) => (b.total_points || 0) - (a.total_points || 0))
      .slice(0, 5)
  } catch (error) {
    console.error('Failed to fetch top users:', error)
    return []
  }
}

export function AdminLayout({ activeMenu, onMenuChange, children }: AdminLayoutProps) {
  const navigate = useNavigate()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const adminEmail = localStorage.getItem('admin_email') || 'Admin'

  const menuItems = MENU_ITEMS.filter(item => item.section === 'menu')
  const otherItems = MENU_ITEMS.filter(item => item.section === 'others')

  // 获取前5名用户
  const { data: topUsers = [], isLoading: topUsersLoading } = useQuery({
    queryKey: ['admin', 'top-users'],
    queryFn: fetchTopUsers,
    enabled: !!localStorage.getItem('admin_id'),
  })

  const handleSignOut = () => {
    localStorage.removeItem('admin_id')
    localStorage.removeItem('admin_email')
    navigate('/admin/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 sticky top-0 z-50">
        {/* Left: Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-yellow-400 flex items-center justify-center text-white font-bold text-sm">
            MF
          </div>
          <span className="font-bold text-lg text-gray-800">Mahidol Forum</span>
        </div>

        {/* Center: Search */}
        <div className="flex-1 max-w-md mx-8">
          <div className="relative">
            <input
              type="text"
              placeholder="Search"
              className="w-full px-4 py-2 pl-10 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Right: Notifications & User */}
        <div className="flex items-center gap-4">
          {/* Notifications */}
          <div className="relative">
            <button className="relative p-2 text-gray-600 hover:text-gray-800">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full"></span>
            </button>
          </div>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-semibold">
                {adminEmail.charAt(0).toUpperCase()}
              </div>
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-800">{adminEmail}</p>
                  <p className="text-xs text-gray-500">Administrator</p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="w-full text-left px-4 py-2 text-sm font-semibold text-warm bg-warm/10 hover:bg-warm/20 rounded-lg transition"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Left Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-4rem)]">
          {/* MENU Section */}
          <div className="p-4">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">MENU</div>
            <ul className="space-y-1">
              {menuItems.map((item) => {
                const isActive = activeMenu === item.id
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => onMenuChange(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                        isActive
                          ? 'bg-blue-50 border-l-4 border-blue-500 text-blue-600'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-base">{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* OTHERS Section */}
          <div className="p-4 border-t border-gray-100">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">OTHERS</div>
            <ul className="space-y-1">
              {otherItems.map((item) => {
                const isActive = activeMenu === item.id
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => onMenuChange(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                        isActive
                          ? 'bg-blue-50 border-l-4 border-blue-500 text-blue-600'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-base">{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Top 5 Points Ranking Card */}
          <div className="p-4 border-t border-gray-100">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">TOP 5 RANKING</div>
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-3 border border-blue-100">
              {topUsersLoading ? (
                <div className="text-center py-4 text-gray-500 text-sm">Loading...</div>
              ) : topUsers.length === 0 ? (
                <div className="text-center py-4 text-gray-500 text-sm">No data</div>
              ) : (
                <div className="space-y-2">
                  {topUsers.map((user, index) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-2 rounded-md bg-white/80 hover:bg-white transition"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div
                          className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                            index === 0
                              ? 'bg-gradient-to-br from-yellow-400 to-yellow-600'
                              : index === 1
                                ? 'bg-gradient-to-br from-gray-300 to-gray-500'
                                : index === 2
                                  ? 'bg-gradient-to-br from-orange-400 to-orange-600'
                                  : 'bg-gradient-to-br from-blue-400 to-blue-600'
                          }`}
                        >
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-800 truncate">
                            {user.username || 'Anonymous'}
                          </div>
                          <div className="text-xs text-gray-500">Level {user.level || 1}</div>
                        </div>
                      </div>
                      <div className="flex-shrink-0 ml-2">
                        <div className="text-sm font-bold text-blue-600">{user.total_points || 0}</div>
                        <div className="text-xs text-gray-400 text-right">pts</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

