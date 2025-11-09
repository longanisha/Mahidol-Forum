import { useMemo, useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import { ThreadCard, type ThreadWithAuthor } from '../components/forum/ThreadCard'
import { useAuth } from '../context/AuthContext'
import { ForumSidebar } from '../components/forum/ForumSidebar'
import { ForumFilters } from '../components/forum/ForumFilters'

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

type PaginatedThreadsResponse = {
  items: ThreadWithAuthor[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

async function fetchThreads(
  page: number = 1,
  pageSize: number = 10,
  accessToken?: string | null,
  sortBy: string = 'latest',
  getAll: boolean = false, // 是否获取所有数据（用于搜索/tag过滤）
): Promise<PaginatedThreadsResponse> {
  // 如果需要获取所有数据（搜索/tag过滤），使用较大的page_size
  // 使用10000以确保获取足够多的数据（实际数据量通常不会超过这个数）
  const actualPageSize = getAll ? 10000 : pageSize
  const actualPage = getAll ? 1 : page
  const data = await apiFetch<PaginatedThreadsResponse>(
    `/posts/?page=${actualPage}&page_size=${actualPageSize}&sort_by=${sortBy}`,
    {
      accessToken: accessToken || undefined,
    },
  )
  return data
}

async function fetchAnnouncements(): Promise<Announcement[]> {
  return apiFetch<Announcement[]>('/announcements?active_only=true')
}

async function fetchLineGroups(): Promise<LineGroup[]> {
  return apiFetch<LineGroup[]>('/line-groups?active_only=true')
}

async function fetchMyCreationRequests(accessToken: string | null): Promise<LineGroupCreationRequest[]> {
  if (!accessToken) return []
  return apiFetch<LineGroupCreationRequest[]>('/line-groups/creation-requests', {
    accessToken,
  })
}

async function fetchMyApplications(accessToken: string | null): Promise<LineGroupApplication[]> {
  if (!accessToken) {
    return []
  }
  try {
    return await apiFetch<LineGroupApplication[]>('/line-groups/my-applications', {
      accessToken,
    })
  } catch (error) {
    console.error('[fetchMyApplications] Error fetching applications:', error)
    return []
  }
}

export function HomePage() {
  const { user, accessToken } = useAuth()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const viewMode = searchParams.get('view') || 'discussions' // 'discussions', 'announcements', or 'line-groups'
  
  // 从 URL 参数读取搜索和 tag 状态，确保不同页面的状态独立
  // 使用 viewMode 作为前缀来区分不同页面的状态
  const searchQuery = searchParams.get(`${viewMode}_search`) || ''
  const selectedTag = searchParams.get(`${viewMode}_tag`) || null
  
  // 分页状态（仅用于 discussions）
  const currentPage = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = 10
  
  // 排序状态（discussions 和 announcements 都有排序）
  const sortBy = searchParams.get(`${viewMode}_sort`) || 'latest' // 'latest', 'views', 'replies'
  
  // 更新搜索和 tag 的辅助函数
  const setSearchQuery = (query: string) => {
    setSearchParams((prev) => {
      if (query) {
        prev.set(`${viewMode}_search`, query)
      } else {
        prev.delete(`${viewMode}_search`)
      }
      prev.set('page', '1') // 重置到第一页
      return prev
    })
  }
  
  const setSelectedTag = (tag: string | null) => {
    setSearchParams((prev) => {
      if (tag) {
        prev.set(`${viewMode}_tag`, tag)
      } else {
        prev.delete(`${viewMode}_tag`)
      }
      prev.set('page', '1') // 重置到第一页
      return prev
    })
  }
  
  // LINE Groups specific state
  const [selectedGroup, setSelectedGroup] = useState<LineGroup | null>(null)
  const [showApplyModal, setShowApplyModal] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [showCreateRequestModal, setShowCreateRequestModal] = useState(false)
  const [applyMessage, setApplyMessage] = useState('')
  const [reportReason, setReportReason] = useState('')
  const [reportDescription, setReportDescription] = useState('')
  const [createRequestName, setCreateRequestName] = useState('')
  const [createRequestDescription, setCreateRequestDescription] = useState('')
  const [createRequestQrCodeUrl, setCreateRequestQrCodeUrl] = useState('')
  // 为了确保排序和过滤的一致性，始终获取所有数据（最多1000条）
  // 当有搜索或tag过滤时，使用固定的排序方式（latest）获取数据，然后在前端排序
  // 这样可以确保获取到相同的数据集，不会因为排序方式不同而获取到不同的数据
  const hasSearchOrTag = !!(searchQuery || selectedTag)
  const fetchSortBy = hasSearchOrTag ? 'latest' : sortBy // 有搜索/tag时，用latest获取数据，前端再排序
  
  const {
    data: threadsData,
    isLoading: threadsLoading,
    isError: threadsError,
    error: threadsErrorDetail,
  } = useQuery({
    queryKey: ['posts', 'all', fetchSortBy, accessToken, searchQuery, selectedTag],
    queryFn: () => fetchThreads(1, 1000, accessToken, fetchSortBy, true),
    enabled: viewMode === 'discussions' || viewMode === 'all',
    staleTime: 2 * 60 * 1000, // 2 minutes - threads 更新较频繁，缓存时间稍短
  })
  
  const threads = threadsData?.items || []
  const totalThreads = threadsData?.total || 0
  const totalPages = threadsData?.total_pages || 0

  const {
    data: announcements = [],
    isLoading: announcementsLoading,
    isError: announcementsError,
    error: announcementsErrorDetail,
  } = useQuery({
    queryKey: ['announcements'],
    queryFn: fetchAnnouncements,
    enabled: viewMode === 'announcements' || viewMode === 'all',
    staleTime: 5 * 60 * 1000, // 5 minutes - announcements 更新较少
  })

  const {
    data: lineGroups = [],
    isLoading: lineGroupsLoading,
    isError: lineGroupsError,
    error: lineGroupsErrorDetail,
  } = useQuery({
    queryKey: ['line-groups'],
    queryFn: fetchLineGroups,
    enabled: viewMode === 'line-groups' || viewMode === 'all',
    staleTime: 3 * 60 * 1000, // 3 minutes
  })

  const { data: myApplications = [] } = useQuery({
    queryKey: ['line-group-applications'],
    queryFn: () => fetchMyApplications(accessToken),
    enabled: (viewMode === 'line-groups' || viewMode === 'all') && !!user,
    staleTime: 1 * 60 * 1000, // 1 minute - 用户相关数据更新较频繁
  })

  const { data: myCreationRequests = [] } = useQuery({
    queryKey: ['line-group-creation-requests'],
    queryFn: () => fetchMyCreationRequests(accessToken),
    enabled: (viewMode === 'line-groups' || viewMode === 'all') && !!user,
    staleTime: 1 * 60 * 1000, // 1 minute
  })

  const safeThreads = threads ?? []
  
  // 将 announcements 转换为类似 thread 的格式以便显示（必须在其他使用它的 useMemo 之前定义）
  const announcementThreads = useMemo(() => {
    return (announcements || []).map((announcement): ThreadWithAuthor => ({
      id: announcement.id,
      title: announcement.title,
      category: 'Announcement',
      summary: announcement.content,
      cover_image_url: null,
      author_id: announcement.created_by,
      created_at: announcement.created_at,
      updated_at: announcement.updated_at,
      reply_count: 0,
      view_count: 0,
      upvote_count: 0,
      tags: null,
      is_closed: false,
      author: announcement.author ? {
        id: announcement.author.id,
        username: announcement.author.username,
        avatar_url: null,
      } : null,
    }))
  }, [announcements])
  
  const isLoading = viewMode === 'discussions' 
    ? threadsLoading 
    : viewMode === 'announcements' 
    ? announcementsLoading 
    : viewMode === 'line-groups'
    ? lineGroupsLoading
    : threadsLoading || announcementsLoading || lineGroupsLoading
  const isError = viewMode === 'discussions' 
    ? threadsError 
    : viewMode === 'announcements' 
    ? announcementsError 
    : viewMode === 'line-groups'
    ? lineGroupsError
    : threadsError || announcementsError || lineGroupsError
  const error = viewMode === 'discussions' 
    ? threadsErrorDetail 
    : viewMode === 'announcements' 
    ? announcementsErrorDetail 
    : viewMode === 'line-groups'
    ? lineGroupsErrorDetail
    : threadsErrorDetail || announcementsErrorDetail || lineGroupsErrorDetail

  // 计算标签及其引用次数（包含 discussions 和 announcements）
  const tagsWithCount = useMemo(() => {
    const tagCountMap = new Map<string, number>()
    
    // 初始化基础标签
    const baseTags = ['AI', 'ICT', 'Courses', 'Sports', 'Events', 'Digital Nomad', 'Thai']
    baseTags.forEach(tag => {
      tagCountMap.set(tag, 0)
    })
    
    // 统计 discussions 的标签
    safeThreads.forEach((thread) => {
      // 统计 category
      if (thread.category) {
        const count = tagCountMap.get(thread.category) || 0
        tagCountMap.set(thread.category, count + 1)
      }
      // 统计 tags 数组中的标签
      thread.tags?.forEach((tag) => {
        const count = tagCountMap.get(tag) || 0
        tagCountMap.set(tag, count + 1)
      })
    })
    
    // 统计 announcements 的标签
    announcementThreads.forEach((announcement) => {
      // 统计 category
      if (announcement.category) {
        const count = tagCountMap.get(announcement.category) || 0
        tagCountMap.set(announcement.category, count + 1)
      }
      // 统计 tags 数组中的标签
      announcement.tags?.forEach((tag) => {
        const count = tagCountMap.get(tag) || 0
        tagCountMap.set(tag, count + 1)
      })
    })
    
    // 转换为数组并按引用次数排序
    return Array.from(tagCountMap.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
  }, [safeThreads, announcementThreads])

  // 获取所有标签（按引用次数排序）
  const tags = useMemo(() => {
    return tagsWithCount.map(item => item.tag)
  }, [tagsWithCount])

  // 获取前5个最热门的标签
  const top5HotTags = useMemo(() => {
    return new Set(tagsWithCount.slice(0, 5).map(item => item.tag))
  }, [tagsWithCount])

  // LINE Groups mutations
  const { mutate: applyToGroup, isPending: isApplying } = useMutation({
    mutationFn: async (data: { groupId: string; message?: string }) => {
      if (!accessToken) throw new Error('Please login to apply')
      return apiFetch<LineGroupApplication>(`/line-groups/${data.groupId}/apply`, {
        method: 'POST',
        body: JSON.stringify({ group_id: data.groupId, message: data.message }),
        accessToken,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['line-groups'] })
      queryClient.invalidateQueries({ queryKey: ['line-group-applications'] })
      setShowApplyModal(false)
      setApplyMessage('')
      setSelectedGroup(null)
      alert('Application submitted! The group manager will review your request.')
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to submit application'
      alert(message)
    },
  })

  const { mutate: reportGroup, isPending: isReporting } = useMutation({
    mutationFn: async (data: { groupId: string; reason: string; description?: string }) => {
      if (!accessToken) throw new Error('Please login to report')
      return apiFetch(`/line-groups/${data.groupId}/report`, {
        method: 'POST',
        body: JSON.stringify({
          group_id: data.groupId,
          reason: data.reason,
          description: data.description,
        }),
        accessToken,
      })
    },
    onSuccess: () => {
      setShowReportModal(false)
      setReportReason('')
      setReportDescription('')
      setSelectedGroup(null)
      alert('Report submitted! Admin will review it.')
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to submit report'
      alert(message)
    },
  })

  const { mutate: createGroupRequest, isPending: isCreatingRequest } = useMutation({
    mutationFn: async (data: { name: string; description?: string; qr_code_url: string }) => {
      if (!accessToken) throw new Error('Please login to create a request')
      return apiFetch<LineGroupCreationRequest>('/line-groups/creation-requests', {
        method: 'POST',
        body: JSON.stringify(data),
        accessToken,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['line-group-creation-requests'] })
      setShowCreateRequestModal(false)
      setCreateRequestName('')
      setCreateRequestDescription('')
      setCreateRequestQrCodeUrl('')
      alert('Request submitted! Admin will review your request.')
    },
    onError: (error: unknown) => {
      let message = 'Failed to submit request'
      if (error instanceof Error) {
        message = error.message
      } else if (typeof error === 'object' && error !== null) {
        const errorObj = error as { message?: string; detail?: string }
        message = errorObj.message || errorObj.detail || message
      }
      alert(`Failed to submit request: ${message}`)
    },
  })

  const handleApply = (group: LineGroup) => {
    if (!user) {
      alert('Please login to apply for a group')
      return
    }
    setSelectedGroup(group)
    setShowApplyModal(true)
  }

  const handleReport = (group: LineGroup) => {
    if (!user) {
      alert('Please login to report a group')
      return
    }
    setSelectedGroup(group)
    setShowReportModal(true)
  }

  const handleSubmitApply = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedGroup) return
    applyToGroup({
      groupId: selectedGroup.id,
      message: applyMessage.trim() || undefined,
    })
  }

  const handleSubmitReport = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedGroup || !reportReason.trim()) {
      alert('Please provide a reason for reporting')
      return
    }
    reportGroup({
      groupId: selectedGroup.id,
      reason: reportReason.trim(),
      description: reportDescription.trim() || undefined,
    })
  }

  const handleSubmitCreateRequest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    if (!createRequestName.trim()) {
      alert('Please provide group name')
      return
    }

    if (!user || !accessToken) {
      alert('Please login to create a request')
      return
    }

    const qrCodeUrl = createRequestQrCodeUrl.trim()

    if (!qrCodeUrl) {
      alert('Please provide a QR code image URL')
      return
    }

    try {
      new URL(qrCodeUrl)
    } catch {
      alert('Please provide a valid URL (e.g., https://example.com/qr-code.png)')
      return
    }

    createGroupRequest({
      name: createRequestName.trim(),
      description: createRequestDescription.trim() || undefined,
      qr_code_url: qrCodeUrl,
    })
  }

  // 将 LINE groups 转换为类似 thread 的格式以便显示（用于 'all' 视图）
  const lineGroupThreads = useMemo(() => {
    return lineGroups.map((group): ThreadWithAuthor => ({
      id: group.id,
      title: group.name,
      category: 'LINE Group',
      summary: group.description || `Join this LINE group with ${group.member_count} members`,
      cover_image_url: group.qr_code_url || null,
      author_id: group.manager_id,
      created_at: group.created_at,
      updated_at: group.updated_at,
      reply_count: group.member_count,
      view_count: 0,
      upvote_count: 0,
      tags: null,
      is_closed: !group.is_active,
      author: group.manager ? {
        id: group.manager.id,
        username: group.manager.username,
        avatar_url: group.manager.avatar_url,
      } : null,
    }))
  }, [lineGroups])

  // 根据 viewMode 决定显示的内容
  // 注意：discussions 现在使用后端分页，不需要前端过滤
  const allItems = useMemo(() => {
    if (viewMode === 'discussions') {
      // discussions 使用后端分页，直接返回当前页的数据
      return safeThreads
    } else if (viewMode === 'announcements') {
      return announcementThreads
    } else if (viewMode === 'line-groups') {
      return lineGroupThreads
    } else {
      // 'all' - 合并显示，announcements 在前，然后是 line groups，最后是 threads
      return [...announcementThreads, ...lineGroupThreads, ...safeThreads]
    }
  }, [viewMode, safeThreads, announcementThreads, lineGroupThreads])

  // 对于 discussions，统一在前端进行过滤、排序和分页
  // 对于其他视图，仍然需要前端过滤
  const filteredItems = useMemo(() => {
    let filtered: ThreadWithAuthor[] = []
    
    if (viewMode === 'discussions') {
      // 先进行搜索和tag过滤
      filtered = safeThreads.filter((item) => {
        const matchesSearch =
          !searchQuery ||
          item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.summary ?? '').toLowerCase().includes(searchQuery.toLowerCase())
        const allTags = [
          item.category,
          ...(item.tags ?? []),
          ...(item.summary ? item.summary.split(' ') : []),
        ]
          .filter(Boolean)
          .map((tag) => (tag as string).toLowerCase())
        const matchesTag = !selectedTag || allTags.includes(selectedTag.toLowerCase())
        return matchesSearch && matchesTag
      })
      
      // 对所有过滤后的结果进行排序
      filtered = [...filtered].sort((a, b) => {
        // 置顶的在前
        if (a.is_pinned && !b.is_pinned) return -1
        if (!a.is_pinned && b.is_pinned) return 1
        
        // 根据排序方式排序
        if (sortBy === 'views') {
          // 按浏览数降序，如果相同则按时间新到旧
          const viewsDiff = (b.view_count ?? 0) - (a.view_count ?? 0)
          if (viewsDiff !== 0) return viewsDiff
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        } else if (sortBy === 'replies') {
          // 按评论数降序，如果相同则按时间新到旧
          const repliesDiff = (b.reply_count ?? 0) - (a.reply_count ?? 0)
          if (repliesDiff !== 0) return repliesDiff
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        } else {
          // latest - 按创建时间降序（从新到旧）
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        }
      })
    } else if (viewMode === 'announcements') {
      // Announcements 视图：应用搜索和 tag 过滤，然后排序
      filtered = announcementThreads.filter((item) => {
        const matchesSearch =
          !searchQuery ||
          item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.summary ?? '').toLowerCase().includes(searchQuery.toLowerCase())
        const allTags = [
          item.category,
          ...(item.tags ?? []),
          ...(item.summary ? item.summary.split(' ') : []),
        ]
          .filter(Boolean)
          .map((tag) => (tag as string).toLowerCase())
        const matchesTag = !selectedTag || allTags.includes(selectedTag.toLowerCase())
        return matchesSearch && matchesTag
      })
      
      // 对 Announcements 进行排序
      filtered = [...filtered].sort((a, b) => {
        // 置顶的在前
        if (a.is_pinned && !b.is_pinned) return -1
        if (!a.is_pinned && b.is_pinned) return 1
        
        // 根据排序方式排序
        if (sortBy === 'views') {
          // 按浏览数降序，如果相同则按时间新到旧
          const viewsDiff = (b.view_count ?? 0) - (a.view_count ?? 0)
          if (viewsDiff !== 0) return viewsDiff
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        } else if (sortBy === 'replies') {
          // 按评论数降序，如果相同则按时间新到旧
          const repliesDiff = (b.reply_count ?? 0) - (a.reply_count ?? 0)
          if (repliesDiff !== 0) return repliesDiff
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        } else {
          // latest - 按创建时间降序（从新到旧）
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        }
      })
    } else {
      // 其他视图（如 line-groups）保持原有逻辑
      filtered = allItems.filter((item) => {
        const matchesSearch =
          !searchQuery ||
          item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.summary ?? '').toLowerCase().includes(searchQuery.toLowerCase())
        const allTags = [
          item.category,
          ...(item.tags ?? []),
          ...(item.summary ? item.summary.split(' ') : []),
        ]
          .filter(Boolean)
          .map((tag) => (tag as string).toLowerCase())
        const matchesTag = !selectedTag || allTags.includes(selectedTag.toLowerCase())
        return matchesSearch && matchesTag
      })
      
      // 其他视图也需要排序
      filtered = [...filtered].sort((a, b) => {
        // 置顶的在前
        if (a.is_pinned && !b.is_pinned) return -1
        if (!a.is_pinned && b.is_pinned) return 1
        
        // 根据排序方式排序
        if (sortBy === 'views') {
          return (b.view_count ?? 0) - (a.view_count ?? 0)
        } else if (sortBy === 'replies') {
          return (b.reply_count ?? 0) - (a.reply_count ?? 0)
        } else {
          // latest - 按创建时间降序
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        }
      })
    }
    
    return filtered
  }, [viewMode, allItems, safeThreads, announcementThreads, searchQuery, selectedTag, sortBy])

  return (
    <div className="min-h-screen bg-muted">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-6">
          <ForumSidebar 
            totalThreads={safeThreads.length} 
            onSelectMenu={(section) => {
              if (section === 'discussions') {
                setSearchParams({ view: 'discussions' })
              } else if (section === 'announcements') {
                setSearchParams({ view: 'announcements' })
              } else if (section === 'line-group') {
                setSearchParams({ view: 'line-groups' })
              }
            }}
          />

          <section className="flex-1 min-w-0">
            <header className="mb-6">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <p className="text-xs font-semibold text-accent uppercase tracking-wider mb-2">
                    Mahidol Campus Community
                  </p>
                  <h1 className="text-3xl font-bold text-primary mb-2">
                    {viewMode === 'announcements' 
                      ? 'Announcements' 
                      : viewMode === 'line-groups'
                      ? 'LINE Groups'
                      : viewMode === 'all' 
                      ? 'Discussions & Announcements' 
                      : 'Discussions'}
                  </h1>
                  <p className="text-primary/70">
                    {viewMode === 'announcements' 
                      ? 'Official announcements and updates from administrators'
                      : viewMode === 'line-groups'
                      ? 'Join LINE groups and communities to connect with fellow students and alumni'
                      : viewMode === 'all'
                      ? 'Fresh updates from students, staff, and alumni — filter by tag or search to find the insight you need.'
                      : 'Fresh updates from students, staff, and alumni — filter by tag or search to find the insight you need.'}
                  </p>
                </div>
                {viewMode === 'line-groups' ? (
                  user && (
                    <button
                      onClick={() => setShowCreateRequestModal(true)}
                      className="px-6 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-accent to-primary hover:shadow-lg transition shrink-0"
                    >
                      + Create Group Request
                    </button>
                  )
                ) : user ? (
                  <Link
                    to="/create-thread"
                    className="px-5 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-warm to-sun hover:shadow-lg transition shrink-0 inline-block"
                  >
                    Post a topic
                  </Link>
                ) : (
                  <Link
                    to="/login"
                    className="px-5 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-warm to-sun hover:shadow-lg transition shrink-0 inline-block"
                  >
                    Login to Post
                  </Link>
                )}
              </div>

              {viewMode !== 'line-groups' && (
                <>
                  <ForumFilters
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    tags={tags}
                    selectedTag={selectedTag}
                    onSelectTag={setSelectedTag}
                    resultCount={filteredItems.length}
                    hotTags={top5HotTags}
                  />
                  
                  {/* Sort Options - 适用于 discussions 和 announcements */}
                  {(viewMode === 'discussions' || viewMode === 'announcements') && (
                    <div className="bg-white rounded-2xl p-4 border border-primary/10 shadow-sm mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-primary/70">Sort by:</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSearchParams((prev) => {
                                prev.set(`${viewMode}_sort`, 'latest')
                                prev.set('page', '1') // Reset to first page when sorting changes
                                return prev
                              })
                            }}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                              sortBy === 'latest'
                                ? 'bg-accent text-white'
                                : 'bg-primary/5 text-primary hover:bg-primary/10'
                            }`}
                          >
                            Latest
                          </button>
                          <button
                            onClick={() => {
                              setSearchParams((prev) => {
                                prev.set(`${viewMode}_sort`, 'views')
                                prev.set('page', '1')
                                return prev
                              })
                            }}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                              sortBy === 'views'
                                ? 'bg-accent text-white'
                                : 'bg-primary/5 text-primary hover:bg-primary/10'
                            }`}
                          >
                            Most Views
                          </button>
                          <button
                            onClick={() => {
                              setSearchParams((prev) => {
                                prev.set(`${viewMode}_sort`, 'replies')
                                prev.set('page', '1')
                                return prev
                              })
                            }}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                              sortBy === 'replies'
                                ? 'bg-accent text-white'
                                : 'bg-primary/5 text-primary hover:bg-primary/10'
                            }`}
                          >
                            Most Replies
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </header>

            <div className="space-y-4">
              {isLoading && (
                <div className="bg-white rounded-2xl p-8 text-center text-primary/60">
                  Loading community threads…
                </div>
              )}
              {isError && (
                <div className="bg-white rounded-2xl p-8 text-center text-warm border border-warm/20">
                  Unable to load threads: {error instanceof Error ? error.message : 'Unknown error'}
                </div>
              )}

              {!isLoading && !isError && filteredItems.length === 0 && (
                <div className="bg-white rounded-2xl p-8 text-center text-primary/60 border border-dashed border-primary/20">
                  {viewMode === 'discussions' && !searchQuery && !selectedTag ? (
                    // 没有搜索和标签过滤，但数据为空（可能是后端没有数据）
                    'No threads yet. Be the first to start a discussion!'
                  ) : (
                    <>
                      No {viewMode === 'announcements' 
                        ? 'announcements' 
                        : viewMode === 'line-groups'
                        ? 'LINE groups'
                        : 'threads'} match {selectedTag ? `the "${selectedTag}" tag` : searchQuery ? 'that search query' : 'the current filters'}.
                    </>
                  )}
                </div>
              )}

              {!isLoading && !isError && viewMode === 'line-groups' ? (
                // LINE Groups 视图：显示卡片布局
                lineGroups.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 text-center border border-primary/10">
                    <p className="text-primary/70">No LINE groups available yet.</p>
                    {user && (
                      <p className="text-sm text-primary/60 mt-2">
                        You can request to create a new LINE group. Admin will review your request.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {lineGroups.map((group) => {
                      const myApplication = myApplications.find((app) => app.group_id === group.id)
                      const applicationStatus = myApplication?.status || null
                      const isApproved = applicationStatus === 'approved'
                      const isPending = applicationStatus === 'pending'
                      const isRejected = applicationStatus === 'rejected'
                      
                      let qrCodeUrl: string | null = null
                      if (isApproved) {
                        const appQrCode = myApplication?.group?.qr_code_url
                        const groupQrCode = group.qr_code_url
                        if (appQrCode && appQrCode.trim() !== '') {
                          qrCodeUrl = appQrCode
                        } else if (groupQrCode && groupQrCode.trim() !== '') {
                          qrCodeUrl = groupQrCode
                        }
                      }

                      return (
                        <div
                          key={group.id}
                          className="bg-white rounded-2xl border border-primary/10 shadow-sm hover:shadow-md transition p-6"
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <h3 className="text-xl font-bold text-primary mb-2">{group.name}</h3>
                              {group.description && (
                                <p className="text-sm text-primary/70 mb-3">{group.description}</p>
                              )}
                              <div className="flex items-center gap-4 text-xs text-primary/60">
                                <span>👥 {group.member_count} members</span>
                                {group.manager && (
                                  <span>👤 {group.manager.username || 'Manager'}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="mb-4">
                            <div className="text-sm font-semibold text-primary mb-2">QR Code:</div>
                            <div className="flex justify-center">
                              {isApproved && qrCodeUrl ? (
                                <img
                                  src={qrCodeUrl}
                                  alt={`${group.name} QR Code`}
                                  className="max-w-full h-auto max-h-64 rounded-lg border border-primary/10 shadow-sm"
                                  style={{ maxWidth: '300px', minHeight: '300px', objectFit: 'contain' }}
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement
                                    target.style.display = 'none'
                                    const parent = target.parentElement
                                    if (parent) {
                                      parent.innerHTML = `
                                        <div class="text-center p-4 border border-red-200 rounded-lg bg-red-50" style="width: 300px; height: 300px; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                                          <p class="text-sm text-red-600 mb-2">图片加载失败</p>
                                          <a href="${qrCodeUrl}" target="_blank" rel="noopener noreferrer" class="text-accent hover:underline text-sm">
                                            点击查看原图
                                          </a>
                                        </div>
                                      `
                                    }
                                  }}
                                />
                              ) : (
                                <div 
                                  className="rounded-lg border border-primary/20 bg-primary/5 flex items-center justify-center"
                                  style={{ width: '300px', height: '300px' }}
                                >
                                  {isApproved ? (
                                    <div className="text-center p-4">
                                      <p className="text-sm text-primary/60 mb-2">QR Code 暂不可用</p>
                                      <p className="text-xs text-primary/40">请联系群组管理员</p>
                                    </div>
                                  ) : (
                                    <div className="text-center p-4">
                                      <p className="text-sm text-primary/60 mb-2">申请加入后可见</p>
                                      <p className="text-xs text-primary/40">QR Code</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            {isApproved && qrCodeUrl && (
                              <p className="text-xs text-primary/60 text-center mt-2">扫描二维码加入群组</p>
                            )}
                          </div>

                          <div className="flex gap-2 mt-4">
                            {isApproved ? (
                              <div className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-green-600 text-center">
                                ✓ Joined
                              </div>
                            ) : isPending ? (
                              <div className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-primary border-2 border-yellow-400 bg-yellow-50 text-center">
                                ⏳ Pending
                              </div>
                            ) : isRejected ? (
                              <div className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-primary border-2 border-red-400 bg-red-50 text-center">
                                ✗ Rejected
                              </div>
                            ) : (
                              <button
                                onClick={() => handleApply(group)}
                                className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-accent to-primary hover:shadow-lg transition"
                              >
                                Apply to Join
                              </button>
                            )}
                            <button
                              onClick={() => handleReport(group)}
                              className="px-4 py-2 rounded-lg text-sm font-semibold text-warm border border-warm hover:bg-warm/10 transition"
                              title="Report this group"
                            >
                              ⚠️
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              ) : (
                // 其他视图：显示 ThreadCard
                <>
                  {!isLoading && !isError && (() => {
                    // 对于 discussions，需要前端分页
                    if (viewMode === 'discussions') {
                      const start = (currentPage - 1) * pageSize
                      const end = start + pageSize
                      const paginatedItems = filteredItems.slice(start, end)
                      const totalFilteredPages = Math.ceil(filteredItems.length / pageSize)
                      
                      return (
                        <>
                          {paginatedItems.map((item) => <ThreadCard key={item.id} thread={item} />)}
                          
                          {/* 分页控件 */}
                          {totalFilteredPages > 1 && (
                            <div className="flex items-center justify-center gap-2 mt-6">
                              <button
                                onClick={() => {
                                  const newPage = Math.max(1, currentPage - 1)
                                  const params = new URLSearchParams(searchParams)
                                  params.set('page', newPage.toString())
                                  setSearchParams(params)
                                }}
                                disabled={currentPage === 1}
                                className="px-4 py-2 rounded-lg text-sm font-semibold text-primary border border-primary/15 hover:bg-primary/5 transition disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                上一页
                              </button>
                              
                              <div className="flex items-center gap-1">
                                {Array.from({ length: Math.min(5, totalFilteredPages) }, (_, i) => {
                                  let pageNum: number
                                  if (totalFilteredPages <= 5) {
                                    pageNum = i + 1
                                  } else if (currentPage <= 3) {
                                    pageNum = i + 1
                                  } else if (currentPage >= totalFilteredPages - 2) {
                                    pageNum = totalFilteredPages - 4 + i
                                  } else {
                                    pageNum = currentPage - 2 + i
                                  }
                                  
                                  return (
                                    <button
                                      key={pageNum}
                                      onClick={() => {
                                        const params = new URLSearchParams(searchParams)
                                        params.set('page', pageNum.toString())
                                        setSearchParams(params)
                                      }}
                                      className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${
                                        currentPage === pageNum
                                          ? 'bg-accent text-white'
                                          : 'text-primary border border-primary/15 hover:bg-primary/5'
                                      }`}
                                    >
                                      {pageNum}
                                    </button>
                                  )
                                })}
                              </div>
                              
                              <button
                                onClick={() => {
                                  const newPage = Math.min(totalFilteredPages, currentPage + 1)
                                  const params = new URLSearchParams(searchParams)
                                  params.set('page', newPage.toString())
                                  setSearchParams(params)
                                }}
                                disabled={currentPage === totalFilteredPages}
                                className="px-4 py-2 rounded-lg text-sm font-semibold text-primary border border-primary/15 hover:bg-primary/5 transition disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                下一页
                              </button>
                              
                              <span className="text-sm text-primary/60 ml-4">
                                第 {currentPage} / {totalFilteredPages} 页，共 {filteredItems.length} 条
                              </span>
                            </div>
                          )}
                        </>
                      )
                    } else {
                      // 其他视图直接显示所有过滤后的结果
                      return filteredItems.map((item) => <ThreadCard key={item.id} thread={item} />)
                    }
                  })()}
                </>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* LINE Groups Modals */}
      {showApplyModal && selectedGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold text-primary mb-4">
              Apply to {selectedGroup.name}
            </h2>
            <form onSubmit={handleSubmitApply} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-primary mb-2">
                  Message (optional)
                </label>
                <textarea
                  value={applyMessage}
                  onChange={(e) => setApplyMessage(e.target.value)}
                  placeholder="Tell the manager why you want to join..."
                  rows={4}
                  className="w-full px-4 py-2.5 rounded-xl border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isApplying}
                  className="flex-1 px-6 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-accent to-primary hover:shadow-lg transition disabled:opacity-50"
                >
                  {isApplying ? 'Submitting...' : 'Submit Application'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowApplyModal(false)
                    setApplyMessage('')
                    setSelectedGroup(null)
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

      {showReportModal && selectedGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold text-primary mb-4">
              Report {selectedGroup.name}
            </h2>
            <form onSubmit={handleSubmitReport} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-primary mb-2">
                  Reason *
                </label>
                <input
                  type="text"
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="Brief reason for reporting..."
                  required
                  minLength={10}
                  className="w-full px-4 py-2.5 rounded-xl border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-primary mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="Provide more details..."
                  rows={4}
                  className="w-full px-4 py-2.5 rounded-xl border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isReporting || !reportReason.trim()}
                  className="flex-1 px-6 py-2.5 rounded-xl font-semibold text-white bg-warm hover:shadow-lg transition disabled:opacity-50"
                >
                  {isReporting ? 'Submitting...' : 'Submit Report'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowReportModal(false)
                    setReportReason('')
                    setReportDescription('')
                    setSelectedGroup(null)
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

      {showCreateRequestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold text-primary mb-4">
              Request to Create LINE Group
            </h2>
            <form 
              onSubmit={handleSubmitCreateRequest} 
              className="space-y-4"
              noValidate
            >
              <div>
                <label className="block text-sm font-semibold text-primary mb-2">
                  Group Name *
                </label>
                <input
                  type="text"
                  value={createRequestName}
                  onChange={(e) => setCreateRequestName(e.target.value)}
                  placeholder="Enter group name..."
                  required
                  minLength={3}
                  maxLength={100}
                  className="w-full px-4 py-2.5 rounded-xl border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-primary mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={createRequestDescription}
                  onChange={(e) => setCreateRequestDescription(e.target.value)}
                  placeholder="Describe your LINE group..."
                  rows={3}
                  maxLength={500}
                  className="w-full px-4 py-2.5 rounded-xl border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-primary mb-2">
                  QR Code Image URL *
                </label>
                <input
                  type="url"
                  value={createRequestQrCodeUrl}
                  onChange={(e) => setCreateRequestQrCodeUrl(e.target.value)}
                  placeholder="https://example.com/qr-code.png"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
                />
                {createRequestQrCodeUrl && (
                  <div className="mt-3">
                    <p className="text-xs text-primary/60 mb-2">Preview:</p>
                    <div className="flex justify-center">
                      <img
                        src={createRequestQrCodeUrl}
                        alt="QR Code Preview"
                        className="max-w-full h-auto max-h-48 rounded-lg border border-primary/10"
                        style={{ maxWidth: '200px' }}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.style.display = 'none'
                          const parent = target.parentElement
                          if (parent) {
                            parent.innerHTML = `
                              <div class="text-center p-3 border border-red-200 rounded-lg bg-red-50">
                                <p class="text-xs text-red-600">无法加载图片，请检查 URL 是否正确</p>
                              </div>
                            `
                          }
                        }}
                      />
                    </div>
                  </div>
                )}
                <p className="text-xs text-primary/60 mt-2">
                  Provide a URL to your LINE group QR code image (e.g., from image hosting services)
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isCreatingRequest || !createRequestName.trim() || !createRequestQrCodeUrl.trim()}
                  className="flex-1 px-6 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-accent to-primary hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreatingRequest ? 'Submitting...' : 'Submit Request'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateRequestModal(false)
                    setCreateRequestName('')
                    setCreateRequestDescription('')
                    setCreateRequestQrCodeUrl('')
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
  )
}
