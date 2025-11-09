import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'

type UserProfile = {
  id: string
  username: string | null
  total_points: number
  level: number
  role?: string
  created_at: string
}

async function fetchUsers(accessToken: string | null, roleFilter?: string): Promise<UserProfile[]> {
  const url = roleFilter 
    ? `/superadmin/users?role_filter=${roleFilter}`
    : '/superadmin/users'
  return apiFetch<UserProfile[]>(url, { accessToken })
}

export function UserManagement() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [newRole, setNewRole] = useState<string>('')

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['superadmin', 'users', roleFilter],
    queryFn: () => fetchUsers(accessToken, roleFilter || undefined),
    enabled: !!accessToken,
  })

  const { mutate: updateRole, isPending: isUpdating } = useMutation({
    mutationFn: async (data: { userId: string; role: string }) => {
      return apiFetch(`/superadmin/users/${data.userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ new_role: data.role }),
        accessToken,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'users'] })
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'stats'] })
      setEditingUserId(null)
      setNewRole('')
      alert('User role updated successfully!')
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to update role'
      alert(message)
    },
  })

  const { mutate: deleteUser, isPending: isDeleting } = useMutation({
    mutationFn: async (userId: string) => {
      return apiFetch(`/superadmin/users/${userId}`, {
        method: 'DELETE',
        accessToken,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'users'] })
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'stats'] })
      alert('User deleted successfully!')
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to delete user'
      alert(message)
    },
  })

  const handleUpdateRole = (userId: string, currentRole: string) => {
    setEditingUserId(userId)
    setNewRole(currentRole)
  }

  const handleSaveRole = (userId: string) => {
    if (!newRole) {
      alert('Please select a role')
      return
    }
    updateRole({ userId, role: newRole })
  }

  const handleDeleteUser = (userId: string, username: string | null) => {
    if (confirm(`Are you sure you want to delete user "${username || userId}"? This action cannot be undone.`)) {
      deleteUser(userId)
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'superadmin':
        return 'bg-gradient-to-r from-warm to-sun text-white'
      case 'admin':
        return 'bg-accent text-white'
      case 'moderator':
        return 'bg-primary/20 text-primary'
      default:
        return 'bg-primary/10 text-primary/70'
    }
  }

  if (isLoading) {
    return <div className="text-center py-12 text-primary/60">Loading users…</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-primary">User Management</h2>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-4 py-2 rounded-xl border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
        >
          <option value="">All Roles</option>
          <option value="superadmin">SuperAdmin</option>
          <option value="admin">Admin</option>
          <option value="moderator">Moderator</option>
          <option value="user">User</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-primary/10 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-primary/5">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-primary/70 uppercase tracking-wider">
                  Username
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-primary/70 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-primary/70 uppercase tracking-wider">
                  Points
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-primary/70 uppercase tracking-wider">
                  Level
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-primary/70 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-primary/70 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/5">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-primary/5 transition">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-semibold text-primary">{user.username || 'Anonymous'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingUserId === user.id ? (
                      <select
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-primary/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                      >
                        <option value="user">User</option>
                        <option value="moderator">Moderator</option>
                        <option value="admin">Admin</option>
                        <option value="superadmin">SuperAdmin</option>
                      </select>
                    ) : (
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getRoleBadgeColor(user.role || 'user')}`}>
                        {user.role || 'user'}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-accent font-semibold">{user.total_points}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-sun/20 text-primary">
                      Level {user.level}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-primary/60">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingUserId === user.id ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveRole(user.id)}
                          disabled={isUpdating}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-green-600 hover:bg-green-700 transition disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingUserId(null)
                            setNewRole('')
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-primary border border-primary/15 hover:bg-primary/5 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateRole(user.id, user.role || 'user')}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-primary border border-primary/15 hover:bg-primary/5 transition"
                        >
                          Edit Role
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id, user.username)}
                          disabled={isDeleting}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-warm border border-warm hover:bg-warm/10 transition disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

