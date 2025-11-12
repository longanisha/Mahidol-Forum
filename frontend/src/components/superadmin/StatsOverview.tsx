import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'

type SuperAdminStats = {
  total_users: number
  total_threads: number
  total_posts: number
  total_groups: number
  total_applications: number
  total_reports: number
  role_distribution: Record<string, number>
}

async function fetchSuperAdminStats(accessToken: string | null): Promise<SuperAdminStats> {
  return apiFetch<SuperAdminStats>('/superadmin/stats', { accessToken })
}

export function StatsOverview() {
  const { accessToken } = useAuth()
  
  const { data: stats, isLoading } = useQuery({
    queryKey: ['superadmin', 'stats'],
    queryFn: () => fetchSuperAdminStats(accessToken),
    enabled: !!accessToken,
  })

  if (isLoading) {
    return (
      <div className="text-center py-12 text-primary/60">Loading statistics…</div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-primary/10 shadow-sm">
          <div className="text-sm text-primary/60 mb-2">Total Users</div>
          <div className="text-3xl font-bold text-primary">{stats?.total_users ?? 0}</div>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-primary/10 shadow-sm">
          <div className="text-sm text-primary/60 mb-2">Total Threads</div>
          <div className="text-3xl font-bold text-primary">{stats?.total_threads ?? 0}</div>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-primary/10 shadow-sm">
          <div className="text-sm text-primary/60 mb-2">Total Posts</div>
          <div className="text-3xl font-bold text-primary">{stats?.total_posts ?? 0}</div>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-primary/10 shadow-sm">
          <div className="text-sm text-primary/60 mb-2">LINE Groups</div>
          <div className="text-3xl font-bold text-primary">{stats?.total_groups ?? 0}</div>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-primary/10 shadow-sm">
          <div className="text-sm text-primary/60 mb-2">Applications</div>
          <div className="text-3xl font-bold text-primary">{stats?.total_applications ?? 0}</div>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-primary/10 shadow-sm">
          <div className="text-sm text-primary/60 mb-2">Reports</div>
          <div className="text-3xl font-bold text-primary">{stats?.total_reports ?? 0}</div>
        </div>
      </div>

      {stats?.role_distribution && (
        <div className="bg-white rounded-2xl p-6 border border-primary/10 shadow-sm">
          <h3 className="text-lg font-bold text-primary mb-4">User Role Distribution</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(stats.role_distribution).map(([role, count]) => (
              <div key={role} className="text-center">
                <div className="text-2xl font-bold text-accent">{count}</div>
                <div className="text-sm text-primary/70 capitalize">{role}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

