import { useState, useEffect, useRef, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { AdminLayout } from '../components/admin/AdminLayout'
import { PostsManagement } from '../components/admin/PostsManagement'
import { TagsManagement } from '../components/admin/TagsManagement'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

type AdminStats = {
  total_users: number
  total_threads: number
  total_posts: number
}

type WeeklyStatsData = {
  week: string
  week_start: string
  week_end: string
  new_users: number
  new_posts: number
}

type WeeklyStats = {
  weekly_data: WeeklyStatsData[]
}

type UserProfile = {
  id: string
  username: string | null
  email?: string | null
  total_points: number
  level: number
  created_at: string
}

type LineGroup = {
  id: string
  name: string
  description: string | null
  qr_code_url: string
  manager_id: string
  is_active: boolean
  member_count: number
  created_at: string
  updated_at: string | null
  manager: {
    id: string | null
    username: string | null
    avatar_url: string | null
  } | null
}

type LineGroupApplication = {
  id: string
  user_id: string
  group_id: string
  message: string | null
  status: string
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  user: {
    id: string | null
    username: string | null
    avatar_url: string | null
  } | null
  group: LineGroup | null
}

type LineGroupReport = {
  id: string
  group_id: string
  reporter_id: string
  reason: string
  description: string | null
  status: string
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  reporter: {
    id: string | null
    username: string | null
    avatar_url: string | null
  } | null
  group: LineGroup | null
}

type LineGroupCreationRequest = {
  id: string
  requester_id: string
  name: string
  description: string | null
  qr_code_url: string
  is_private?: boolean
  status: string
  reviewed_by: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  created_at: string
  updated_at: string | null
  requester: {
    id: string | null
    username: string | null
    avatar_url: string | null
  } | null
}

function getAdminCredentials() {
  const adminId = localStorage.getItem('admin_id')
  const adminEmail = localStorage.getItem('admin_email')
  return { adminId, adminEmail }
}

async function fetchStats(): Promise<AdminStats> {
  const { adminId, adminEmail } = getAdminCredentials()
  return apiFetch<AdminStats>('/admin/stats', {
    adminId,
    adminEmail,
  })
}

async function fetchWeeklyStats(): Promise<WeeklyStats> {
  const { adminId, adminEmail } = getAdminCredentials()
  return apiFetch<WeeklyStats>('/admin/stats/weekly?weeks=8', {
    adminId,
    adminEmail,
  })
}

async function fetchUsers(): Promise<UserProfile[]> {
  const { adminId, adminEmail } = getAdminCredentials()
  return apiFetch<UserProfile[]>('/admin/users', {
    adminId,
    adminEmail,
  })
}

async function fetchGroups(): Promise<LineGroup[]> {
  const { adminId, adminEmail } = getAdminCredentials()
  return apiFetch<LineGroup[]>('/line-groups?active_only=false', {
    adminId,
    adminEmail,
  })
}

async function fetchReports(): Promise<LineGroupReport[]> {
  const { adminId, adminEmail } = getAdminCredentials()
  return apiFetch<LineGroupReport[]>('/line-groups/reports', {
    adminId,
    adminEmail,
  })
}

async function fetchApplications(groupId: string | null): Promise<LineGroupApplication[]> {
  if (!groupId) return []
  const { adminId, adminEmail } = getAdminCredentials()
  return apiFetch<LineGroupApplication[]>(`/line-groups/${groupId}/applications`, {
    adminId,
    adminEmail,
  })
}

async function fetchCreationRequests(): Promise<LineGroupCreationRequest[]> {
  const { adminId, adminEmail } = getAdminCredentials()
  return apiFetch<LineGroupCreationRequest[]>('/line-groups/creation-requests', {
    adminId,
    adminEmail,
  })
}

async function fetchAnnouncements(): Promise<Announcement[]> {
  const { adminId, adminEmail } = getAdminCredentials()
  return apiFetch<Announcement[]>('/announcements?active_only=false', {
    adminId,
    adminEmail,
  })
}

async function fetchTags(page: number = 1, pageSize: number = 20, category?: string): Promise<{ tags: Tag[], total: number }> {
  const { adminId, adminEmail } = getAdminCredentials()
  const url = category
    ? `/admin/tags?page=${page}&page_size=${pageSize}&category=${encodeURIComponent(category)}`
    : `/admin/tags?page=${page}&page_size=${pageSize}`
  const response = await apiFetch<Tag[]>(url, {
    adminId,
    adminEmail,
  })
  // For now, return all tags as we don't have pagination in backend yet
  return { tags: response, total: response.length }
}

type MenuType = 'overview' | 'users' | 'groups' | 'applications' | 'reports' | 'creation-requests' | 'tags' | 'points' | 'announcements' | 'posts'

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

type Tag = {
  tag: string
  count: number
}

export function AdminPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeMenu, setActiveMenu] = useState<MenuType>('overview')
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'points' | 'posts'>('newest')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDescription, setNewGroupDescription] = useState('')
  const [newGroupQrCode, setNewGroupQrCode] = useState('')
  const [qrCodeFile, setQrCodeFile] = useState<File | null>(null)
  const [qrCodePreview, setQrCodePreview] = useState<string | null>(null)
  const [isUploadingQrCode, setIsUploadingQrCode] = useState(false)
  const [showQrCodePreviewModal, setShowQrCodePreviewModal] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // User CRUD states
  const [showCreateUserModal, setShowCreateUserModal] = useState(false)
  const [showEditUserModal, setShowEditUserModal] = useState(false)
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null)
  const [newUserUsername, setNewUserUsername] = useState('')
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [editUserUsername, setEditUserUsername] = useState('')
  const [editUserEmail, setEditUserEmail] = useState('')
  const [editUserPassword, setEditUserPassword] = useState('')
  const [editUserPoints, setEditUserPoints] = useState<number>(0)

  // 简化的权限检查：只检查 localStorage 中是否有 admin_id
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)

  useEffect(() => {
    // 检查是否有 admin 登录信息
    const adminId = localStorage.getItem('admin_id')
    const adminEmail = localStorage.getItem('admin_email')

    if (adminId && adminEmail) {
      console.log('[AdminPage] Admin authorized via localStorage')
      setIsAuthorized(true)
    } else {
      console.log('[AdminPage] No admin credentials found, redirecting to login')
      setIsAuthorized(false)
      navigate('/admin/login', { replace: true })
    }
  }, [navigate])

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => fetchStats(),
    enabled: isAuthorized === true && activeMenu === 'overview',
  })

  const { data: weeklyStats, isLoading: weeklyStatsLoading } = useQuery({
    queryKey: ['admin', 'weekly-stats'],
    queryFn: () => fetchWeeklyStats(),
    enabled: isAuthorized === true && activeMenu === 'overview',
  })

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => fetchUsers(),
    enabled: isAuthorized === true && (activeMenu === 'users' || activeMenu === 'points'),
  })

  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ['admin', 'groups'],
    queryFn: () => fetchGroups(),
    enabled: isAuthorized === true && (activeMenu === 'groups' || activeMenu === 'applications'),
  })

  const { data: applications = [], isLoading: applicationsLoading } = useQuery({
    queryKey: ['admin', 'applications', selectedGroup],
    queryFn: () => fetchApplications(selectedGroup),
    enabled: isAuthorized === true && !!selectedGroup && activeMenu === 'applications',
  })

  // 为每个群组获取 pending applications 数量
  const { data: allGroupsApplications = {} } = useQuery({
    queryKey: ['admin', 'groups-applications-count', groups.map(g => g.id).join(',')],
    queryFn: async () => {
      if (!groups.length) return {}
      const { adminId, adminEmail } = getAdminCredentials()
      const counts: Record<string, number> = {}

      // 为每个群组获取所有 applications，然后计算 pending 数量
      await Promise.all(
        groups.map(async (group) => {
          try {
            const apps = await apiFetch<LineGroupApplication[]>(
              `/line-groups/${group.id}/applications`,
              { adminId, adminEmail }
            )
            counts[group.id] = apps.filter(app => app.status === 'pending').length
          } catch (error) {
            console.error(`Failed to fetch applications for group ${group.id}:`, error)
            counts[group.id] = 0
          }
        })
      )

      return counts
    },
    enabled: isAuthorized === true && activeMenu === 'applications' && groups.length > 0,
  })

  const { data: reports = [], isLoading: reportsLoading } = useQuery({
    queryKey: ['admin', 'reports'],
    queryFn: () => fetchReports(),
    enabled: isAuthorized === true && activeMenu === 'reports',
  })

  const { data: creationRequests = [], isLoading: creationRequestsLoading } = useQuery({
    queryKey: ['admin', 'creation-requests'],
    queryFn: () => fetchCreationRequests(),
    enabled: isAuthorized === true && activeMenu === 'creation-requests',
  })

  const { data: announcements = [], isLoading: announcementsLoading } = useQuery({
    queryKey: ['admin', 'announcements'],
    queryFn: () => fetchAnnouncements(),
    enabled: isAuthorized === true && activeMenu === 'announcements',
  })

  const { data: tags = [], isLoading: tagsLoading, isError: tagsError, error: tagsErrorDetail } = useQuery({
    queryKey: ['admin', 'tags'],
    queryFn: () => fetchTags(),
    enabled: isAuthorized === true && activeMenu === 'tags',
    retry: 1,
  })

  const { mutate: createGroup, isPending: isCreatingGroup } = useMutation({
    mutationFn: async (data: { name: string; description?: string; qr_code_url: string }) => {
      const { adminId, adminEmail } = getAdminCredentials()
      return apiFetch<LineGroup>('/line-groups', {
        method: 'POST',
        body: JSON.stringify(data),
        adminId,
        adminEmail,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'groups'] })
      queryClient.invalidateQueries({ queryKey: ['line-groups'] })
      setShowCreateGroupModal(false)
      setNewGroupName('')
      setNewGroupDescription('')
      setNewGroupQrCode('')
      alert('Group created successfully!')
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to create group'
      alert(message)
    },
  })

  const { mutate: updateGroup, isPending: isUpdatingGroup } = useMutation({
    mutationFn: async (data: { groupId: string; updates: Partial<LineGroup> }) => {
      const { adminId, adminEmail } = getAdminCredentials()
      return apiFetch<LineGroup>(`/line-groups/${data.groupId}`, {
        method: 'PATCH',
        body: JSON.stringify(data.updates),
        adminId,
        adminEmail,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'groups'] })
      queryClient.invalidateQueries({ queryKey: ['line-groups'] })
      alert('Group updated successfully!')
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to update group'
      alert(message)
    },
  })

  const { mutate: deleteGroup, isPending: isDeletingGroup } = useMutation({
    mutationFn: async (groupId: string) => {
      const { adminId, adminEmail } = getAdminCredentials()
      return apiFetch(`/line-groups/${groupId}`, {
        method: 'DELETE',
        adminId,
        adminEmail,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'groups'] })
      queryClient.invalidateQueries({ queryKey: ['line-groups'] })
      alert('Group deleted successfully!')
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to delete group'
      alert(message)
    },
  })

  const { mutate: reviewApplication, isPending: isReviewing } = useMutation({
    mutationFn: async (data: { applicationId: string; status: 'approved' | 'rejected' }) => {
      const { adminId, adminEmail } = getAdminCredentials()
      return apiFetch<LineGroupApplication>(`/line-groups/applications/${data.applicationId}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ status: data.status }),
        adminId,
        adminEmail,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'applications'] })
      alert('Application reviewed successfully!')
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to review application'
      alert(message)
    },
  })

  const { mutate: reviewReport, isPending: isReviewingReport } = useMutation({
    mutationFn: async (data: { reportId: string; status: 'approved' | 'rejected' }) => {
      const { adminId, adminEmail } = getAdminCredentials()
      // Map to report status values
      const reportStatus = data.status === 'approved' ? 'resolved' : 'dismissed'
      return apiFetch<LineGroupReport>(`/line-groups/reports/${data.reportId}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ status: reportStatus }),
        adminId,
        adminEmail,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] })
      alert('Report reviewed successfully!')
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to review report'
      alert(message)
    },
  })

  const [showCreateAnnouncementModal, setShowCreateAnnouncementModal] = useState(false)
  const [newAnnouncementTitle, setNewAnnouncementTitle] = useState('')
  const [newAnnouncementContent, setNewAnnouncementContent] = useState('')
  const [newAnnouncementPriority, setNewAnnouncementPriority] = useState(0)
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null)

  // Tags management states
  const [showRenameTagModal, setShowRenameTagModal] = useState(false)
  const [showMergeTagModal, setShowMergeTagModal] = useState(false)
  const [showCreateTagModal, setShowCreateTagModal] = useState(false)
  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  const [renameOldTag, setRenameOldTag] = useState('')
  const [renameNewTag, setRenameNewTag] = useState('')
  const [mergeSourceTags, setMergeSourceTags] = useState<string[]>([])
  const [mergeTargetTag, setMergeTargetTag] = useState('')
  const [newTagName, setNewTagName] = useState('')
  const [tagSearchQuery, setTagSearchQuery] = useState('')
  const [tagCategory, setTagCategory] = useState<'all' | 'general' | 'flea-market'>('all')
  const [tagPage, setTagPage] = useState(1)
  const tagPageSize = 20

  const { mutate: createAnnouncement, isPending: isCreatingAnnouncement } = useMutation({
    mutationFn: async (data: { title: string; content: string; priority: number; is_active: boolean }) => {
      const { adminId, adminEmail } = getAdminCredentials()
      return apiFetch<Announcement>('/announcements', {
        method: 'POST',
        body: JSON.stringify(data),
        adminId,
        adminEmail,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] })
      queryClient.invalidateQueries({ queryKey: ['announcements'] })
      setShowCreateAnnouncementModal(false)
      setNewAnnouncementTitle('')
      setNewAnnouncementContent('')
      setNewAnnouncementPriority(0)
      alert('Announcement created successfully!')
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to create announcement'
      alert(message)
    },
  })

  const { mutate: updateAnnouncement, isPending: isUpdatingAnnouncement } = useMutation({
    mutationFn: async (data: { id: string; title?: string; content?: string; priority?: number; is_active?: boolean }) => {
      const { adminId, adminEmail } = getAdminCredentials()
      const { id, ...updateData } = data
      return apiFetch<Announcement>(`/announcements/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData),
        adminId,
        adminEmail,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] })
      queryClient.invalidateQueries({ queryKey: ['announcements'] })
      setEditingAnnouncement(null)
      alert('Announcement updated successfully!')
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to update announcement'
      alert(message)
    },
  })

  const { mutate: deleteAnnouncement, isPending: isDeletingAnnouncement } = useMutation({
    mutationFn: async (announcementId: string) => {
      const { adminId, adminEmail } = getAdminCredentials()
      return apiFetch(`/announcements/${announcementId}`, {
        method: 'DELETE',
        adminId,
        adminEmail,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] })
      queryClient.invalidateQueries({ queryKey: ['announcements'] })
      alert('Announcement deleted successfully!')
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to delete announcement'
      alert(message)
    },
  })

  // Tags mutations
  const { mutate: renameTag, isPending: isRenamingTag } = useMutation({
    mutationFn: async (data: { old_tag: string; new_tag: string }) => {
      const { adminId, adminEmail } = getAdminCredentials()
      return apiFetch('/admin/tags/rename', {
        method: 'PUT',
        body: JSON.stringify(data),
        adminId,
        adminEmail,
      })
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tags'] })
      queryClient.invalidateQueries({ queryKey: ['posts'] })
      setShowRenameTagModal(false)
      setRenameOldTag('')
      setRenameNewTag('')
      alert(`Tag renamed successfully! Updated ${data.updated || 0} posts.`)
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to rename tag'
      alert(message)
    },
  })

  const { mutate: deleteTag, isPending: isDeletingTag } = useMutation({
    mutationFn: async (tagName: string) => {
      const { adminId, adminEmail } = getAdminCredentials()
      // URL encode the tag name
      const encodedTagName = encodeURIComponent(tagName)
      return apiFetch(`/admin/tags/${encodedTagName}`, {
        method: 'DELETE',
        adminId,
        adminEmail,
      })
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tags'] })
      queryClient.invalidateQueries({ queryKey: ['posts'] })
      alert(`Tag deleted successfully! Updated ${data.updated || 0} posts.`)
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to delete tag'
      alert(message)
    },
  })

  const { mutate: mergeTags, isPending: isMergingTags } = useMutation({
    mutationFn: async (data: { source_tags: string[]; target_tag: string }) => {
      const { adminId, adminEmail } = getAdminCredentials()
      return apiFetch('/admin/tags/merge', {
        method: 'POST',
        body: JSON.stringify(data),
        adminId,
        adminEmail,
      })
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tags'] })
      queryClient.invalidateQueries({ queryKey: ['posts'] })
      setShowMergeTagModal(false)
      setMergeSourceTags([])
      setMergeTargetTag('')
      alert(`Tags merged successfully! Updated ${data.updated || 0} posts.`)
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to merge tags'
      alert(message)
    },
  })

  const { mutate: createTag, isPending: isCreatingTag } = useMutation({
    mutationFn: async (data: { tag: string }) => {
      const { adminId, adminEmail } = getAdminCredentials()
      return apiFetch<Tag>('/admin/tags', {
        method: 'POST',
        body: JSON.stringify(data),
        adminId,
        adminEmail,
      })
    },
    onSuccess: (newTag) => {
      // Optimistically update the tags list
      queryClient.setQueryData(['admin', 'tags'], (oldData: Tag[] | undefined) => {
        if (!oldData) return [newTag]
        // Check if tag already exists
        const exists = oldData.some(t => t.tag === newTag.tag)
        if (exists) {
          // Update existing tag
          return oldData.map(t => t.tag === newTag.tag ? newTag : t)
        }
        // Add new tag and sort by count descending, then by tag name
        return [...oldData, newTag].sort((a, b) => {
          if (b.count !== a.count) return b.count - a.count
          return a.tag.localeCompare(b.tag)
        })
      })
      queryClient.invalidateQueries({ queryKey: ['admin', 'tags'] })
      setShowCreateTagModal(false)
      setNewTagName('')
      alert(`Tag "${newTag.tag}" created successfully!`)
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to create tag'
      alert(message)
    },
  })

  // User CRUD mutations
  const { mutate: createUser, isPending: isCreatingUser } = useMutation({
    mutationFn: async (data: { username: string; email: string; password: string }) => {
      const { adminId, adminEmail } = getAdminCredentials()
      return apiFetch<UserProfile>('/admin/users', {
        method: 'POST',
        body: JSON.stringify(data),
        adminId,
        adminEmail,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      setShowCreateUserModal(false)
      setNewUserUsername('')
      setNewUserEmail('')
      setNewUserPassword('')
      alert('User created successfully!')
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to create user'
      alert(message)
    },
  })

  const { mutate: updateUser, isPending: isUpdatingUser } = useMutation({
    mutationFn: async (data: { id: string; username?: string; email?: string; password?: string; total_points?: number }) => {
      const { adminId, adminEmail } = getAdminCredentials()
      const { id, ...updateData } = data
      return apiFetch<UserProfile>(`/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData),
        adminId,
        adminEmail,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      setShowEditUserModal(false)
      setEditingUser(null)
      setEditUserUsername('')
      setEditUserEmail('')
      setEditUserPassword('')
      setEditUserPoints(0)
      alert('User updated successfully!')
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to update user'
      alert(message)
    },
  })

  const { mutate: deleteUser, isPending: isDeletingUser } = useMutation({
    mutationFn: async (userId: string) => {
      const { adminId, adminEmail } = getAdminCredentials()
      return apiFetch(`/admin/users/${userId}`, {
        method: 'DELETE',
        adminId,
        adminEmail,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      alert('User deleted successfully!')
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to delete user'
      alert(message)
    },
  })

  const { mutate: reviewCreationRequest, isPending: isReviewingCreationRequest } = useMutation({
    mutationFn: async (data: { requestId: string; status: 'approved' | 'rejected'; rejectionReason?: string }) => {
      const { adminId, adminEmail } = getAdminCredentials()
      return apiFetch<LineGroupCreationRequest>(`/line-groups/creation-requests/${data.requestId}/review`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: data.status,
          rejection_reason: data.rejectionReason || undefined,
        }),
        adminId,
        adminEmail,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'creation-requests'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'groups'] })
      queryClient.invalidateQueries({ queryKey: ['line-groups'] })
      alert('Creation request reviewed successfully!')
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to review creation request'
      alert(message)
    },
  })

  const handleQrCodeFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    // 验证文件大小（最大 5MB）
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size should be less than 5MB')
      return
    }

    setQrCodeFile(file)

    // 创建预览
    const reader = new FileReader()
    reader.onloadend = () => {
      setQrCodePreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const uploadQrCodeToSupabase = async (file: File): Promise<string> => {
    setIsUploadingQrCode(true)
    try {
      // 生成唯一文件名
      const fileExt = file.name.split('.').pop()
      const adminId = localStorage.getItem('admin_id') || 'admin'
      const fileName = `${adminId}/${Date.now()}.${fileExt}`
      const filePath = `line-group-qr-codes/${fileName}`

      // 上传到 Supabase Storage
      const { error } = await supabase.storage
        .from('line-group-qr-codes')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) {
        if (error.message.includes('Bucket not found')) {
          throw new Error('Storage bucket not configured. Please contact administrator.')
        }
        throw error
      }

      // 获取公共 URL
      const { data: urlData } = supabase.storage
        .from('line-group-qr-codes')
        .getPublicUrl(filePath)

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get file URL')
      }

      return urlData.publicUrl
    } finally {
      setIsUploadingQrCode(false)
    }
  }

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newGroupName.trim()) {
      alert('Please provide group name')
      return
    }

    let qrCodeUrl = newGroupQrCode.trim()

    // 如果有上传的文件，先上传文件
    if (qrCodeFile) {
      try {
        qrCodeUrl = await uploadQrCodeToSupabase(qrCodeFile)
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Failed to upload QR code image')
        return
      }
    }

    if (!qrCodeUrl) {
      alert('Please upload a QR code image or provide a QR code URL')
      return
    }

    createGroup({
      name: newGroupName.trim(),
      description: newGroupDescription.trim() || undefined,
      qr_code_url: qrCodeUrl,
    })
  }

  // Set selected group when switching to applications - MUST be before early returns
  useEffect(() => {
    if (activeMenu === 'applications' && groups.length > 0 && !selectedGroup) {
      setSelectedGroup(groups[0].id)
    }
  }, [activeMenu, groups, selectedGroup])

  // Filter and sort users for Points/Ranking page - MUST be before early returns
  const filteredAndSortedUsers = useMemo(() => {
    if (!users) return []
    let filtered = users.filter(user => {
      const username = user.username || ''
      const email = user.email || ''
      const query = searchQuery.toLowerCase()
      return username.toLowerCase().includes(query) || email.toLowerCase().includes(query)
    })

    // Sort
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'points':
          return (b.total_points || 0) - (a.total_points || 0)
        case 'posts':
          // We don't have post count in UserProfile, so sort by points
          return (b.total_points || 0) - (a.total_points || 0)
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        default:
          return 0
      }
    })

    return filtered
  }, [users, searchQuery, sortBy])

  // Pagination - MUST be before early returns
  const totalPages = Math.ceil((filteredAndSortedUsers.length || 0) / pageSize)
  const paginatedUsers = filteredAndSortedUsers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  const handleMenuChange = (menuId: string) => {
    setActiveMenu(menuId as MenuType)
    setCurrentPage(1) // Reset to first page when changing menu
  }

  // Early returns - MUST be after all Hooks
  if (isAuthorized === null) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-primary/60">Checking permissions...</div>
      </div>
    )
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <p className="text-primary/70 mb-4">Access denied. Please login as admin.</p>
          <button
            onClick={() => navigate('/admin/login')}
            className="px-6 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-primary to-accent hover:shadow-lg transition"
          >
            Go to Admin Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <AdminLayout activeMenu={activeMenu} onMenuChange={handleMenuChange}>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Points/Ranking Page */}
        {activeMenu === 'points' && (
          <div>
            {/* Header */}
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-800 mb-2">Points</h1>
                <h2 className="text-3xl font-bold text-gray-900">Ranking</h2>
              </div>
              <button
                onClick={() => {
                  setNewUserUsername('')
                  setNewUserEmail('')
                  setNewUserPassword('')
                  setShowCreateUserModal(true)
                }}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-warm to-sun hover:shadow-lg transition"
              >
                + Create User
              </button>
            </div>

            {/* Search and Sort Controls */}
            <div className="p-6 border-b border-gray-200 flex items-center justify-between gap-4">
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setCurrentPage(1)
                    }}
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
              <div>
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value as typeof sortBy)
                    setCurrentPage(1)
                  }}
                  className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="newest">Sort by: Newest</option>
                  <option value="oldest">Sort by: Oldest</option>
                  <option value="points">Sort by: Points</option>
                  <option value="posts">Sort by: Posts</option>
                </select>
              </div>
            </div>

            {/* Table */}
            {usersLoading ? (
              <div className="p-8 text-center text-gray-500">Loading users…</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Use Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Ranking
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Posts
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Points
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Setting
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {paginatedUsers.map((user, index) => {
                        // 计算实际排名：如果按积分排序，排名应该基于所有用户中的位置
                        // 否则使用页面索引
                        let ranking: number
                        if (sortBy === 'points') {
                          // 按积分排序时，计算在所有已排序用户中的排名
                          const allSortedUsers = filteredAndSortedUsers
                          const userIndex = allSortedUsers.findIndex(u => u.id === user.id)
                          ranking = userIndex >= 0 ? userIndex + 1 : (currentPage - 1) * pageSize + index + 1
                        } else {
                          // 其他排序方式使用页面索引
                          ranking = (currentPage - 1) * pageSize + index + 1
                        }
                        return (
                          <tr key={user.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="font-semibold text-gray-900">{user.username || 'Anonymous'}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-gray-900 font-medium">{ranking}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-gray-600">0</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-gray-600 text-sm">{user.email || 'N/A'}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-gray-900 font-semibold">{user.total_points || 0}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    if (confirm(`Are you sure you want to delete user "${user.username || user.email}"?`)) {
                                      deleteUser(user.id)
                                    }
                                  }}
                                  disabled={isDeletingUser}
                                  className="px-3 py-1.5 bg-red-500 text-white text-xs font-semibold rounded hover:bg-red-600 transition disabled:opacity-50"
                                >
                                  Delete
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingUser(user)
                                    setEditUserUsername(user.username || '')
                                    setEditUserEmail(user.email || '')
                                    setEditUserPassword('')
                                    setEditUserPoints(user.total_points || 0)
                                    setShowEditUserModal(true)
                                  }}
                                  className="px-3 py-1.5 bg-green-500 text-white text-xs font-semibold rounded hover:bg-green-600 transition"
                                >
                                  Edit
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="p-6 border-t border-gray-200 flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    Showing data {paginatedUsers.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
                    {Math.min(currentPage * pageSize, filteredAndSortedUsers.length)} of {filteredAndSortedUsers.length} entries
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 rounded border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ←
                    </button>
                    {Array.from({ length: Math.min(4, totalPages) }, (_, i) => {
                      let pageNum
                      if (totalPages <= 4) {
                        pageNum = i + 1
                      } else if (currentPage <= 2) {
                        pageNum = i + 1
                      } else if (currentPage >= totalPages - 1) {
                        pageNum = totalPages - 3 + i
                      } else {
                        pageNum = currentPage - 1 + i
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-1.5 rounded text-sm font-medium ${currentPage === pageNum
                            ? 'bg-blue-500 text-white'
                            : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                          {pageNum}
                        </button>
                      )
                    })}
                    {totalPages > 4 && currentPage < totalPages - 2 && (
                      <span className="px-2 text-gray-500">...</span>
                    )}
                    {totalPages > 4 && (
                      <button
                        onClick={() => setCurrentPage(totalPages)}
                        className={`px-3 py-1.5 rounded text-sm font-medium ${currentPage === totalPages
                          ? 'bg-blue-500 text-white'
                          : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                      >
                        {totalPages}
                      </button>
                    )}
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1.5 rounded border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      →
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Overview */}
        {activeMenu === 'overview' && (
          <div className="space-y-6">
            {statsLoading ? (
              <div className="text-center py-12 text-primary/60">Loading statistics…</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl p-6 border border-primary/10 shadow-sm">
                  <div className="text-sm text-primary/60 mb-2">Total Users</div>
                  <div className="text-3xl font-bold text-primary">{stats?.total_users ?? 0}</div>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-primary/10 shadow-sm">
                  <div className="text-sm text-primary/60 mb-2">Total Posts</div>
                  <div className="text-3xl font-bold text-primary">{stats?.total_posts ?? 0}</div>
                </div>
              </div>
            )}

            {/* Weekly Charts */}
            {weeklyStatsLoading ? (
              <div className="text-center py-12 text-primary/60">Loading weekly statistics…</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Weekly New Users Chart */}
                <div className="bg-white rounded-2xl p-6 border border-primary/10 shadow-sm">
                  <h3 className="text-lg font-semibold text-primary mb-4">Weekly New Users</h3>
                  {weeklyStats?.weekly_data && weeklyStats.weekly_data.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={weeklyStats.weekly_data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                        <XAxis
                          dataKey="week"
                          stroke="#666"
                          style={{ fontSize: '12px' }}
                        />
                        <YAxis
                          stroke="#666"
                          style={{ fontSize: '12px' }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#fff',
                            border: '1px solid #e0e0e0',
                            borderRadius: '8px'
                          }}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="new_users"
                          stroke="#ff7473"
                          strokeWidth={2}
                          name="New Users"
                          dot={{ fill: '#ff7473', r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center py-12 text-primary/60">No data available</div>
                  )}
                </div>

                {/* Weekly New Posts Chart */}
                <div className="bg-white rounded-2xl p-6 border border-primary/10 shadow-sm">
                  <h3 className="text-lg font-semibold text-primary mb-4">Weekly New Posts</h3>
                  {weeklyStats?.weekly_data && weeklyStats.weekly_data.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={weeklyStats.weekly_data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                        <XAxis
                          dataKey="week"
                          stroke="#666"
                          style={{ fontSize: '12px' }}
                        />
                        <YAxis
                          stroke="#666"
                          style={{ fontSize: '12px' }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#fff',
                            border: '1px solid #e0e0e0',
                            borderRadius: '8px'
                          }}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="new_posts"
                          stroke="#47b8e0"
                          strokeWidth={2}
                          name="New Posts"
                          dot={{ fill: '#47b8e0', r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center py-12 text-primary/60">No data available</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Users */}
        {activeMenu === 'users' && (
          <div className="bg-white rounded-2xl border border-primary/10 shadow-sm">
            <div className="p-6 border-b border-primary/10 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-primary">User Management</h2>
                <p className="text-sm text-primary/70 mt-1">
                  Manage user accounts and permissions
                </p>
              </div>
              <button
                onClick={() => {
                  setNewUserUsername('')
                  setNewUserEmail('')
                  setNewUserPassword('')
                  setShowCreateUserModal(true)
                }}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-warm to-sun hover:shadow-lg transition"
              >
                + Create User
              </button>
            </div>
            {usersLoading ? (
              <div className="p-8 text-center text-primary/60">Loading users…</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-primary/5">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-primary/70 uppercase tracking-wider">
                        Username
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-primary/70 uppercase tracking-wider">
                        Email
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
                    {users?.map((user) => (
                      <tr key={user.id} className="hover:bg-primary/5 transition">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-semibold text-primary">{user.username || 'Anonymous'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-primary/70">{user.email || 'N/A'}</div>
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
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingUser(user)
                                setEditUserUsername(user.username || '')
                                setEditUserEmail(user.email || '')
                                setEditUserPassword('')
                                setEditUserPoints(user.total_points || 0)
                                setShowEditUserModal(true)
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-primary border border-primary/15 hover:bg-primary/5 transition"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete user "${user.username || user.email}"?`)) {
                                  deleteUser(user.id)
                                }
                              }}
                              disabled={isDeletingUser}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-warm border border-warm hover:bg-warm/10 transition disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Groups */}
        {activeMenu === 'groups' && (
          <div>
            <div className="p-6 border-b border-primary/10 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-primary">LINE Groups</h2>
                <p className="text-sm text-primary/70 mt-1">
                  Manage LINE groups and their settings
                </p>
              </div>
              <button
                onClick={() => {
                  setNewGroupName('')
                  setNewGroupDescription('')
                  setNewGroupQrCode('')
                  setQrCodeFile(null)
                  setQrCodePreview(null)
                  setShowCreateGroupModal(true)
                }}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-warm to-sun hover:shadow-lg transition"
              >
                + Create Group
              </button>
            </div>
            {groupsLoading ? (
              <div className="p-8 text-center text-primary/60">Loading groups…</div>
            ) : groups.length === 0 ? (
              <div className="p-8 text-center text-primary/60">No groups</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Group Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Manager
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Members
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {groups.map((group) => (
                      <tr key={group.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-semibold text-gray-900">{group.name}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-600 max-w-md truncate">
                            {group.description || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-600">
                            {group.manager?.username || 'Unknown'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-600">
                            {group.member_count || 0}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {group.is_active ? (
                            <span className="px-2 py-1 rounded-full text-xs font-semibold text-green-700 bg-green-100">
                              Active
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded-full text-xs font-semibold text-red-700 bg-red-100">
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-600">
                            {new Date(group.created_at).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                if (confirm('Are you sure you want to toggle this group?')) {
                                  updateGroup({
                                    groupId: group.id,
                                    updates: { is_active: !group.is_active },
                                  })
                                }
                              }}
                              className="px-3 py-1.5 bg-blue-500 text-white text-xs font-semibold rounded hover:bg-blue-600 transition"
                            >
                              {group.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this group? This cannot be undone.')) {
                                  deleteGroup(group.id)
                                }
                              }}
                              disabled={isDeletingGroup}
                              className="px-3 py-1.5 bg-red-500 text-white text-xs font-semibold rounded hover:bg-red-600 transition disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Create Group Modal */}
            {showCreateGroupModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl p-6 max-w-md w-full">
                  <h2 className="text-2xl font-bold text-primary mb-4">Create LINE Group</h2>
                  <form onSubmit={handleCreateGroup} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-primary mb-2">Group Name *</label>
                      <input
                        type="text"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        required
                        minLength={3}
                        placeholder="Enter group name"
                        className="w-full px-4 py-2.5 rounded-xl border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-primary mb-2">
                        Description (optional)
                      </label>
                      <textarea
                        value={newGroupDescription}
                        onChange={(e) => setNewGroupDescription(e.target.value)}
                        placeholder="Enter group description"
                        rows={3}
                        className="w-full px-4 py-2.5 rounded-xl border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-primary mb-2">
                        QR Code Image *
                      </label>

                      {/* 文件上传 */}
                      <div className="mb-3">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleQrCodeFileChange}
                          className="hidden"
                          id="admin-qr-code-upload"
                        />
                        <label
                          htmlFor="admin-qr-code-upload"
                          className="block w-full px-4 py-3 rounded-xl border-2 border-dashed border-primary/20 bg-primary/5 hover:border-accent hover:bg-accent/5 transition cursor-pointer text-center"
                        >
                          {qrCodeFile ? (
                            <span className="text-accent font-semibold">✓ {qrCodeFile.name}</span>
                          ) : (
                            <span className="text-primary/70">
                              📷 Click to upload QR code image
                            </span>
                          )}
                        </label>
                        {qrCodePreview && (
                          <div className="mt-3">
                            <img
                              src={qrCodePreview}
                              alt="QR Code Preview"
                              className="w-32 h-32 mx-auto rounded-lg border border-primary/10 cursor-pointer hover:opacity-80 transition object-cover"
                              onClick={() => setShowQrCodePreviewModal(true)}
                              title="Click to view full size"
                            />
                            <p className="text-xs text-primary/60 text-center mt-2">Click image to view full size</p>
                          </div>
                        )}
                      </div>

                      {/* 或者输入 URL（可选） */}
                      <div className="mt-3">
                        <p className="text-xs text-primary/60 mb-2">Or provide QR code URL:</p>
                        <input
                          type="url"
                          value={newGroupQrCode}
                          onChange={(e) => setNewGroupQrCode(e.target.value)}
                          placeholder="https://example.com/qr-code.png"
                          className="w-full px-4 py-2.5 rounded-xl border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
                        />
                      </div>

                      <p className="text-xs text-primary/60 mt-2">
                        Upload an image file (max 5MB) or provide a URL to your LINE group QR code
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="submit"
                        disabled={isCreatingGroup || isUploadingQrCode || !newGroupName.trim() || (!qrCodeFile && !newGroupQrCode.trim())}
                        className="flex-1 px-6 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-accent to-primary hover:shadow-lg transition disabled:opacity-50"
                      >
                        {isUploadingQrCode ? 'Uploading...' : isCreatingGroup ? 'Creating...' : 'Create Group'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateGroupModal(false)
                          setNewGroupName('')
                          setNewGroupDescription('')
                          setNewGroupQrCode('')
                          setQrCodeFile(null)
                          setQrCodePreview(null)
                          setShowQrCodePreviewModal(false)
                          if (fileInputRef.current) {
                            fileInputRef.current.value = ''
                          }
                        }}
                        className="px-6 py-2.5 rounded-xl font-semibold text-primary border border-primary/15 hover:bg-primary/5 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Applications */}
        {activeMenu === 'applications' && (
          <div>
            <div className="mb-6">
              <label className="block text-sm font-semibold text-primary mb-3">Select Group</label>
              {groupsLoading ? (
                <div className="text-center py-8 text-primary/60">Loading groups…</div>
              ) : groups.length === 0 ? (
                <div className="text-center py-8 text-primary/60">No groups available</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Group Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Description
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Manager
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Members
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Pending Applications
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Select
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {groups.map((group) => {
                        const pendingCount = allGroupsApplications[group.id] || 0
                        return (
                          <tr
                            key={group.id}
                            className={`hover:bg-gray-50 cursor-pointer ${selectedGroup === group.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                              }`}
                            onClick={() => setSelectedGroup(group.id)}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="font-semibold text-gray-900">{group.name}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-600 max-w-md truncate">
                                {group.description || '-'}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm text-gray-600">
                                {group.manager?.username || 'Unknown'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm text-gray-600">
                                {group.member_count || 0}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {group.is_active ? (
                                <span className="px-2 py-1 rounded-full text-xs font-semibold text-green-700 bg-green-100">
                                  Active
                                </span>
                              ) : (
                                <span className="px-2 py-1 rounded-full text-xs font-semibold text-red-700 bg-red-100">
                                  Inactive
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {pendingCount > 0 ? (
                                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
                                  {pendingCount} Pending
                                </span>
                              ) : (
                                <span className="text-gray-400 text-sm">0</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {selectedGroup === group.id ? (
                                <span className="px-3 py-1 rounded-full text-xs font-semibold text-blue-700 bg-blue-100">
                                  Selected
                                </span>
                              ) : (
                                <span className="text-gray-400 text-sm">Click to select</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {applicationsLoading ? (
              <div className="text-center py-12 text-primary/60">Loading applications…</div>
            ) : selectedGroup ? (
              <div className="bg-white rounded-2xl border border-primary/10 shadow-sm">
                <div className="p-6 border-b border-primary/10">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-primary">Group Applications</h2>
                    {applications.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-primary/70">
                          Total: {applications.length}
                        </span>
                        {applications.filter(app => app.status === 'pending').length > 0 && (
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
                            {applications.filter(app => app.status === 'pending').length} Pending
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          User
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Message
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Applied
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {applications.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-primary/60">
                            No applications for this group
                          </td>
                        </tr>
                      ) : (
                        applications.map((app) => (
                          <tr key={app.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="font-semibold text-gray-900">
                                {app.user?.username || 'Unknown User'}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-600 max-w-md truncate">
                                {app.message || '-'}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-semibold ${app.status === 'approved'
                                  ? 'bg-green-100 text-green-700'
                                  : app.status === 'rejected'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-yellow-100 text-yellow-700'
                                  }`}
                              >
                                {app.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm text-gray-600">
                                {new Date(app.created_at).toLocaleDateString()}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {app.status === 'pending' ? (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => reviewApplication({ applicationId: app.id, status: 'approved' })}
                                    disabled={isReviewing}
                                    className="px-3 py-1.5 bg-green-500 text-white text-xs font-semibold rounded hover:bg-green-600 transition disabled:opacity-50"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => reviewApplication({ applicationId: app.id, status: 'rejected' })}
                                    disabled={isReviewing}
                                    className="px-3 py-1.5 bg-red-500 text-white text-xs font-semibold rounded hover:bg-red-600 transition disabled:opacity-50"
                                  >
                                    Reject
                                  </button>
                                </div>
                              ) : (
                                <span className="text-gray-400 text-sm">-</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-8 text-center border border-primary/10">
                <p className="text-primary/70">Please select a group to view applications</p>
              </div>
            )}
          </div>
        )}

        {/* Reports */}
        {activeMenu === 'reports' && (
          <div className="bg-white rounded-2xl border border-primary/10 shadow-sm">
            <div className="p-6 border-b border-primary/10">
              <h2 className="text-xl font-bold text-primary">Group Reports</h2>
            </div>
            {reportsLoading ? (
              <div className="p-8 text-center text-primary/60">Loading reports…</div>
            ) : (
              <div className="divide-y divide-primary/5">
                {reports.length === 0 ? (
                  <div className="p-8 text-center text-primary/60">No reports</div>
                ) : (
                  reports.map((report) => (
                    <div key={report.id} className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="font-semibold text-primary mb-1">
                            Report for: {report.group?.name || 'Unknown Group'}
                          </div>
                          <div className="text-sm text-primary/70 mb-2">
                            <strong>Reason:</strong> {report.reason}
                          </div>
                          {report.description && (
                            <p className="text-sm text-primary/70 mb-2">{report.description}</p>
                          )}
                          <div className="text-xs text-primary/60">
                            Reported by {report.reporter?.username || 'Unknown'} on{' '}
                            {new Date(report.created_at).toLocaleString()}
                          </div>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${report.status === 'resolved'
                            ? 'bg-green-100 text-green-700'
                            : report.status === 'dismissed'
                              ? 'bg-warm/20 text-warm'
                              : 'bg-primary/10 text-primary'
                            }`}
                        >
                          {report.status}
                        </span>
                      </div>
                      {report.status === 'pending' && (
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => reviewReport({ reportId: report.id, status: 'approved' })}
                            disabled={isReviewingReport}
                            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition disabled:opacity-50"
                          >
                            Resolve
                          </button>
                          <button
                            onClick={() => reviewReport({ reportId: report.id, status: 'rejected' })}
                            disabled={isReviewingReport}
                            className="px-4 py-2 rounded-lg text-sm font-semibold text-warm border border-warm hover:bg-warm/10 transition disabled:opacity-50"
                          >
                            Dismiss
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Creation Requests */}
        {activeMenu === 'creation-requests' && (
          <div className="bg-white rounded-2xl border border-primary/10 shadow-sm">
            <div className="p-6 border-b border-primary/10">
              <h2 className="text-xl font-bold text-primary">Group Creation Requests</h2>
              <p className="text-sm text-primary/70 mt-1">
                Review requests from users to create new LINE groups
              </p>
            </div>
            {creationRequestsLoading ? (
              <div className="p-8 text-center text-primary/60">Loading requests…</div>
            ) : creationRequests.length === 0 ? (
              <div className="p-8 text-center text-primary/60">No creation requests</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Group Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        QR Code URL
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Requester
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {creationRequests.map((request) => (
                      <tr key={request.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-semibold text-gray-900">{request.name}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-600 max-w-md truncate">
                            {request.description || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <a
                            href={request.qr_code_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-accent hover:underline max-w-xs truncate block"
                            title={request.qr_code_url}
                          >
                            {request.qr_code_url}
                          </a>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${request.is_private
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-blue-100 text-blue-700'
                              }`}
                          >
                            {request.is_private ? '🔒 Private' : '🌐 Public'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-600">
                            {request.requester?.username || 'Unknown'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${request.status === 'approved'
                              ? 'bg-green-100 text-green-700'
                              : request.status === 'rejected'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-yellow-100 text-yellow-700'
                              }`}
                          >
                            {request.status}
                          </span>
                          {request.rejection_reason && (
                            <div className="text-xs text-red-600 mt-1 max-w-xs truncate" title={request.rejection_reason}>
                              {request.rejection_reason}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-600">
                            {new Date(request.created_at).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {request.status === 'pending' ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => reviewCreationRequest({ requestId: request.id, status: 'approved' })}
                                disabled={isReviewingCreationRequest}
                                className="px-3 py-1.5 bg-green-500 text-white text-xs font-semibold rounded hover:bg-green-600 transition disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => {
                                  const reason = prompt('Please provide a reason for rejection (optional):')
                                  if (reason !== null) {
                                    reviewCreationRequest({
                                      requestId: request.id,
                                      status: 'rejected',
                                      rejectionReason: reason.trim() || undefined,
                                    })
                                  }
                                }}
                                disabled={isReviewingCreationRequest}
                                className="px-3 py-1.5 bg-red-500 text-white text-xs font-semibold rounded hover:bg-red-600 transition disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Announcements */}
        {activeMenu === 'announcements' && (
          <div className="bg-white rounded-2xl border border-primary/10 shadow-sm">
            <div className="p-6 border-b border-primary/10 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-primary">Announcements</h2>
                <p className="text-sm text-primary/70 mt-1">
                  Manage community announcements and updates
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingAnnouncement(null)
                  setNewAnnouncementTitle('')
                  setNewAnnouncementContent('')
                  setNewAnnouncementPriority(0)
                  setShowCreateAnnouncementModal(true)
                }}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-warm to-sun hover:shadow-lg transition"
              >
                + Create Announcement
              </button>
            </div>
            {announcementsLoading ? (
              <div className="p-8 text-center text-primary/60">Loading announcements…</div>
            ) : announcements.length === 0 ? (
              <div className="p-8 text-center text-primary/60">No announcements</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Title
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Content
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Priority
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Author
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {announcements.map((announcement) => (
                      <tr key={announcement.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-semibold text-gray-900">{announcement.title}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-600 max-w-md truncate">
                            {announcement.content}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {announcement.is_active ? (
                            <span className="px-2 py-1 rounded-full text-xs font-semibold text-green-700 bg-green-100">
                              Active
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded-full text-xs font-semibold text-primary/40 bg-primary/10">
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {announcement.priority > 0 ? (
                            <span className="px-2 py-1 rounded-full text-xs font-semibold text-warm bg-warm/10">
                              {announcement.priority}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-sm">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-600">
                            {announcement.author?.username || 'Admin'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-600">
                            {new Date(announcement.created_at).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setEditingAnnouncement(announcement)
                                setNewAnnouncementTitle(announcement.title)
                                setNewAnnouncementContent(announcement.content)
                                setNewAnnouncementPriority(announcement.priority)
                                setShowCreateAnnouncementModal(true)
                              }}
                              className="px-3 py-1.5 bg-green-500 text-white text-xs font-semibold rounded hover:bg-green-600 transition"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this announcement?')) {
                                  deleteAnnouncement(announcement.id)
                                }
                              }}
                              disabled={isDeletingAnnouncement}
                              className="px-3 py-1.5 bg-red-500 text-white text-xs font-semibold rounded hover:bg-red-600 transition disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tags Management */}
        {activeMenu === 'tags' && <TagsManagement />}

        {/* Posts Management */}
        {activeMenu === 'posts' && <PostsManagement />}

        {/* Rename Tag Modal */}
        {showRenameTagModal && (
          <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowRenameTagModal(false)
                setEditingTag(null)
              }
            }}
          >
            <div className="bg-white rounded-2xl p-6 max-w-md w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-primary">Rename Tag</h3>
                <button
                  onClick={() => {
                    setShowRenameTagModal(false)
                    setEditingTag(null)
                    setRenameOldTag('')
                    setRenameNewTag('')
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (renameOldTag && renameNewTag && renameOldTag !== renameNewTag) {
                    renameTag({ old_tag: renameOldTag, new_tag: renameNewTag })
                  }
                }}
              >
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-primary mb-2">
                    Old Tag Name
                  </label>
                  <input
                    type="text"
                    value={renameOldTag}
                    onChange={(e) => setRenameOldTag(e.target.value)}
                    disabled
                    className="w-full px-4 py-2 rounded-lg border border-primary/15 bg-gray-50 text-gray-600"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-primary mb-2">
                    New Tag Name
                  </label>
                  <input
                    type="text"
                    value={renameNewTag}
                    onChange={(e) => setRenameNewTag(e.target.value)}
                    required
                    minLength={1}
                    className="w-full px-4 py-2 rounded-lg border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
                    placeholder="Enter new tag name"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRenameTagModal(false)
                      setEditingTag(null)
                      setRenameOldTag('')
                      setRenameNewTag('')
                    }}
                    className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-primary border border-primary/15 hover:bg-primary/5 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isRenamingTag || !renameNewTag || renameOldTag === renameNewTag}
                    className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-warm to-sun hover:shadow-lg transition disabled:opacity-50"
                  >
                    {isRenamingTag ? 'Renaming...' : 'Rename Tag'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create Tag Modal */}
        {showCreateTagModal && (
          <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowCreateTagModal(false)
                setNewTagName('')
              }
            }}
          >
            <div className="bg-white rounded-2xl p-6 max-w-md w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-primary">Create New Tag</h3>
                <button
                  onClick={() => {
                    setShowCreateTagModal(false)
                    setNewTagName('')
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (newTagName && newTagName.trim()) {
                    createTag({ tag: newTagName.trim() })
                  }
                }}
              >
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-primary mb-2">
                    Tag Name
                  </label>
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    required
                    minLength={1}
                    maxLength={50}
                    className="w-full px-4 py-2 rounded-lg border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
                    placeholder="Enter tag name (letters, numbers, spaces, hyphens, underscores)"
                    pattern="[a-zA-Z0-9 _-]+"
                    title="Tag name can only contain letters, numbers, spaces, hyphens, and underscores"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    Tag name can only contain letters, numbers, spaces, hyphens, and underscores (max 50 characters).
                  </p>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateTagModal(false)
                      setNewTagName('')
                    }}
                    className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-primary border border-primary/15 hover:bg-primary/5 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingTag || !newTagName.trim()}
                    className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#1D4F91] hover:bg-[#1a4380] transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCreatingTag ? 'Creating...' : 'Create Tag'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Merge Tags Modal */}
        {showMergeTagModal && (
          <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowMergeTagModal(false)
                setMergeSourceTags([])
                setMergeTargetTag('')
              }
            }}
          >
            <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-primary">Merge Tags</h3>
                <button
                  onClick={() => {
                    setShowMergeTagModal(false)
                    setMergeSourceTags([])
                    setMergeTargetTag('')
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (mergeSourceTags.length > 0 && mergeTargetTag) {
                    mergeTags({ source_tags: mergeSourceTags, target_tag: mergeTargetTag })
                  }
                }}
              >
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-primary mb-2">
                    Source Tags (to merge from)
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {mergeSourceTags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 rounded text-sm font-semibold text-blue-700 bg-blue-100 flex items-center gap-1"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => {
                            setMergeSourceTags(mergeSourceTags.filter(t => t !== tag))
                          }}
                          className="text-blue-700 hover:text-blue-900"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value && !mergeSourceTags.includes(e.target.value)) {
                        setMergeSourceTags([...mergeSourceTags, e.target.value])
                      }
                    }}
                    className="w-full px-4 py-2 rounded-lg border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
                  >
                    <option value="">Select a tag to add...</option>
                    {Array.isArray(tags)
                      ? tags
                          .filter((tag: any) => !mergeSourceTags.includes(tag.tag))
                          .map((tag: any) => (
                            <option key={tag.tag} value={tag.tag}>
                              {tag.tag} ({tag.count} posts)
                            </option>
                          ))
                      : null}
                  </select>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-primary mb-2">
                    Target Tag (to merge into)
                  </label>
                  <input
                    type="text"
                    value={mergeTargetTag}
                    onChange={(e) => setMergeTargetTag(e.target.value)}
                    required
                    minLength={1}
                    className="w-full px-4 py-2 rounded-lg border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
                    placeholder="Enter target tag name"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMergeTagModal(false)
                      setMergeSourceTags([])
                      setMergeTargetTag('')
                    }}
                    className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-primary border border-primary/15 hover:bg-primary/5 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isMergingTags || mergeSourceTags.length === 0 || !mergeTargetTag}
                    className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-warm to-sun hover:shadow-lg transition disabled:opacity-50"
                  >
                    {isMergingTags ? 'Merging...' : 'Merge Tags'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create/Edit Announcement Modal */}
        {showCreateAnnouncementModal && (
          <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowCreateAnnouncementModal(false)
                setEditingAnnouncement(null)
              }
            }}
          >
            <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-primary">
                  {editingAnnouncement ? 'Edit Announcement' : 'Create Announcement'}
                </h3>
                <button
                  onClick={() => {
                    setShowCreateAnnouncementModal(false)
                    setEditingAnnouncement(null)
                  }}
                  className="text-primary/60 hover:text-primary"
                >
                  ✕
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (editingAnnouncement) {
                    updateAnnouncement({
                      id: editingAnnouncement.id,
                      title: newAnnouncementTitle.trim(),
                      content: newAnnouncementContent.trim(),
                      priority: newAnnouncementPriority,
                      is_active: editingAnnouncement.is_active,
                    })
                  } else {
                    createAnnouncement({
                      title: newAnnouncementTitle.trim(),
                      content: newAnnouncementContent.trim(),
                      priority: newAnnouncementPriority,
                      is_active: true,
                    })
                  }
                }}
              >
                <div className="space-y-4">
                  <div>
                    <label htmlFor="announcement-title" className="block text-sm font-semibold text-primary mb-2">
                      Title *
                    </label>
                    <input
                      id="announcement-title"
                      type="text"
                      value={newAnnouncementTitle}
                      onChange={(e) => setNewAnnouncementTitle(e.target.value)}
                      required
                      maxLength={200}
                      className="w-full px-4 py-2 rounded-lg border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
                      placeholder="Enter announcement title"
                    />
                  </div>
                  <div>
                    <label htmlFor="announcement-content" className="block text-sm font-semibold text-primary mb-2">
                      Content *
                    </label>
                    <textarea
                      id="announcement-content"
                      value={newAnnouncementContent}
                      onChange={(e) => setNewAnnouncementContent(e.target.value)}
                      required
                      rows={6}
                      maxLength={2000}
                      className="w-full px-4 py-2 rounded-lg border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition resize-none"
                      placeholder="Enter announcement content"
                    />
                    <p className="text-xs text-primary/60 mt-1">
                      {newAnnouncementContent.length}/2000 characters
                    </p>
                  </div>
                  <div>
                    <label htmlFor="announcement-priority" className="block text-sm font-semibold text-primary mb-2">
                      Priority (0-10, higher shows first)
                    </label>
                    <input
                      id="announcement-priority"
                      type="number"
                      min="0"
                      max="10"
                      value={newAnnouncementPriority}
                      onChange={(e) => setNewAnnouncementPriority(parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-2 rounded-lg border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
                    />
                  </div>
                  {editingAnnouncement && (
                    <div>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={editingAnnouncement.is_active}
                          onChange={(e) => {
                            setEditingAnnouncement({
                              ...editingAnnouncement,
                              is_active: e.target.checked,
                            })
                          }}
                          className="rounded border-primary/15"
                        />
                        <span className="text-sm font-semibold text-primary">Active</span>
                      </label>
                    </div>
                  )}
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    type="submit"
                    disabled={isCreatingAnnouncement || isUpdatingAnnouncement}
                    className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-warm to-sun hover:shadow-lg transition disabled:opacity-50"
                  >
                    {isCreatingAnnouncement || isUpdatingAnnouncement
                      ? 'Saving...'
                      : editingAnnouncement
                        ? 'Update Announcement'
                        : 'Create Announcement'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateAnnouncementModal(false)
                      setEditingAnnouncement(null)
                    }}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-primary border border-primary/15 hover:bg-primary/5 transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* QR Code Preview Modal */}
        {showQrCodePreviewModal && qrCodePreview && (
          <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
            onClick={() => setShowQrCodePreviewModal(false)}
          >
            <div className="bg-white rounded-2xl p-6 max-w-2xl w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-primary">QR Code Preview</h3>
                <button
                  onClick={() => setShowQrCodePreviewModal(false)}
                  className="text-primary/70 hover:text-primary transition text-2xl"
                >
                  ✕
                </button>
              </div>
              <img
                src={qrCodePreview}
                alt="QR Code Preview"
                className="w-full rounded-lg border border-primary/10"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        )}

        {/* Create User Modal */}
        {showCreateUserModal && (
          <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowCreateUserModal(false)
              }
            }}
          >
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-primary/10 flex items-center justify-between">
                <h3 className="text-lg font-bold text-primary">Create New User</h3>
                <button
                  onClick={() => {
                    setShowCreateUserModal(false)
                    setNewUserUsername('')
                    setNewUserEmail('')
                    setNewUserPassword('')
                  }}
                  className="text-primary/60 hover:text-primary"
                >
                  ✕
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!newUserUsername.trim() || !newUserEmail.trim() || !newUserPassword.trim()) {
                    alert('Please fill in all fields')
                    return
                  }
                  if (newUserPassword.length < 6) {
                    alert('Password must be at least 6 characters')
                    return
                  }
                  createUser({
                    username: newUserUsername.trim(),
                    email: newUserEmail.trim(),
                    password: newUserPassword,
                  })
                }}
                className="p-6 space-y-4"
              >
                <div>
                  <label htmlFor="new-username" className="block text-sm font-semibold text-primary mb-2">
                    Username *
                  </label>
                  <input
                    id="new-username"
                    type="text"
                    value={newUserUsername}
                    onChange={(e) => setNewUserUsername(e.target.value)}
                    required
                    maxLength={50}
                    className="w-full px-4 py-2 rounded-lg border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
                    placeholder="Enter username"
                  />
                </div>
                <div>
                  <label htmlFor="new-email" className="block text-sm font-semibold text-primary mb-2">
                    Email *
                  </label>
                  <input
                    id="new-email"
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    required
                    className="w-full px-4 py-2 rounded-lg border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
                    placeholder="Enter email"
                  />
                </div>
                <div>
                  <label htmlFor="new-password" className="block text-sm font-semibold text-primary mb-2">
                    Password *
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    required
                    minLength={6}
                    maxLength={72}
                    className="w-full px-4 py-2 rounded-lg border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
                    placeholder="Enter password (min 6 characters)"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateUserModal(false)
                      setNewUserUsername('')
                      setNewUserEmail('')
                      setNewUserPassword('')
                    }}
                    className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-primary border border-primary/15 hover:bg-primary/5 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingUser}
                    className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-warm to-sun hover:shadow-lg transition disabled:opacity-50"
                  >
                    {isCreatingUser ? 'Creating...' : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit User Modal */}
        {showEditUserModal && editingUser && (
          <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowEditUserModal(false)
                setEditingUser(null)
              }
            }}
          >
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-primary/10 flex items-center justify-between">
                <h3 className="text-lg font-bold text-primary">Edit User</h3>
                <button
                  onClick={() => {
                    setShowEditUserModal(false)
                    setEditingUser(null)
                    setEditUserUsername('')
                    setEditUserEmail('')
                    setEditUserPassword('')
                    setEditUserPoints(0)
                  }}
                  className="text-primary/60 hover:text-primary"
                >
                  ✕
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const updateData: { id: string; username?: string; email?: string; password?: string; total_points?: number } = {
                    id: editingUser.id,
                  }
                  if (editUserUsername.trim() && editUserUsername.trim() !== editingUser.username) {
                    updateData.username = editUserUsername.trim()
                  }
                  if (editUserEmail.trim() && editUserEmail.trim() !== editingUser.email) {
                    updateData.email = editUserEmail.trim()
                  }
                  if (editUserPassword.trim()) {
                    if (editUserPassword.length < 6) {
                      alert('Password must be at least 6 characters')
                      return
                    }
                    updateData.password = editUserPassword
                  }
                  if (editUserPoints !== (editingUser.total_points || 0)) {
                    updateData.total_points = editUserPoints
                  }
                  if (Object.keys(updateData).length === 1) {
                    alert('No changes to save')
                    return
                  }
                  updateUser(updateData)
                }}
                className="p-6 space-y-4"
              >
                <div>
                  <label htmlFor="edit-username" className="block text-sm font-semibold text-primary mb-2">
                    Username
                  </label>
                  <input
                    id="edit-username"
                    type="text"
                    value={editUserUsername}
                    onChange={(e) => setEditUserUsername(e.target.value)}
                    maxLength={50}
                    className="w-full px-4 py-2 rounded-lg border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
                    placeholder="Enter username"
                  />
                </div>
                <div>
                  <label htmlFor="edit-email" className="block text-sm font-semibold text-primary mb-2">
                    Email
                  </label>
                  <input
                    id="edit-email"
                    type="email"
                    value={editUserEmail}
                    onChange={(e) => setEditUserEmail(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
                    placeholder="Enter email"
                  />
                </div>
                <div>
                  <label htmlFor="edit-password" className="block text-sm font-semibold text-primary mb-2">
                    New Password (leave blank to keep current)
                  </label>
                  <input
                    id="edit-password"
                    type="password"
                    value={editUserPassword}
                    onChange={(e) => setEditUserPassword(e.target.value)}
                    minLength={6}
                    maxLength={72}
                    className="w-full px-4 py-2 rounded-lg border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
                    placeholder="Enter new password (min 6 characters)"
                  />
                </div>
                <div>
                  <label htmlFor="edit-points" className="block text-sm font-semibold text-primary mb-2">
                    Points
                  </label>
                  <input
                    id="edit-points"
                    type="number"
                    value={editUserPoints}
                    onChange={(e) => setEditUserPoints(parseInt(e.target.value) || 0)}
                    min={0}
                    className="w-full px-4 py-2 rounded-lg border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
                    placeholder="Enter points"
                  />
                  <p className="text-xs text-primary/60 mt-1">
                    Level will be automatically calculated (1 level per 100 points, max level 10)
                  </p>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditUserModal(false)
                      setEditingUser(null)
                      setEditUserUsername('')
                      setEditUserEmail('')
                      setEditUserPassword('')
                      setEditUserPoints(0)
                    }}
                    className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-primary border border-primary/15 hover:bg-primary/5 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdatingUser}
                    className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-warm to-sun hover:shadow-lg transition disabled:opacity-50"
                  >
                    {isUpdatingUser ? 'Updating...' : 'Update User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
