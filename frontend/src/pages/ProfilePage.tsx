import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

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
  } | null
  group: {
    id: string
    name: string
    description: string | null
    qr_code_url: string
  } | null
}

type TabType = 'profile' | 'group-requests' | 'my-posts' | 'replies' | 'drafts' | 'points-history'

type PostWithAuthor = {
  id: string
  title: string
  category: string | null
  summary: string | null
  cover_image_url: string | null
  author_id: string
  created_at: string
  updated_at: string | null
  reply_count: number
  view_count: number
  upvote_count: number
  downvote_count: number
  tags: string[] | null
  is_closed: boolean
  is_pinned: boolean
  author: {
    id: string | null
    username: string | null
    avatar_url: string | null
  } | null
  user_vote: string | null
}

type PaginatedPostResponse = {
  items: PostWithAuthor[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

type PostReply = {
  id: string
  post_id: string
  parent_reply_id: string | null
  author_id: string
  content: string
  created_at: string
  updated_at: string | null
  author: {
    id: string | null
    username: string | null
    avatar_url: string | null
  } | null
  upvote_count: number
  downvote_count: number
}

type UserRanking = {
  ranking: number
  total_users: number
  total_points: number
}

async function fetchMyCreationRequests(accessToken: string | null): Promise<LineGroupCreationRequest[]> {
  if (!accessToken) return []
  return apiFetch<LineGroupCreationRequest[]>('/line-groups/creation-requests', {
    accessToken,
  })
}

async function fetchMyManagedGroupsApplications(accessToken: string | null): Promise<LineGroupApplication[]> {
  if (!accessToken) return []
  return apiFetch<LineGroupApplication[]>('/line-groups/my-managed-groups/applications', {
    accessToken,
  })
}

async function fetchMyPosts(accessToken: string | null, page: number = 1): Promise<PaginatedPostResponse> {
  if (!accessToken) {
    console.log('[fetchMyPosts] No access token provided')
    return { items: [], total: 0, page: 1, page_size: 10, total_pages: 0 }
  }
  console.log('[fetchMyPosts] ====== Fetching posts ======')
  console.log('[fetchMyPosts] Token length:', accessToken.length)
  console.log('[fetchMyPosts] Token preview:', accessToken.substring(0, 50) + '...')
  console.log('[fetchMyPosts] Token ends with:', accessToken.substring(accessToken.length - 20))
  try {
    const result = await apiFetch<PaginatedPostResponse>(`/posts/my-posts?page=${page}&page_size=10`, {
      accessToken,
    })
    console.log('[fetchMyPosts] ====== Success, got', result.items?.length || 0, 'items ======')
    return result
  } catch (error) {
    console.error('[fetchMyPosts] ====== Error fetching posts ======', error)
    throw error
  }
}

async function fetchUserProfile(accessToken: string | null): Promise<{ total_points: number; level: number }> {
  if (!accessToken) return { total_points: 0, level: 1 }
  return apiFetch<{ total_points: number; level: number }>('/points/profile', {
    accessToken,
  })
}

async function fetchUserRanking(accessToken: string | null): Promise<UserRanking> {
  if (!accessToken) return { ranking: 0, total_users: 0, total_points: 0 }
  return apiFetch<UserRanking>('/points/ranking', {
    accessToken,
  })
}

async function fetchAllRepliesToMyPosts(accessToken: string | null): Promise<PostReply[]> {
  if (!accessToken) {
    console.log('[fetchAllRepliesToMyPosts] No access token provided')
    return []
  }
  console.log('[fetchAllRepliesToMyPosts] Fetching replies with token:', accessToken.substring(0, 20) + '...')
  return apiFetch<PostReply[]>('/posts/my-posts/replies?limit=100', {
    accessToken,
  })
}

type PointRecord = {
  id: string
  user_id: string
  points: number
  reason: string
  created_at: string
}

async function fetchPointHistory(accessToken: string | null, limit: number = 100): Promise<PointRecord[]> {
  if (!accessToken) {
    console.log('[fetchPointHistory] No access token provided')
    return []
  }
  console.log('[fetchPointHistory] Fetching point history with token:', accessToken.substring(0, 20) + '...')
  return apiFetch<PointRecord[]>(`/points/history?limit=${limit}`, {
    accessToken,
  })
}

async function fetchRepliesToMyPosts(accessToken: string | null, postId: string): Promise<PostReply[]> {
  if (!accessToken) return []
  return apiFetch<PostReply[]>(`/posts/my-posts/${postId}/replies`, {
    accessToken,
  })
}

export function ProfilePage() {
  const { t } = useTranslation()
  const { user, profile, accessToken, refreshProfile, updateProfile } = useAuth()
  const queryClient = useQueryClient()
  const location = useLocation()
  

  const [isRefreshingProfile, setIsRefreshingProfile] = useState(false)
  

  useEffect(() => {
    console.log('[ProfilePage] ====== useEffect triggered ======')
    console.log('[ProfilePage] Pathname:', location.pathname)
    console.log('[ProfilePage] User:', user ? `exists (${user.id})` : 'null')
    console.log('[ProfilePage] AccessToken:', accessToken ? 'exists' : 'null')
    console.log('[ProfilePage] refreshProfile function:', typeof refreshProfile)
    

    if (location.pathname !== '/profile') {
      console.log('[ProfilePage] Not on /profile path, skipping refresh')
      return
    }
    

    if (!user || !accessToken) {
      console.log('[ProfilePage] ⏳ Waiting for user and accessToken...', {
        hasUser: !!user,
        hasAccessToken: !!accessToken,
      })
      return
    }
    

    if (!refreshProfile || typeof refreshProfile !== 'function') {
      console.error('[ProfilePage] ❌ refreshProfile is not a function!', refreshProfile)
      return
    }
    
    console.log('[ProfilePage] ====== ProfilePage loaded, forcing refresh from DATABASE ======')
    console.log('[ProfilePage] Current profile before refresh:', {
      username: profile?.username,
      avatar_url: profile?.avatar_url,
    })
    console.log('[ProfilePage] User ID:', user.id)
    console.log('[ProfilePage] AccessToken exists:', !!accessToken)
    console.log('[ProfilePage] Calling refreshProfile(true) to get fresh data from DATABASE...')
    

    setIsRefreshingProfile(true)
    

    const refreshPromise = refreshProfile(true) 
    console.log('[ProfilePage] refreshProfile called, promise:', refreshPromise)
    
    refreshPromise
      .then(() => {
        console.log('[ProfilePage] ✅ Profile refreshed from DATABASE on page load')
        console.log('[ProfilePage] Profile after refresh:', {
          username: profile?.username,
          avatar_url: profile?.avatar_url,
        })

        setIsRefreshingProfile(false)
      })
      .catch((err) => {
        console.error('[ProfilePage] ❌ Failed to refresh profile on page load:', err)
        console.error('[ProfilePage] Error details:', err)
        if (err instanceof Error) {
          console.error('[ProfilePage] Error message:', err.message)
          console.error('[ProfilePage] Error stack:', err.stack)
        }
        setIsRefreshingProfile(false)
      })
  }, [location.pathname, user?.id, accessToken, refreshProfile]) 
  const [isEditing, setIsEditing] = useState(false)

  const [editingUsername, setEditingUsername] = useState('')

  const [savedUsername, setSavedUsername] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activeTab, setActiveTab] = useState<TabType>('profile')
  const [myPostsPage, setMyPostsPage] = useState(1)
  const [repliesData, setRepliesData] = useState<Record<string, PostReply[]>>({})
  const [loadingReplies, setLoadingReplies] = useState<Record<string, boolean>>({})
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (profile?.username !== undefined && !isEditing) {

      if (savedUsername !== profile.username) {
        console.log('[ProfilePage] Profile username changed, syncing savedUsername:', {
          old: savedUsername,
          new: profile.username,
        })
        setSavedUsername(profile.username)
      }
    } else if (savedUsername === null && profile?.username !== undefined) {
      
      console.log('[ProfilePage] Initializing savedUsername from profile:', profile.username)
      setSavedUsername(profile.username)
    }
  }, [profile?.username, isEditing, savedUsername])


  const displayUsername = isEditing
    ? editingUsername 
    : (profile?.username ?? (isRefreshingProfile ? null : savedUsername) ?? user?.email?.split('@')[0] ?? 'Member') 
  

  const isProfileLoading = isRefreshingProfile && !profile

  const { mutate: updateUserProfile, isPending } = useMutation({
    mutationFn: async () => {
      if (!user || !accessToken) {
        throw new Error('You must be logged in to update your profile.')
      }

      const updates: { username?: string } = {}
      const trimmedUsername = editingUsername.trim()
      if (trimmedUsername && trimmedUsername !== profile?.username) {
        updates.username = trimmedUsername
      }
      

      if (Object.keys(updates).length === 0) {
        throw new Error('No changes to save')
      }

      
      const updatedProfile = await apiFetch<{
        id: string
        username: string | null
        avatar_url: string | null
        total_points: number
        level: number
        created_at: string
      }>('/points/profile', {
        method: 'PATCH',
        body: JSON.stringify(updates),
        accessToken,
      })

      return updatedProfile
    },
    onSuccess: async (updatedProfile) => {
      console.log('[ProfilePage] Profile updated successfully:', updatedProfile)
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      queryClient.invalidateQueries({ queryKey: ['points', 'profile'] })
      
     
      const newUsername = updatedProfile.username ?? ''
      console.log('[ProfilePage] Setting saved username to:', newUsername)
      setSavedUsername(newUsername)
      
      
      if (updatedProfile.username !== undefined || updatedProfile.avatar_url !== undefined) {
        updateProfile({
          username: updatedProfile.username,
          avatar_url: updatedProfile.avatar_url,
        })
        console.log('[ProfilePage] Profile context updated immediately:', {
          username: updatedProfile.username,
          avatar_url: updatedProfile.avatar_url,
        })
      }
      
    
      refreshProfile(true) 
        .then(() => {
          console.log('[ProfilePage] Profile context refreshed from database after update')
        })
        .catch((err) => {
          console.warn('[ProfilePage] Failed to refresh profile in context:', err)
        })
      
      setSuccess('Profile updated successfully!')
      setIsEditing(false)
      setTimeout(() => setSuccess(null), 3000)
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to update profile')
      setTimeout(() => setError(null), 5000)
    },
  })

  const { data: myCreationRequests = [], isLoading: creationRequestsLoading } = useQuery({
    queryKey: ['profile', 'creation-requests'],
    queryFn: () => fetchMyCreationRequests(accessToken),
    enabled: !!accessToken && activeTab === 'group-requests',
    retry: 1, 
    staleTime: 2 * 60 * 1000, 
    refetchOnMount: false, 
    refetchOnWindowFocus: false, 
  })

  const { data: myManagedGroupsApplications = [], isLoading: applicationsLoading } = useQuery({
    queryKey: ['profile', 'managed-groups-applications'],
    queryFn: () => fetchMyManagedGroupsApplications(accessToken),
    enabled: !!accessToken && activeTab === 'group-requests',
    retry: 1, 
    staleTime: 2 * 60 * 1000, 
    refetchOnMount: false, 
    refetchOnWindowFocus: false, 
  })

  const { data: userProfile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', 'points'],
    queryFn: () => fetchUserProfile(accessToken),
    enabled: !!accessToken,
    retry: 1, 
    staleTime: 5 * 60 * 1000, 
    refetchOnMount: false, 
    refetchOnWindowFocus: false, 
  })

  const compressImage = (file: File, maxWidth: number = 150, maxHeight: number = 150, quality: number = 0.5): Promise<File> => {
    return new Promise((resolve, reject) => {
      console.log('[Avatar] compressImage: Starting compression...')
      const reader = new FileReader()
      
      reader.onload = (e) => {
        console.log('[Avatar] compressImage: File read, loading image...')
        const img = new Image()
        
      
        const timeout = setTimeout(() => {
          reject(new Error('Image loading timeout'))
        }, 5000)
        
        img.onload = () => {
          clearTimeout(timeout)
          console.log('[Avatar] compressImage: Image loaded, dimensions:', img.width, 'x', img.height)
          
         
          let width = Math.min(img.width, maxWidth)
          let height = Math.min(img.height, maxHeight)
          
          
          if (img.width > img.height) {
            height = (img.height * maxWidth) / img.width
            width = maxWidth
          } else {
            width = (img.width * maxHeight) / img.height
            height = maxHeight
          }

          console.log('[Avatar] compressImage: Resizing to:', width, 'x', height)

          
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d', { 
            willReadFrequently: false,
            alpha: false
          })
          if (!ctx) {
            reject(new Error('Failed to get canvas context'))
            return
          }

          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'low'
          ctx.drawImage(img, 0, 0, width, height)

          console.log('[Avatar] compressImage: Converting to blob...')
       
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to compress image'))
                return
              }
              console.log('[Avatar] compressImage: Compression complete, size:', blob.size, 'bytes')
              const compressedFile = new File([blob], file.name, { type: 'image/jpeg' })
              resolve(compressedFile)
            },
            'image/jpeg',
            quality
          )
        }
        
        img.onerror = () => {
          clearTimeout(timeout)
          console.error('[Avatar] compressImage: Image load error')
          reject(new Error('Failed to load image'))
        }
        
        img.src = e.target?.result as string
      }
      
      reader.onerror = () => {
        console.error('[Avatar] compressImage: File read error')
        reject(new Error('Failed to read file'))
      }
      
      reader.readAsDataURL(file)
    })
  }


  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        resolve(result)
      }
      reader.onerror = () => reject(new Error('Failed to convert file to base64'))
      reader.readAsDataURL(file)
    })
  }


  const uploadAvatar = async (file: File): Promise<string> => {
    console.log('[Avatar] uploadAvatar called')
    
    if (!user || !accessToken) {
      console.error('[Avatar] Missing user or accessToken')
      throw new Error('You must be logged in to upload avatar')
    }

    console.log('[Avatar] Compressing image...')

    const compressedFile = await compressImage(file, 50, 50, 0.5)
    console.log('[Avatar] Image compressed:', compressedFile.size, 'bytes')


    const fileName = `${user.id}/${Date.now()}.jpg`
    const filePath = fileName
    console.log('[Avatar] Attempting to upload to Storage:', filePath)

    try {
     
      const uploadPromise = supabase.storage
        .from('avatars')
        .upload(filePath, compressedFile, {
          cacheControl: '3600',
          upsert: true,
          contentType: 'image/jpeg',
        })

      const timeoutPromise = new Promise<{ error: Error }>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Upload timeout'))
        }, 15000)
      })

      console.log('[Avatar] Waiting for upload response (max 15s)...')
      const { error: uploadError } = await Promise.race([uploadPromise, timeoutPromise]) as any

      if (uploadError) {
        console.warn('[Avatar] Storage upload failed, using base64 fallback:', uploadError)
        throw uploadError 
      }

  
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get public URL')
      }

      console.log('[Avatar] Storage upload successful, URL:', urlData.publicUrl)
      return urlData.publicUrl
    } catch (err) {

      console.log('[Avatar] Storage upload failed, using base64 fallback')
      console.log('[Avatar] Converting to base64...')
      
      const base64 = await fileToBase64(compressedFile)
      console.log('[Avatar] Base64 conversion complete, length:', base64.length)
      

      return base64
    }
  }


  const handleAvatarFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      console.log('[Avatar] No file selected')
      return
    }

    console.log('[Avatar] ====== Starting upload ======')
    console.log('[Avatar] File:', file.name, file.size, 'bytes')

    
    if (!file.type.startsWith('image/')) {
      console.error('[Avatar] Invalid file type:', file.type)
      setError('Please select an image file')
      setTimeout(() => setError(null), 5000)
      return
    }


    if (file.size > 10 * 1024 * 1024) {
      console.error('[Avatar] File too large:', file.size)
      setError('Image size must be less than 10MB')
      setTimeout(() => setError(null), 5000)
      return
    }


    if (!accessToken) {
      console.error('[Avatar] No access token')
      setError('You must be logged in to upload avatar')
      setTimeout(() => setError(null), 5000)
      return
    }

    console.log('[Avatar] Access token present, starting upload...')
    setIsUploadingAvatar(true)
    
    const previewUrl = URL.createObjectURL(file)
    
    try {
      const startTime = Date.now()
      
      console.log('[Avatar] Step 1: Compressing image...')

      const avatarUrl = await uploadAvatar(file)
      console.log('[Avatar] Step 1 complete. URL:', avatarUrl)
      
      console.log('[Avatar] Step 2: Updating database...')
      console.log('[Avatar] Calling API: PATCH /points/profile')
      console.log('[Avatar] Request body:', { avatar_url: avatarUrl })
      

      const updatedProfile = await apiFetch<{
        id: string
        username: string | null
        avatar_url: string | null
        total_points: number
        level: number
        created_at: string
      }>('/points/profile', {
        method: 'PATCH',
        body: JSON.stringify({ avatar_url: avatarUrl }),
        accessToken,
      })

      console.log('[Avatar] Step 2 complete. Profile updated:', updatedProfile)


      queryClient.setQueryData(['points', 'profile'], (old: any) => {
        if (old) {
          return { ...old, avatar_url: avatarUrl, username: updatedProfile.username }
        }
        return old
      })
      

      updateProfile({ 
        avatar_url: avatarUrl,
        username: updatedProfile.username, 
      })
      console.log('[Avatar] Profile context updated directly, Header should update immediately:', {
        avatar_url: avatarUrl,
        username: updatedProfile.username,
      })
      
 
      refreshProfile().then(() => {
        console.log('[Avatar] Profile context refreshed from backend')
      }).catch((err) => {
        console.warn('[Avatar] Failed to refresh profile:', err)
      })
      
      const elapsed = Date.now() - startTime
      console.log(`[Avatar] ====== Upload completed in ${elapsed}ms ======`)
      
 
      URL.revokeObjectURL(previewUrl)
      
      setSuccess('Avatar updated successfully!')
      setTimeout(() => setSuccess(null), 2000)
      

      queryClient.invalidateQueries({ queryKey: ['profile'] })
      queryClient.invalidateQueries({ queryKey: ['points', 'profile'] })
      queryClient.invalidateQueries({ queryKey: ['profile', 'points'] })
    } catch (err) {
      console.error('[Avatar] ====== Error occurred ======')
      console.error('[Avatar] Error:', err)
      console.error('[Avatar] Error type:', err instanceof Error ? err.constructor.name : typeof err)
      
      let errorMessage = 'Failed to upload avatar'
      if (err instanceof Error) {
        errorMessage = err.message

        if (errorMessage === '[object Object]') {
          try {
            const errorObj = err as any
            if (errorObj.detail) {
              errorMessage = String(errorObj.detail)
            } else if (errorObj.message) {
              errorMessage = String(errorObj.message)
            } else {
              errorMessage = JSON.stringify(err, null, 2)
            }
          } catch {
            errorMessage = 'Unknown error occurred'
          }
        }
      } else {
        errorMessage = String(err)
      }
      
      console.error('[Avatar] Error message:', errorMessage)
      

      URL.revokeObjectURL(previewUrl)
      
      setError(errorMessage)
      setTimeout(() => setError(null), 5000)
    } finally {
      console.log('[Avatar] Cleaning up...')
      setIsUploadingAvatar(false)

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const { data: userRanking, isLoading: rankingLoading } = useQuery({
    queryKey: ['profile', 'ranking'],
    queryFn: () => fetchUserRanking(accessToken),
    enabled: !!accessToken,
    retry: 1, 
    staleTime: 5 * 60 * 1000, 
    refetchOnMount: false, 
    refetchOnWindowFocus: false, 
  })

  const { data: myPostsData, isLoading: myPostsLoading, error: myPostsError, refetch: refetchMyPosts } = useQuery({
    queryKey: ['profile', 'my-posts', myPostsPage, accessToken], 
    queryFn: () => {
      console.log('[useQuery my-posts] ====== Executing query ======')
      console.log('[useQuery my-posts] accessToken exists:', !!accessToken)
      console.log('[useQuery my-posts] accessToken type:', typeof accessToken)
      console.log('[useQuery my-posts] accessToken length:', accessToken?.length || 0)
      console.log('[useQuery my-posts] accessToken preview:', accessToken ? accessToken.substring(0, 50) + '...' : 'null')
      console.log('[useQuery my-posts] activeTab:', activeTab)
      if (!accessToken) {
        console.error('[useQuery my-posts] ❌ No accessToken available!')
        throw new Error('No access token available')
      }
      return fetchMyPosts(accessToken, myPostsPage)
    },
    enabled: !!accessToken && (activeTab === 'my-posts' || activeTab === 'replies'),
    retry: (failureCount, error) => {
     
      if (error instanceof Error && (error as any).isUnauthorized) {
        if ((error as any).tokenRefreshed && failureCount === 0) {
          
          console.log('[useQuery my-posts] Token refreshed, retrying...')
          return true
        }
       
        console.log('[useQuery my-posts] Token refresh failed, not retrying')
        return false
      }
      return failureCount < 1
    },
    staleTime: 2 * 60 * 1000, 
    gcTime: 5 * 60 * 1000, 
    refetchOnMount: false, 
    refetchOnWindowFocus: false, 
  })

  const { data: allReplies = [], isLoading: allRepliesLoading, error: allRepliesError } = useQuery({
    queryKey: ['profile', 'all-replies', accessToken], 
    queryFn: () => {
      console.log('[useQuery all-replies] Executing query with accessToken:', accessToken ? accessToken.substring(0, 20) + '...' : 'null')
      return fetchAllRepliesToMyPosts(accessToken)
    },
    enabled: !!accessToken && activeTab === 'replies',
    retry: (failureCount, error) => {
     
      if (error instanceof Error && (error as any).isUnauthorized) {
        if ((error as any).tokenRefreshed && failureCount === 0) {
          
          console.log('[useQuery all-replies] Token refreshed, retrying...')
          return true
        }
        
        console.log('[useQuery all-replies] Token refresh failed, not retrying')
        return false
      }
      return failureCount < 1
    },
    staleTime: 2 * 60 * 1000, 
    gcTime: 5 * 60 * 1000, 
    refetchOnMount: false, 
    refetchOnWindowFocus: false, 
  })

  const { data: pointHistory = [], isLoading: pointHistoryLoading, error: pointHistoryError } = useQuery({
    queryKey: ['profile', 'points-history', accessToken],
    queryFn: () => {
      console.log('[useQuery points-history] Executing query with accessToken:', accessToken ? accessToken.substring(0, 20) + '...' : 'null')
      return fetchPointHistory(accessToken, 100)
    },
    enabled: !!accessToken && activeTab === 'points-history',
    retry: (failureCount, error) => {
      if (error instanceof Error && (error as any).isUnauthorized) {
        if ((error as any).tokenRefreshed && failureCount === 0) {
          console.log('[useQuery points-history] Token refreshed, retrying...')
          return true
        }
        console.log('[useQuery points-history] Token refresh failed, not retrying')
        return false
      }
      return failureCount < 1
    },
    staleTime: 2 * 60 * 1000, 
    gcTime: 5 * 60 * 1000, 
    refetchOnMount: false, 
    refetchOnWindowFocus: false, 
  })

  const { mutate: reviewApplication, isPending: isReviewing } = useMutation({
    mutationFn: async (data: { applicationId: string; status: 'approved' | 'rejected' }) => {
      if (!accessToken) throw new Error('Please login to review applications')
      return apiFetch<LineGroupApplication>(`/line-groups/applications/${data.applicationId}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ status: data.status }),
        accessToken,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', 'managed-groups-applications'] })
      alert('Application reviewed successfully!')
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to review application'
      alert(message)
    },
  })


  if (!user) {
    return (
      <div className="min-h-screen bg-muted">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-primary/70 hover:text-primary transition"
            >
              ← Back to Forum
            </Link>
            <h1 className="text-3xl font-bold text-primary mt-4">{t('profile.title')}</h1>
          </div>
          <div className="bg-white rounded-2xl p-8 border border-primary/10 shadow-sm text-center">
            <p className="text-primary/70 mb-4">{t('common.login')}</p>
            <Link to="/login" className="text-accent hover:underline font-semibold">
              {t('common.login')}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-primary/70 hover:text-primary transition"
          >
            ← Back to Forum
          </Link>
          <h1 className="text-3xl font-bold text-primary mt-4">{t('profile.title')}</h1>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl border border-primary/10 shadow-sm mb-6">
          <div className="flex border-b border-primary/10 overflow-x-auto">
            {(['profile', 'my-posts', 'replies', 'group-requests', 'points-history'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-4 font-semibold transition capitalize ${
                  activeTab === tab
                    ? 'text-accent border-b-2 border-accent'
                    : 'text-primary/70 hover:text-primary hover:bg-primary/5'
                }`}
              >
                {tab === 'group-requests' 
                  ? t('profile.groupRequests')
                  : tab === 'my-posts' 
                    ? t('profile.myPosts')
                    : tab === 'replies' 
                      ? t('profile.myReplies')
                      : tab === 'points-history'
                        ? t('profile.pointsHistory')
                        : t('profile.title')}
              </button>
            ))}
          </div>
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-2xl p-6 border border-primary/10 shadow-sm">
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-warm/10 border border-warm/20 text-warm font-semibold">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 p-3 rounded-lg bg-accent/10 border border-accent/20 text-accent font-semibold">
                {success}
              </div>
            )}
            

            {isRefreshingProfile && (
              <div className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20 text-primary text-sm">
                <span className="inline-flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading profile from database...
                </span>
              </div>
            )}

            <div className="space-y-6">
              <div className="flex items-center gap-6">
                <div className="relative">
       
                  {profile?.avatar_url && profile.avatar_url.trim() !== '' ? (
                    <img
                      src={profile.avatar_url}
                      alt={displayUsername || 'User'}
                      className="w-24 h-24 rounded-full object-cover border-2 border-primary/10"
                      onError={(e) => {
                 
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                        const parent = target.parentElement
                        if (parent) {
                          const fallback = document.createElement('div')
                          fallback.className = 'w-24 h-24 rounded-full bg-[#1D4F91] flex items-center justify-center text-white font-bold text-2xl'
                          fallback.textContent = (displayUsername || 'M')[0]?.toUpperCase() || 'M'
                          parent.appendChild(fallback)
                        }
                      }}
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-[#1D4F91] flex items-center justify-center text-white font-bold text-2xl">
                      {(displayUsername || 'M')[0]?.toUpperCase() || 'M'}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center shadow-lg hover:bg-accent/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Change avatar"
                  >
                    {isUploadingAvatar ? (
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarFileChange}
                    className="hidden"
                  />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-primary">
                    {displayUsername || (isProfileLoading ? 'Loading...' : 'Member')}
                  </h2>
                  <p className="text-primary/60">{user.email}</p>
             
                  {import.meta.env.DEV && (
                    <p className="text-xs text-primary/40 mt-1">
                      Profile data: {isRefreshingProfile ? 'Loading from database...' : profile ? 'From database (via AuthContext)' : 'Not loaded'}
                    </p>
                  )}
                  
                  {/* Points, Level, Ranking */}
                  <div className="mt-4 flex flex-wrap gap-4">
                    {profileLoading ? (
                      <div className="text-sm text-primary/60">Loading...</div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-primary/70">Points:</span>
                          <span className="text-lg font-bold text-accent">{userProfile?.total_points || 0}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-primary/70">Level:</span>
                          <span className="text-lg font-bold text-warm">Level {userProfile?.level || 1}</span>
                        </div>
                        {rankingLoading ? (
                          <div className="text-sm text-primary/60">Loading ranking...</div>
                        ) : userRanking && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-primary/70">Ranking:</span>
                            <span className="text-lg font-bold text-sun">
                              #{userRanking.ranking} / {userRanking.total_users}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {!isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-primary mb-2">Username</label>
                    <p className="text-primary/70">{displayUsername || 'Not set'}</p>
                  </div>
      
                  <button
                    onClick={() => {
               
                      setEditingUsername(displayUsername || '')
                      setIsEditing(true)
                    }}
                    className="px-6 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-primary to-accent hover:shadow-lg transition"
                  >
                    Edit Profile
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    updateUserProfile()
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label htmlFor="username" className="block text-sm font-semibold text-primary mb-2">
                      Username
                    </label>
                    <input
                      id="username"
                      type="text"
                      value={editingUsername}
                      onChange={(e) => setEditingUsername(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-primary/15 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
                      placeholder="Enter your username"
                    />
                  </div>
             
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={isPending}
                      className="px-6 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-primary to-accent hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isPending ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                  
                        setEditingUsername(displayUsername || '')
                        setIsEditing(false)
                        setError(null)
                      }}
                      className="px-6 py-2.5 rounded-xl font-semibold text-primary border border-primary/15 hover:bg-primary/5 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* My Posts Tab */}
        {activeTab === 'my-posts' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-primary/10 shadow-sm">
              <div className="p-6 border-b border-primary/10">
                <h2 className="text-xl font-bold text-primary">My Posts</h2>
                <p className="text-sm text-primary/70 mt-1">
                  Posts you have created
                </p>
              </div>
              {myPostsLoading ? (
                <div className="p-8 text-center text-primary/60">Loading posts…</div>
              ) : myPostsError ? (
                <div className="p-8 text-center">
                  {myPostsError instanceof Error && (myPostsError as any).isUnauthorized ? (
                    <div className="space-y-3">
                      <p className="text-red-600 font-semibold text-lg">Session Expired</p>
                      <p className="text-primary/70 text-sm">
                        {(myPostsError as any).tokenRefreshFailed 
                          ? 'Your session has expired and could not be refreshed. Please log in again.'
                          : myPostsError.message || 'Invalid or expired token'}
                      </p>
                      <div className="flex gap-3 justify-center mt-4">
                        <Link
                          to="/login"
                          className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition font-medium"
                        >
                          Log In Again
                        </Link>
                        {(myPostsError as any).tokenRefreshed && (
                          <button
                            onClick={() => refetchMyPosts()}
                            className="px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition font-medium"
                          >
                            Retry
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-red-600">
                      <p className="font-semibold">Error loading posts</p>
                      <p className="text-sm text-primary/70 mt-1">
                        {myPostsError instanceof Error ? myPostsError.message : 'Unknown error'}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {myPostsData && myPostsData.items.length === 0 ? (
                    <div className="p-8 text-center text-primary/60">No posts yet</div>
                  ) : (
                    <>
                      <div className="divide-y divide-primary/5">
                        {myPostsData?.items.map((post) => (
                          <div key={post.id} className="p-6 hover:bg-primary/5 transition">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  {post.is_pinned && (
                                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-accent/20 text-accent">
                                      📌 Pinned
                                    </span>
                                  )}
                                  {post.is_closed && (
                                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-primary/20 text-primary">
                                      🔒 Closed
                                    </span>
                                  )}
                                </div>
                                <Link
                                  to={`/thread/${post.id}`}
                                  className="text-lg font-semibold text-primary hover:text-accent transition mb-2 block"
                                >
                                  {post.title}
                                </Link>
                                {post.summary && (
                                  <p className="text-sm text-primary/70 mb-2 line-clamp-2">{post.summary}</p>
                                )}
                                <div className="flex items-center gap-4 text-xs text-primary/60">
                                  <span>{post.reply_count} replies</span>
                                  <span>{post.view_count} views</span>
                                  <span>👍 {post.upvote_count}</span>
                                  <span>👎 {post.downvote_count}</span>
                                  <span>{new Date(post.created_at).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Pagination */}
                      {myPostsData && myPostsData.total_pages > 1 && (
                        <div className="p-6 border-t border-primary/10 flex items-center justify-between">
                          <div className="text-sm text-primary/60">
                            Page {myPostsData.page} of {myPostsData.total_pages} ({myPostsData.total} total)
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setMyPostsPage(p => Math.max(1, p - 1))}
                              disabled={myPostsPage === 1}
                              className="px-4 py-2 rounded-lg text-sm font-semibold text-primary border border-primary/15 hover:bg-primary/5 transition disabled:opacity-50"
                            >
                              Previous
                            </button>
                            <button
                              onClick={() => setMyPostsPage(p => Math.min(myPostsData.total_pages, p + 1))}
                              disabled={myPostsPage >= myPostsData.total_pages}
                              className="px-4 py-2 rounded-lg text-sm font-semibold text-primary border border-primary/15 hover:bg-primary/5 transition disabled:opacity-50"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Replies Tab */}
        {activeTab === 'replies' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-primary/10 shadow-sm">
              <div className="p-6 border-b border-primary/10">
                <h2 className="text-xl font-bold text-primary">Replies to My Posts</h2>
                <p className="text-sm text-primary/70 mt-1">
                  All comments on your posts
                </p>
              </div>
              {allRepliesLoading ? (
                <div className="p-8 text-center text-primary/60">Loading replies…</div>
              ) : (
                <>
                  {allReplies.length === 0 ? (
                    <div className="p-8 text-center text-primary/60">No replies yet</div>
                  ) : (
                    <div className="divide-y divide-primary/5">
                      {allReplies.map((reply) => {
                        // Find the post title from myPostsData
                        const post = myPostsData?.items.find(p => p.id === reply.post_id)
                        return (
                          <Link
                            key={reply.id}
                            to={`/thread/${reply.post_id}`}
                            state={{ fromProfile: true }}
                            className="block p-6 hover:bg-primary/5 transition cursor-pointer"
                          >
                            <div className="mb-3">
                              {post ? (
                                <div className="text-sm font-semibold text-accent hover:underline">
                                  Re: {post.title}
                                </div>
                              ) : (
                                <div className="text-sm font-semibold text-accent hover:underline">
                                  Re: Post #{reply.post_id}
                                </div>
                              )}
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="font-semibold text-primary text-sm">
                                    {reply.author?.username || 'Anonymous'}
                                  </span>
                                  <span className="text-xs text-primary/60">
                                    {new Date(reply.created_at).toLocaleString()}
                                  </span>
                                </div>
                                <p className="text-sm text-primary/70 whitespace-pre-wrap mb-2 line-clamp-3">{reply.content}</p>
                                <div className="flex items-center gap-3 text-xs text-primary/60">
                                  <span>👍 {reply.upvote_count}</span>
                                  <span>👎 {reply.downvote_count}</span>
                                </div>
                              </div>
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Points History Tab */}
        {activeTab === 'points-history' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-primary/10 shadow-sm">
              <div className="p-6 border-b border-primary/10">
                <h2 className="text-xl font-bold text-primary">Points History</h2>
                <p className="text-sm text-primary/70 mt-1">
                  Your points transaction history
                </p>
              </div>
              {pointHistoryLoading ? (
                <div className="p-8 text-center text-primary/60">Loading points history…</div>
              ) : pointHistoryError ? (
                <div className="p-8 text-center text-warm">
                  {pointHistoryError instanceof Error 
                    ? pointHistoryError.message 
                    : 'Failed to load points history'}
                </div>
              ) : (
                <>
                  {pointHistory.length === 0 ? (
                    <div className="p-8 text-center text-primary/60">No points history yet</div>
                  ) : (
                    <div className="divide-y divide-primary/5">
                      {pointHistory.map((record) => (
                        <div key={record.id} className="p-6 hover:bg-primary/5 transition">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span
                                  className={`text-lg font-bold ${
                                    record.points > 0 ? 'text-green-600' : 'text-red-600'
                                  }`}
                                >
                                  {record.points > 0 ? '+' : ''}{record.points}
                                </span>
                                <span className="text-sm text-primary/70">
                                  {record.reason}
                                </span>
                              </div>
                              <div className="text-xs text-primary/60">
                                {new Date(record.created_at).toLocaleString()}
                              </div>
                            </div>
                            <div
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                record.points > 0
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {record.points > 0 ? 'Earned' : 'Deducted'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Group Requests Tab */}
        {activeTab === 'group-requests' && (
          <div className="space-y-6">
            {/* My Creation Requests */}
            <div className="bg-white rounded-2xl border border-primary/10 shadow-sm">
              <div className="p-6 border-b border-primary/10">
                <h2 className="text-xl font-bold text-primary">My Group Creation Requests</h2>
                <p className="text-sm text-primary/70 mt-1">
                  Requests you submitted to create new LINE groups
                </p>
              </div>
              {creationRequestsLoading ? (
                <div className="p-8 text-center text-primary/60">Loading requests…</div>
              ) : (
                <div className="divide-y divide-primary/5">
                  {myCreationRequests.length === 0 ? (
                    <div className="p-8 text-center text-primary/60">No creation requests</div>
                  ) : (
                    myCreationRequests.map((request) => (
                      <div key={request.id} className="p-6">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="font-semibold text-primary mb-1 text-lg">{request.name}</div>
                            {request.description && (
                              <p className="text-sm text-primary/70 mb-2">{request.description}</p>
                            )}
                            <div className="text-sm text-primary/70 mb-2">
                              <strong>QR Code URL:</strong>{' '}
                              <a
                                href={request.qr_code_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-accent hover:underline"
                              >
                                {request.qr_code_url}
                              </a>
                            </div>
                            <div className="text-xs text-primary/60">
                              Submitted on {new Date(request.created_at).toLocaleString()}
                            </div>
                            {request.rejection_reason && (
                              <div className="text-sm text-red-600 mt-2">
                                <strong>Rejection Reason:</strong> {request.rejection_reason}
                              </div>
                            )}
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              request.status === 'approved'
                                ? 'bg-green-100 text-green-700'
                                : request.status === 'rejected'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {request.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Applications to My Managed Groups */}
            <div className="bg-white rounded-2xl border border-primary/10 shadow-sm">
              <div className="p-6 border-b border-primary/10">
                <h2 className="text-xl font-bold text-primary">Applications to My Groups</h2>
                <p className="text-sm text-primary/70 mt-1">
                  Users who applied to join groups you manage
                </p>
              </div>
              {applicationsLoading ? (
                <div className="p-8 text-center text-primary/60">Loading applications…</div>
              ) : (
                <div className="divide-y divide-primary/5">
                  {myManagedGroupsApplications.length === 0 ? (
                    <div className="p-8 text-center text-primary/60">No applications</div>
                  ) : (
                    myManagedGroupsApplications.map((application) => (
                      <div key={application.id} className="p-6">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="font-semibold text-primary mb-1">
                              {application.user?.username || 'Unknown User'} applied to{' '}
                              <span className="text-accent">{application.group?.name || 'Unknown Group'}</span>
                            </div>
                            {application.message && (
                              <p className="text-sm text-primary/70 mb-2 mt-2">{application.message}</p>
                            )}
                            <div className="text-xs text-primary/60">
                              Applied on {new Date(application.created_at).toLocaleString()}
                            </div>
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              application.status === 'approved'
                                ? 'bg-green-100 text-green-700'
                                : application.status === 'rejected'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {application.status}
                          </span>
                        </div>
                        {application.status === 'pending' && (
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => reviewApplication({ applicationId: application.id, status: 'approved' })}
                              disabled={isReviewing}
                              className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => reviewApplication({ applicationId: application.id, status: 'rejected' })}
                              disabled={isReviewing}
                              className="px-4 py-2 rounded-lg text-sm font-semibold text-warm border border-warm hover:bg-warm/10 transition disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
