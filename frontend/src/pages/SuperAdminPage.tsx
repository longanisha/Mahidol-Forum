import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { StatsOverview } from '../components/superadmin/StatsOverview'
import { UserManagement } from '../components/superadmin/UserManagement'

type TabType = 'overview' | 'users' | 'system'

export function SuperAdminPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [roleCheck, setRoleCheck] = useState<{ loading: boolean; isSuperAdmin: boolean | null }>({
    loading: true,
    isSuperAdmin: null,
  })

  useEffect(() => {
    async function checkSuperAdminRole() {
      if (!user) {
        setRoleCheck({ loading: false, isSuperAdmin: false })
        return
      }

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (error) {
          console.error('[SuperAdminPage] Failed to check role:', error)
          setRoleCheck({ loading: false, isSuperAdmin: false })
          return
        }

        const isSuperAdmin = profile?.role === 'superadmin'
        setRoleCheck({ loading: false, isSuperAdmin })

        if (!isSuperAdmin) {
          navigate('/superadmin/login', { replace: true })
        }
      } catch (err) {
        console.error('[SuperAdminPage] Error checking role:', err)
        setRoleCheck({ loading: false, isSuperAdmin: false })
        navigate('/superadmin/login', { replace: true })
      }
    }

    if (!authLoading) {
      checkSuperAdminRole()
    }
  }, [user, authLoading, navigate])

  if (authLoading || roleCheck.loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-primary/60">Checking permissions...</div>
      </div>
    )
  }

  if (!user || !roleCheck.isSuperAdmin) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <p className="text-primary/70 mb-4">Access denied. SuperAdmin role required.</p>
          <button
            onClick={() => navigate('/superadmin/login')}
            className="px-6 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-primary to-accent hover:shadow-lg transition"
          >
            Go to SuperAdmin Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-primary mb-2 flex items-center gap-3">
                <span className="text-4xl">⚡</span>
                SuperAdmin Portal
              </h1>
              <p className="text-primary/70">System administration and management</p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-primary border border-primary/15 hover:bg-primary/5 transition"
            >
              ← Back to Forum
            </button>
          </div>
        </header>

        {/* Tabs */}
        <div className="bg-white rounded-2xl border border-primary/10 shadow-sm mb-6">
          <div className="flex border-b border-primary/10 overflow-x-auto">
            {(['overview', 'users', 'system'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-4 font-semibold transition capitalize ${
                  activeTab === tab
                    ? 'text-accent border-b-2 border-accent'
                    : 'text-primary/70 hover:text-primary hover:bg-primary/5'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && <StatsOverview />}
        {activeTab === 'users' && <UserManagement />}
        {activeTab === 'system' && (
          <div className="bg-white rounded-2xl p-8 border border-primary/10 shadow-sm text-center">
            <p className="text-primary/70">System management features coming soon...</p>
          </div>
        )}
      </div>
    </div>
  )
}

