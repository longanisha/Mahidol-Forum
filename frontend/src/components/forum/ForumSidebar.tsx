import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { apiFetch } from '../../lib/api'

type ForumSidebarProps = {
  onSelectMenu?: (section: string) => void
  totalThreads?: number
}

const MENU_ITEMS = [
  { id: 'discussions', label: 'Discussions', description: 'Live topics from every faculty' },
  { id: 'line-group', label: 'Line Group', description: 'Join LINE groups and communities' },
  { id: 'announcements', label: 'Announcements', description: 'Moderation and campus updates' },
]

type Announcement = {
  id: string
  title: string
  content: string
  created_by: string
  is_active: boolean
  priority: number
  created_at: string
  updated_at: string | null
  author: {
    id: string | null
    username: string | null
  } | null
}

async function fetchAnnouncements(): Promise<Announcement[]> {
  return apiFetch<Announcement[]>('/announcements?active_only=true')
}

type CommunityStats = {
  active_members: number
  threads_this_week: number
}

async function fetchCommunityStats(): Promise<CommunityStats> {
  return apiFetch<CommunityStats>('/stats/community')
}

type TopUser = {
  id: string
  username: string | null
  total_points: number
  level: number
  avatar_url?: string | null
}

async function fetchTopUsers(): Promise<TopUser[]> {
  return apiFetch<TopUser[]>('/stats/top-users?limit=5')
}

function formatNumber(num: number): string {
  if (num >= 1000) {
    const k = num / 1000
    if (k >= 10) {
      return `${Math.floor(k)}k`
    }
    return `${k.toFixed(1)}k`
  }
  return num.toString()
}

export function ForumSidebar({ onSelectMenu, totalThreads }: ForumSidebarProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const currentView = searchParams.get('view') || 'discussions'
  
  // 页面加载时始终获取最新的 announcements（因为侧边栏在所有视图下都显示）
  const { data: announcements = [] } = useQuery({
    queryKey: ['announcements'],
    queryFn: fetchAnnouncements,
    enabled: true, // 始终启用，在页面加载时获取
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: true, // 组件挂载时重新获取，确保获取最新数据
  })

  // 在所有视图下都请求统计数据
  const { data: stats } = useQuery({
    queryKey: ['community-stats'],
    queryFn: fetchCommunityStats,
    enabled: true, // 始终启用，在所有视图下都显示统计数据
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // 获取前5名用户
  const { data: topUsers = [], isLoading: topUsersLoading } = useQuery({
    queryKey: ['top-users'],
    queryFn: fetchTopUsers,
    enabled: true, // 始终启用
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const communityStats = [
    { label: 'Active members', value: stats ? formatNumber(stats.active_members) : '0' },
    { label: 'Threads this week', value: stats ? stats.threads_this_week.toString() : '0' },
  ]
  
  const handleMenuClick = (itemId: string) => {
    if (onSelectMenu) {
      onSelectMenu(itemId)
    } else {
      // 默认导航行为
      if (itemId === 'line-group') {
        navigate('/?view=line-groups')
      } else if (itemId === 'discussions') {
        navigate('/?view=discussions')
      } else if (itemId === 'announcements') {
        navigate('/?view=announcements')
      }
    }
  }

  // 判断菜单项是否激活
  const isActive = (itemId: string) => {
    if (itemId === 'line-group') {
      return currentView === 'line-groups'
    }
    return currentView === itemId
  }
  
  return (
    <aside className="w-64 shrink-0 hidden lg:block space-y-4">
      <div className="bg-white rounded-2xl p-5 border border-primary/10 shadow-sm">
        <p className="text-sm text-primary/70 mb-4">
          Share an insight, ask a question, or help someone plan their Mahidol journey.
        </p>
        {user ? (
          <Link
            to="/create-thread"
            className="block w-full text-center px-4 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-warm to-sun hover:shadow-lg transition"
          >
            Post a topic
          </Link>
        ) : (
          <Link
            to="/login"
            className="block w-full text-center px-4 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-warm to-sun hover:shadow-lg transition"
          >
            Login to Post
          </Link>
        )}
      </div>

      <div className="bg-white rounded-2xl p-4 border border-primary/10 shadow-sm">
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
                  className={`w-full flex items-center justify-between p-2.5 rounded-lg transition text-left group ${
                    active
                      ? 'bg-accent/10 border border-accent/30'
                      : 'hover:bg-primary/5'
                  }`}
                >
                  <div>
                    <div className={`font-semibold text-sm transition ${
                      active
                        ? 'text-accent'
                        : 'text-primary group-hover:text-accent'
                    }`}>
                      {item.label}
                    </div>
                    <div className="text-xs text-primary/60 mt-0.5">{item.description}</div>
                  </div>
                  {item.id === 'discussions' && totalThreads ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white bg-accent">
                      {totalThreads}
                    </span>
                  ) : (
                    <span className={`transition ${active ? 'text-accent' : 'text-primary/30'}`} aria-hidden="true">
                      →
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="bg-white rounded-2xl p-4 border border-primary/10 shadow-sm" data-announcements-section>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-primary/50 uppercase tracking-wider">
            Announcements
          </span>
          <span className="text-xs text-primary/40">Updated daily</span>
        </div>
        <ul className="space-y-3">
          {announcements.length > 0 ? (
            announcements.slice(0, 5).map((announcement) => (
              <li key={announcement.id} className="pb-3 border-b border-primary/5 last:border-0">
                <div className="font-semibold text-sm text-primary mb-1">{announcement.title}</div>
                <p className="text-xs text-primary/60 leading-relaxed">{announcement.content}</p>
              </li>
            ))
          ) : (
            <li className="text-xs text-primary/40 italic">No announcements yet</li>
          )}
        </ul>
      </div>

      <div className="bg-gradient-to-br from-primary to-accent rounded-2xl p-5 text-white">
        <div className="grid grid-cols-2 gap-4">
          {communityStats.map((stat) => (
            <div key={stat.label}>
              <div className="text-2xl font-bold mb-1">{stat.value}</div>
              <div className="text-xs opacity-90">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Top 5 Points Ranking Card */}
      <div className="bg-white rounded-2xl p-4 border border-primary/10 shadow-sm">
        <div className="text-xs font-semibold text-primary/50 uppercase tracking-wider mb-3">
          Top 5 Ranking
        </div>
        {topUsersLoading ? (
          <div className="text-center py-4 text-primary/40 text-sm">Loading...</div>
        ) : topUsers.length === 0 ? (
          <div className="text-center py-4 text-primary/40 text-sm">No data</div>
        ) : (
          <div className="space-y-2">
            {topUsers.map((user, index) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-2 rounded-lg bg-gradient-to-r from-primary/5 to-accent/5 hover:from-primary/10 hover:to-accent/10 transition"
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
                    <div className="text-sm font-semibold text-primary truncate">
                      {user.username || 'Anonymous'}
                    </div>
                    <div className="text-xs text-primary/50">Level {user.level || 1}</div>
                  </div>
                </div>
                <div className="flex-shrink-0 ml-2 text-right">
                  <div className="text-sm font-bold text-accent">{user.total_points || 0}</div>
                  <div className="text-xs text-primary/40">pts</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl p-4 border border-primary/10 shadow-sm">
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <a
            href="https://github.com/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-primary/60 hover:text-accent transition shrink-0"
            title="GitHub"
          >
            <span aria-hidden="true" className="text-base">🐙</span>
            <span className="text-xs font-medium whitespace-nowrap">GitHub</span>
          </a>
          <a
            href="https://instagram.com/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-primary/60 hover:text-accent transition shrink-0"
            title="Instagram"
          >
            <span aria-hidden="true" className="text-base">📸</span>
            <span className="text-xs font-medium whitespace-nowrap">Instagram</span>
          </a>
          <a
            href="https://facebook.com/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-primary/60 hover:text-accent transition shrink-0"
            title="Facebook"
          >
            <span aria-hidden="true" className="text-base">📘</span>
            <span className="text-xs font-medium whitespace-nowrap">Facebook</span>
          </a>
        </div>
      </div>
    </aside>
  )
}
