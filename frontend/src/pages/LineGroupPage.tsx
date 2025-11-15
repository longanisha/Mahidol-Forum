import { useState, useEffect, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import { useAuth } from '../context/AuthContext'

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

type LineGroupCreationRequest = {
  id: string
  requester_id: string
  name: string
  description: string | null
  qr_code_url: string
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

async function fetchGroups(): Promise<LineGroup[]> {
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
    console.log('[fetchMyApplications] No access token, returning empty array')
    return []
  }
  try {
    console.log('[fetchMyApplications] Fetching applications with token:', accessToken.substring(0, 20) + '...')
    const result = await apiFetch<LineGroupApplication[]>('/line-groups/my-applications', {
      accessToken,
    })
    console.log('[fetchMyApplications] API response:', result)
    return result
  } catch (error) {
    console.error('[fetchMyApplications] Error fetching applications:', error)
    // 即使出错也返回空数组，避免页面崩溃
    return []
  }
}

export function LineGroupPage() {
  const { t } = useTranslation()
  const { user, accessToken } = useAuth()
  const queryClient = useQueryClient()
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

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['line-groups'],
    queryFn: fetchGroups,
  })

  const { data: myCreationRequests = [] } = useQuery({
    queryKey: ['line-group-creation-requests'],
    queryFn: () => fetchMyCreationRequests(accessToken),
    enabled: !!user,
  })

  const { data: myApplications = [], isLoading: isLoadingApplications, error: applicationsError } = useQuery({
    queryKey: ['line-group-applications'],
    queryFn: () => fetchMyApplications(accessToken),
    enabled: !!user,
  })
  
  // 调试：打印 myApplications 数据
  useEffect(() => {
    console.log('[LineGroupPage] useQuery state:', {
      user: !!user,
      accessToken: !!accessToken,
      isLoadingApplications,
      applicationsError,
      myApplicationsLength: myApplications?.length || 0
    })
    
    if (applicationsError) {
      console.error('[LineGroupPage] Error loading applications:', applicationsError)
    }
    
    if (myApplications && myApplications.length > 0) {
      console.log('[LineGroupPage] myApplications loaded:', myApplications)
      myApplications.forEach((app, index) => {
        console.log(`[LineGroupPage] Application ${index}:`, {
          id: app.id,
          group_id: app.group_id,
          status: app.status,
          group: app.group,
          groupQrCode: app.group?.qr_code_url
        })
      })
    } else {
      console.log('[LineGroupPage] myApplications is empty or not loaded yet', {
        hasUser: !!user,
        hasAccessToken: !!accessToken,
        isLoading: isLoadingApplications,
        error: applicationsError
      })
    }
  }, [myApplications, isLoadingApplications, applicationsError, user, accessToken])

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
      if (!accessToken) {
        console.error('[CreateRequest] No access token')
        throw new Error('Please login to create a request')
      }
      console.log('[CreateRequest] Calling API with data:', data)
      try {
        const response = await apiFetch<LineGroupCreationRequest>('/line-groups/creation-requests', {
          method: 'POST',
          body: JSON.stringify(data),
          accessToken,
        })
        console.log('[CreateRequest] API response:', response)
        return response
      } catch (error) {
        console.error('[CreateRequest] API call error:', error)
        throw error
      }
    },
    onSuccess: (data) => {
      console.log('[CreateRequest] Success:', data)
      queryClient.invalidateQueries({ queryKey: ['line-group-creation-requests'] })
      setShowCreateRequestModal(false)
      setCreateRequestName('')
      setCreateRequestDescription('')
      setCreateRequestQrCodeUrl('')
      alert('Request submitted! Admin will review your request.')
    },
    onError: (error: unknown) => {
      console.error('[CreateRequest] Mutation error:', error)
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

  const handleSubmitApply = (e: FormEvent) => {
    e.preventDefault()
    if (!selectedGroup) return
    applyToGroup({
      groupId: selectedGroup.id,
      message: applyMessage.trim() || undefined,
    })
  }

  const handleSubmitReport = (e: FormEvent) => {
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


  const handleSubmitCreateRequest = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    e.stopPropagation()
    
    console.log('[CreateRequest] ========== Form submitted ==========')
    console.log('[CreateRequest] Event type:', e.type)
    console.log('[CreateRequest] Event target:', e.target)
    console.log('[CreateRequest] Name:', createRequestName)
    console.log('[CreateRequest] URL:', createRequestQrCodeUrl)
    console.log('[CreateRequest] User:', user?.id)
    console.log('[CreateRequest] AccessToken:', accessToken ? 'exists' : 'missing')
    console.log('[CreateRequest] isCreatingRequest:', isCreatingRequest)
    
    if (!createRequestName.trim()) {
      console.error('[CreateRequest] Validation failed: No group name')
      alert('Please provide group name')
      return
    }

    if (!user || !accessToken) {
      console.error('[CreateRequest] Validation failed: Not logged in')
      alert('Please login to create a request')
      return
    }

    const qrCodeUrl = createRequestQrCodeUrl.trim()

    if (!qrCodeUrl) {
      console.error('[CreateRequest] Validation failed: No QR code URL')
      alert('Please provide a QR code image URL')
      return
    }

    // 验证 URL 格式
    try {
      new URL(qrCodeUrl)
    } catch {
      alert('Please provide a valid URL (e.g., https://example.com/qr-code.png)')
      return
    }

    const requestData = {
      name: createRequestName.trim(),
      description: createRequestDescription.trim() || undefined,
      qr_code_url: qrCodeUrl,
    }

    console.log('[CreateRequest] Submitting request with:', requestData)
    console.log('[CreateRequest] Calling createGroupRequest mutation...')
    console.log('[CreateRequest] createGroupRequest function:', typeof createGroupRequest)
    console.log('[CreateRequest] isCreatingRequest:', isCreatingRequest)

    // 直接调用 mutation，不需要 try-catch，因为 React Query 会处理错误
    console.log('[CreateRequest] About to call createGroupRequest...')
    createGroupRequest(requestData)
    console.log('[CreateRequest] createGroupRequest called (mutation is async, this is expected)')
  }

  return (
    <div className="min-h-screen bg-muted">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-primary mb-2">line groups</h1>
              <p className="text-primary/70">
                Join verified LINE groups to connect with the Mahidol community
              </p>
            </div>
            {user && (
              <button
                onClick={() => setShowCreateRequestModal(true)}
                className="px-6 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-accent to-primary hover:shadow-lg transition"
              >
                + Create Group Request
              </button>
            )}
          </div>
        
        </header>

        {isLoading ? (
          <div className="text-center py-12 text-primary/60">Loading groups...</div>
        ) : groups.length === 0 ? (
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
            {groups.map((group) => {
              // 查找用户对该群组的申请
              const myApplication = myApplications.find((app) => app.group_id === group.id)
              const applicationStatus = myApplication?.status || null
              const isApproved = applicationStatus === 'approved'
              const isPending = applicationStatus === 'pending'
              const isRejected = applicationStatus === 'rejected'
              
              // 获取 QR Code URL
              // 如果已批准，优先使用 myApplication.group 中的 qr_code_url，否则使用 group 中的
              let qrCodeUrl: string | null = null
              if (isApproved) {
                // 检查 myApplication.group.qr_code_url（可能为空字符串）
                const appQrCode = myApplication?.group?.qr_code_url
                const groupQrCode = group.qr_code_url
                
                // 优先使用 myApplication.group 中的，但要确保不是空字符串
                if (appQrCode && appQrCode.trim() !== '') {
                  qrCodeUrl = appQrCode
                } else if (groupQrCode && groupQrCode.trim() !== '') {
                  qrCodeUrl = groupQrCode
                } else {
                  qrCodeUrl = null
                }
              } else {
                // 未批准的用户不应该看到 QR Code
                qrCodeUrl = null
              }
              
              // 调试日志 - 对所有群组都输出，方便诊断
              console.log(`[LineGroupPage] Group ${group.name}:`, {
                groupId: group.id,
                isApproved,
                applicationStatus,
                hasMyApplication: !!myApplication,
                myApplicationId: myApplication?.id,
                myApplicationStatus: myApplication?.status,
                myApplicationGroup: myApplication?.group,
                myApplicationGroupQrCode: myApplication?.group?.qr_code_url,
                groupQrCode: group.qr_code_url,
                finalQrCodeUrl: qrCodeUrl,
                willShowQrCode: isApproved && qrCodeUrl
              })

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

                  {/* QR Code 区域 - 已批准用户显示 QR Code，未批准用户显示占位符 */}
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
                            // 如果图片加载失败，显示错误提示
                            const target = e.target as HTMLImageElement
                            target.style.display = 'none'
                            const parent = target.parentElement
                            if (parent && qrCodeUrl) {
                              const encodedUrl = qrCodeUrl.replace(/"/g, '&quot;').replace(/'/g, '&#39;')
                              parent.innerHTML = `
                                <div class="text-center p-4 border border-red-200 rounded-lg bg-red-50" style="width: 300px; height: 300px; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                                  <p class="text-sm text-red-600 mb-2">Image loading failed</p>
                                  <a href="${encodedUrl}" target="_blank" rel="noopener noreferrer" class="text-accent hover:underline text-sm">
                                    Click to view original image
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
                              <p className="text-sm text-primary/60 mb-2">QR Code temporarily unavailable</p>
                              <p className="text-xs text-primary/40">Please contact group administrator</p>
                            </div>
                          ) : (
                            <div className="text-center p-4">
                              <p className="text-sm text-primary/60 mb-2">Visible after joining</p>
                              <p className="text-xs text-primary/40">QR Code</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {isApproved && qrCodeUrl && (
                      <p className="text-xs text-primary/60 text-center mt-2">Scan QR code to join group</p>
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
                      <i className="fa-solid fa-triangle-exclamation"></i>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Apply Modal */}
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
                    {isApplying ? t('lineGroup.submitting') : t('lineGroup.requestInvite')}
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
                    {t('common.cancel')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Report Modal */}
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
                    {isReporting ? t('lineGroup.submitting') : t('post.submitReport')}
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
                    {t('common.cancel')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create Request Modal */}
        {showCreateRequestModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full">
              <h2 className="text-2xl font-bold text-primary mb-4">
                {t('lineGroup.requestToCreate')}
              </h2>
              <form 
                onSubmit={handleSubmitCreateRequest} 
                className="space-y-4"
                noValidate
              >
                <div>
                  <label className="block text-sm font-semibold text-primary mb-2">
                    {t('lineGroup.groupName')} *
                  </label>
                  <input
                    type="text"
                    value={createRequestName}
                    onChange={(e) => setCreateRequestName(e.target.value)}
                    placeholder={t('lineGroup.enterGroupName')}
                    required
                    minLength={3}
                    maxLength={100}
                    className="w-full px-4 py-2.5 rounded-xl border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-primary mb-2">
                    {t('lineGroup.description')}
                  </label>
                  <textarea
                    value={createRequestDescription}
                    onChange={(e) => setCreateRequestDescription(e.target.value)}
                    placeholder={t('lineGroup.describeGroup')}
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
                      <p className="text-xs text-primary/60 mb-2">{t('lineGroup.preview')}:</p>
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
                                  <p class="text-xs text-red-600">Cannot load image, please check if URL is correct</p>
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
                    onClick={(e) => {
                      const isDisabled = isCreatingRequest || !createRequestName.trim() || !createRequestQrCodeUrl.trim()
                      console.log('[CreateRequest] Submit button clicked')
                      console.log('[CreateRequest] Button disabled?', isDisabled)
                      console.log('[CreateRequest] Disabled reasons:', {
                        isCreatingRequest,
                        noName: !createRequestName.trim(),
                        noQrCode: !createRequestQrCodeUrl.trim()
                      })
                      if (isDisabled) {
                        e.preventDefault()
                        e.stopPropagation()
                        console.log('[CreateRequest] Button is disabled, preventing form submission')
                        return false
                      }
                    }}
                  >
                    {isCreatingRequest ? t('lineGroup.submittingRequest') : t('lineGroup.submitRequest')}
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
                    {t('lineGroup.cancel')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
