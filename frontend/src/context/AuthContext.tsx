/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, type ProfilesRow } from '../lib/supabase'

type AuthContextValue = {
  session: Session | null
  user: User | null
  profile: ProfilesRow | null
  loading: boolean
  signOut: () => Promise<void>
  accessToken: string | null
  refreshProfile: () => Promise<void>
  updateProfile: (updates: Partial<ProfilesRow>) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

type AuthProviderProps = {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<ProfilesRow | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.error('Failed to load profile', error)
      return null
    }
    return data
  }, [])

  useEffect(() => {
    let mounted = true
    let timeoutId: NodeJS.Timeout | null = null
    let sessionFromStateChange: Session | null = null

    // 标记页面已刷新（用于 sessionStorage 适配器）
    if (typeof window !== 'undefined') {
      // 检查是否是页面刷新（包括强制刷新）
      const navigationType = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      const isReload = navigationType?.type === 'reload'
      
      if (isReload) {
        // 页面刷新（包括强制刷新）时，保留 sessionStorage，不清除
        sessionStorage.setItem('_page_refresh', 'true')
        console.log('[AuthContext] Page reload detected, preserving sessionStorage')
      } else {
        // 首次加载或导航
        const hasRefreshFlag = sessionStorage.getItem('_page_refresh')
        if (!hasRefreshFlag) {
          // 首次加载，设置标记
          sessionStorage.setItem('_page_refresh', 'false')
        }
      }
      
      // 确保 sessionStorage 中的 session 数据在刷新时保留
      // sessionStorage 在页面刷新时会自动保留，我们只需要确保不被意外清除
      const sessionKey = 'mahidol-forum-auth'
      const hasSession = sessionStorage.getItem(sessionKey)
      if (hasSession && isReload) {
        console.log('[AuthContext] Session found in sessionStorage on reload, will restore')
      }
    }

    // sessionStorage 在刷新时会自动保留，在关闭标签页时会自动清除
    // 我们不需要手动清除，依赖 sessionStorage 的自然行为即可
    // 但为了确保在关闭标签页时清除所有相关数据（包括可能的 localStorage 残留），
    // 我们只在真正关闭标签页时清除，刷新时不清除
    
    // 使用 pagehide 事件来检测页面关闭
    // pagehide 在刷新和关闭时都会触发，但我们可以通过检查 navigation type 来判断
    const handlePageHide = (e: PageTransitionEvent) => {
      // persisted 为 true 表示页面被 bfcache 缓存，不清除
      if (e.persisted) {
        return
      }
      
      // 检查是否是刷新：通过检查 navigation type
      // 注意：在 pagehide 事件中，navigation type 可能已经更新
      // 但我们可以通过检查是否有 _page_refresh 标记来判断
      // 如果是在刷新时，这个标记应该在页面加载时就被设置了
      try {
        const navigationType = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
        const isReload = navigationType?.type === 'reload'
        
        // 检查是否有刷新标记（在页面加载时设置）
        const hasRefreshFlag = sessionStorage.getItem('_page_refresh') === 'true'
        
        // 如果是刷新，不清除 sessionStorage（让它自然保留）
        if (isReload || hasRefreshFlag) {
          return
        }
        
        // 否则，可能是关闭标签页
        // 虽然 sessionStorage 会自动清除，但我们手动清除以确保清除所有相关数据
        // 包括可能的 localStorage 残留
        const keysToRemove: string[] = []
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i)
          if (key && (key.includes('supabase') || key.includes('auth') || key.includes('sb-') || key === 'mahidol-forum-auth')) {
            keysToRemove.push(key)
          }
        }
        keysToRemove.forEach(key => sessionStorage.removeItem(key))
        sessionStorage.removeItem('_page_refresh')
      } catch (error) {
        // 如果检查失败，保守处理：不清除（让 sessionStorage 自然行为）
        console.error('[AuthContext] Error in handlePageHide:', error)
      }
    }

    if (typeof window !== 'undefined') {
      // 只监听 pagehide，不监听 beforeunload（因为 beforeunload 在刷新时也会触发）
      window.addEventListener('pagehide', handlePageHide)
    }

    // Set up auth state change listener FIRST, before init
    // This way we can capture the session if it arrives before getSession() completes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!mounted) return
      
      console.log('[AuthContext] Auth state changed:', event, nextSession ? 'session exists' : 'no session')
      
      // 对于 INITIAL_SESSION 事件（通常在刷新时触发），确保捕获 session
      if (event === 'INITIAL_SESSION' && nextSession) {
        console.log('[AuthContext] ✅ INITIAL_SESSION event with session - this is a reload with existing session')
      }
      
      // Store session from state change for use in init
      // IMPORTANT: Always update sessionFromStateChange if we get a session
      if (nextSession) {
        console.log('[AuthContext] Storing session from auth state change for init')
        sessionFromStateChange = nextSession
      } else {
        // If session is null, also update to indicate we checked
        // 但在刷新时，如果 sessionStorage 中有数据，可能是 Supabase 还没恢复，不要立即设为 null
        const navigationType = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
        const isReload = navigationType?.type === 'reload'
        if (!isReload || event === 'SIGNED_OUT') {
          sessionFromStateChange = null
        } else {
          console.log('[AuthContext] Session is null on reload, but may be restored later')
        }
      }
      
      setSession(nextSession)
      const nextUser = nextSession?.user ?? null
      setUser(nextUser)

      if (nextUser) {
        try {
          console.log('[AuthContext] Loading profile on auth change for user:', nextUser.id)
          const profileData = await loadProfile(nextUser.id)
          if (mounted) {
            setProfile(profileData)
          }
        } catch (profileError) {
          console.error('[AuthContext] Failed to load profile on auth change', profileError)
          if (mounted) {
            setProfile(null)
          }
        }
      } else {
        setProfile(null)
      }
      
      // Always stop loading when auth state changes (whether session exists or not)
      // 但在刷新时，如果还没有 session，不要立即停止 loading，给更多时间恢复
      const navigationType = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      const isReload = navigationType?.type === 'reload'
      if (mounted) {
        if (nextSession || !isReload) {
          setLoading(false)
        } else {
          // 刷新时如果没有 session，等待一段时间再停止 loading
          setTimeout(() => {
            if (mounted) {
              setLoading(false)
            }
          }, 500)
        }
      }
    })

    async function init() {
      try {
        setLoading(true)
        
        console.log('[AuthContext] Initializing auth...')
        
        // 检查是否是页面刷新（在函数开始时就确定，避免重复声明）
        const navigationType = typeof window !== 'undefined' 
          ? (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming)
          : null
        const isReload = navigationType?.type === 'reload'
        
        // 设置一个较短的超时（1秒），确保页面不会长时间阻塞
        const maxWaitTime = 1000 // 1秒超时
        const startTime = Date.now()
        
        // Try to get session from Supabase (with shorter timeout for faster page load)
        let result: { data: { session: Session | null }; error: any } | null = null
        
        // First attempt: try getSession with a short timeout
        try {
          console.log('[AuthContext] Attempting to get session from Supabase...')
          
          // 检查 sessionStorage 中是否有 session 数据（用于调试）
          if (typeof window !== 'undefined') {
            const sessionKey = 'mahidol-forum-auth'
            const hasStoredSession = sessionStorage.getItem(sessionKey)
            console.log('[AuthContext] SessionStorage has session data:', !!hasStoredSession)
            if (hasStoredSession) {
              console.log('[AuthContext] SessionStorage data length:', hasStoredSession.length)
            }
          }
          
          // 在刷新时，先等待一小段时间让 Supabase 初始化完成
          
          if (isReload) {
            // 强制刷新时，等待 Supabase 从 sessionStorage 恢复 session
            console.log('[AuthContext] Page reload detected, waiting for Supabase to restore session...')
            // 检查 sessionStorage 中是否有 session 数据
            const sessionKey = 'mahidol-forum-auth'
            const storedSession = sessionStorage.getItem(sessionKey)
            if (storedSession) {
              console.log('[AuthContext] Found session data in sessionStorage, length:', storedSession.length)
              try {
                const parsed = JSON.parse(storedSession)
                if (parsed?.currentSession) {
                  console.log('[AuthContext] Session data structure looks valid')
                }
              } catch (e) {
                console.log('[AuthContext] Could not parse session data:', e)
              }
            } else {
              console.log('[AuthContext] ⚠️ No session data found in sessionStorage on reload')
            }
            await new Promise(resolve => setTimeout(resolve, 200)) // 等待 200ms
          }
          
          const sessionPromise = supabase.auth.getSession()
          
          // 在刷新时，给更多时间让 Supabase 从 sessionStorage 恢复 session
          const timeoutDuration = isReload ? 5000 : maxWaitTime // 刷新时给 5 秒
          
          const timeoutPromise = new Promise<null>((resolve) => {
            timeoutId = setTimeout(() => {
              console.log('[AuthContext] ⚠️ getSession timeout, stopping loading to allow page render')
              resolve(null)
            }, timeoutDuration)
          })
          
          const sessionResult = await Promise.race([sessionPromise, timeoutPromise]) as any
          
          if (timeoutId) {
            clearTimeout(timeoutId)
            timeoutId = null
          }
          
          // If we got a result from getSession (not timeout)
          if (sessionResult && sessionResult.data !== undefined) {
            result = sessionResult
            console.log('[AuthContext] ✅ Got session from getSession:', result.data?.session ? 'session exists' : 'no session')
            if (result.data?.session) {
              console.log('[AuthContext] Session user ID:', result.data.session.user?.id)
              console.log('[AuthContext] Session expires at:', result.data.session.expires_at)
            }
          } else {
            console.log('[AuthContext] getSession timed out or returned null, will continue in background')
            // 如果是刷新且超时，尝试直接从 sessionStorage 读取并手动恢复
            if (isReload && typeof window !== 'undefined') {
              try {
                const sessionKey = 'mahidol-forum-auth'
                const storedSession = sessionStorage.getItem(sessionKey)
                if (storedSession) {
                  console.log('[AuthContext] Attempting to manually restore session from sessionStorage')
                  const parsedSession = JSON.parse(storedSession)
                  if (parsedSession && parsedSession.currentSession) {
                    console.log('[AuthContext] Found session in storage, will restore in background')
                    // 继续在后台恢复
                  }
                }
              } catch (parseError) {
                console.warn('[AuthContext] Failed to parse stored session:', parseError)
              }
            }
          }
        } catch (err) {
          console.error('[AuthContext] Error during session fetch:', err)
          result = null
        }
        
        // Check if we've exceeded max wait time
        const elapsed = Date.now() - startTime
        if (elapsed >= maxWaitTime && !result?.data?.session && !sessionFromStateChange) {
          console.log('[AuthContext] Max wait time reached, stopping loading to allow page render')
          // Stop loading immediately to allow page to render
          if (mounted) {
            setLoading(false)
            // Continue session check in background (especially important for reloads)
            setTimeout(async () => {
              try {
                // 如果是刷新，等待更长时间让 Supabase 完全初始化
                if (isReload) {
                  console.log('[AuthContext] Reload detected, waiting for Supabase initialization...')
                  await new Promise(resolve => setTimeout(resolve, 500)) // 等待 500ms
                }
                
                console.log('[AuthContext] Background session check starting...')
                const backgroundResult = await supabase.auth.getSession()
                if (backgroundResult.data?.session && mounted) {
                  console.log('[AuthContext] ✅ Got session in background')
                  setSession(backgroundResult.data.session)
                  setUser(backgroundResult.data.session.user ?? null)
                  if (backgroundResult.data.session.user) {
                    loadProfile(backgroundResult.data.session.user.id).then(profileData => {
                      if (mounted) setProfile(profileData)
                    })
                  }
                } else if (isReload && mounted) {
                  // 如果是刷新且第一次检查失败，再等待并重试一次
                  console.log('[AuthContext] No session on first background check, will retry...')
                  setTimeout(async () => {
                    try {
                      await new Promise(resolve => setTimeout(resolve, 1000)) // 再等待 1 秒
                      const retryResult = await supabase.auth.getSession()
                      if (retryResult.data?.session && mounted) {
                        console.log('[AuthContext] ✅ Got session on retry')
                        setSession(retryResult.data.session)
                        setUser(retryResult.data.session.user ?? null)
                        if (retryResult.data.session.user) {
                          loadProfile(retryResult.data.session.user.id).then(profileData => {
                            if (mounted) setProfile(profileData)
                          })
                        }
                      } else if (mounted) {
                        console.log('[AuthContext] No session found after retry')
                      }
                    } catch (retryErr) {
                      console.error('[AuthContext] Retry session check failed:', retryErr)
                    }
                  }, 0)
                }
              } catch (bgErr) {
                console.error('[AuthContext] Background session check failed:', bgErr)
              }
            }, 0)
          }
          return
        }
        
        // If still no result and we have time, wait briefly for onAuthStateChange to fire
        // 在刷新时，给更多时间等待 INITIAL_SESSION 事件
        const waitTime = isReload ? 2000 : maxWaitTime // 刷新时等待 2 秒
        
        if ((result === null || result?.data?.session === null) && !sessionFromStateChange && elapsed < waitTime) {
          const remainingTime = waitTime - elapsed
          const waitIterations = Math.min(20, Math.floor(remainingTime / 100)) // Max 20 iterations for reload
          console.log('[AuthContext] Waiting for auth state change event (up to', remainingTime, 'ms)...')
          for (let i = 0; i < waitIterations; i++) {
            await new Promise(resolve => setTimeout(resolve, 100))
            if (sessionFromStateChange) {
              console.log('[AuthContext] ✅ Session received from auth state change')
              result = {
                data: { session: sessionFromStateChange },
                error: null,
              }
              break
            }
            if (!mounted) return
            if (Date.now() - startTime >= waitTime) break
          }
        } else if (sessionFromStateChange) {
          console.log('[AuthContext] ✅ Using session from auth state change event')
          result = {
            data: { session: sessionFromStateChange },
            error: null,
          }
        }

        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }

        // Process the result
        // 在刷新时，即使没有 session，也不要立即清除状态，给更多时间恢复
        if (result === null || result?.data?.session === null) {
          // No session available - stop loading immediately to allow page render
          console.log('[AuthContext] No session found, stopping loading to allow page render')
          if (mounted) {
            // 在刷新时，不要立即清除 session/user，给后台恢复机会
            if (!isReload) {
              setSession(null)
              setUser(null)
              setProfile(null)
            } else {
              console.log('[AuthContext] Reload detected - keeping state for potential recovery')
            }
            setLoading(false)
          }
          // Continue checking in background if we have a session from state change
          if (sessionFromStateChange) {
            setTimeout(() => {
              if (mounted) {
                console.log('[AuthContext] ✅ Got session from state change in background')
                setSession(sessionFromStateChange)
                setUser(sessionFromStateChange.user ?? null)
                if (sessionFromStateChange.user) {
                  loadProfile(sessionFromStateChange.user.id).then(profileData => {
                    if (mounted) setProfile(profileData)
                  })
                }
              }
            }, 0)
          } else {
            // Continue checking in background (especially important for reloads)
            setTimeout(async () => {
              try {
                // 如果是刷新，等待更长时间让 Supabase 完全初始化
                const navigationType = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
                const isReload = navigationType?.type === 'reload'
                if (isReload) {
                  console.log('[AuthContext] Reload detected in background check, waiting for Supabase initialization...')
                  await new Promise(resolve => setTimeout(resolve, 500)) // 等待 500ms
                }
                
                console.log('[AuthContext] Background session check starting...')
                const backgroundResult = await supabase.auth.getSession()
                if (backgroundResult.data?.session && mounted) {
                  console.log('[AuthContext] ✅ Got session in background')
                  setSession(backgroundResult.data.session)
                  setUser(backgroundResult.data.session.user ?? null)
                  if (backgroundResult.data.session.user) {
                    loadProfile(backgroundResult.data.session.user.id).then(profileData => {
                      if (mounted) setProfile(profileData)
                    })
                  }
                } else if (isReload && mounted) {
                  // 如果是刷新且第一次检查失败，再等待并重试一次
                  console.log('[AuthContext] No session on first background check, will retry...')
                  setTimeout(async () => {
                    try {
                      await new Promise(resolve => setTimeout(resolve, 1000)) // 再等待 1 秒
                      const retryResult = await supabase.auth.getSession()
                      if (retryResult.data?.session && mounted) {
                        console.log('[AuthContext] ✅ Got session on retry')
                        setSession(retryResult.data.session)
                        setUser(retryResult.data.session.user ?? null)
                        if (retryResult.data.session.user) {
                          loadProfile(retryResult.data.session.user.id).then(profileData => {
                            if (mounted) setProfile(profileData)
                          })
                        }
                      } else {
                        console.log('[AuthContext] No session found after retry')
                      }
                    } catch (retryErr) {
                      console.error('[AuthContext] Retry session check failed:', retryErr)
                    }
                  }, 0)
                }
              } catch (bgErr) {
                console.error('[AuthContext] Background session check failed:', bgErr)
              }
            }, 0)
          }
          return
        }

        const {
          data: { session: initialSession },
          error,
        } = result

        if (error) {
          console.error('[AuthContext] Failed to get session', error)
          if (mounted) {
            setSession(null)
            setUser(null)
            setProfile(null)
            setLoading(false)
          }
          return
        }

        if (!mounted) return

        if (initialSession) {
          console.log('[AuthContext] ✅ Session retrieved successfully')
          setSession(initialSession)
          setUser(initialSession.user ?? null)
          
          if (initialSession.user) {
            try {
              console.log('[AuthContext] Loading profile for user:', initialSession.user.id)
              setLoading(false) // Set loading to false first
              const profileData = await loadProfile(initialSession.user.id)
              if (mounted) {
                setProfile(profileData)
                console.log('[AuthContext] Profile loaded:', profileData ? 'success' : 'not found')
              }
            } catch (profileError) {
              console.error('[AuthContext] Failed to load profile', profileError)
              if (mounted) {
                setProfile(null)
              }
            }
          } else {
            setProfile(null)
            if (mounted) {
              setLoading(false)
            }
          }
        } else {
          setSession(null)
          setUser(null)
          setProfile(null)
          if (mounted) {
            setLoading(false)
          }
        }
      } catch (err) {
        console.error('[AuthContext] Auth initialization error', err)
        if (mounted) {
          setSession(null)
          setUser(null)
          setProfile(null)
          setLoading(false)
        }
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
        // Final safety check - ensure loading stops after max wait time (1.1 seconds)
        if (mounted) {
          setTimeout(() => {
            if (mounted) {
              setLoading(false)
            }
          }, 1100) // Ensure loading stops even if something went wrong (1.1 seconds)
        }
      }
    }

    // Start initialization
    init()

    return () => {
      mounted = false
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      subscription.unsubscribe()
      if (typeof window !== 'undefined') {
        window.removeEventListener('pagehide', handlePageHide)
      }
    }
  }, [loadProfile])

  const refreshProfile = useCallback(async () => {
    if (!user?.id) {
      console.log('[AuthContext] No user to refresh profile for')
      return
    }
    try {
      console.log('[AuthContext] Refreshing profile for user:', user.id)
      // 使用 Promise.race 添加超时保护（2秒超时，更快响应）
      const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => {
          console.warn('[AuthContext] Profile refresh timeout after 2 seconds')
          resolve(null)
        }, 2000)
      })
      
      const profilePromise = loadProfile(user.id)
      const profileData = await Promise.race([profilePromise, timeoutPromise])
      
      if (profileData !== null) {
        setProfile(profileData)
        console.log('[AuthContext] Profile refreshed:', profileData ? 'success' : 'not found')
        console.log('[AuthContext] Profile avatar_url:', profileData?.avatar_url || 'none')
      } else {
        console.warn('[AuthContext] Profile refresh timed out or returned null')
        // 即使超时，也尝试从 API 获取最新的 avatar_url
        try {
          const { apiFetch } = await import('../lib/api')
          const session = await supabase.auth.getSession()
          if (session.data?.session?.access_token) {
            const apiProfile = await apiFetch<{ avatar_url?: string | null }>('/points/profile', {
              accessToken: session.data.session.access_token,
            })
            if (apiProfile?.avatar_url !== undefined) {
              setProfile((prev) => prev ? { ...prev, avatar_url: apiProfile.avatar_url } : null)
              console.log('[AuthContext] Updated avatar_url from API:', apiProfile.avatar_url)
            }
          }
        } catch (apiErr) {
          console.warn('[AuthContext] Failed to fetch avatar from API:', apiErr)
        }
      }
    } catch (profileError) {
      console.error('[AuthContext] Failed to refresh profile', profileError)
      // 不抛出错误，避免影响 UI
    }
  }, [user?.id, loadProfile])

  // 直接更新 profile 的方法，用于立即更新 UI（如头像更新）
  const updateProfile = useCallback((updates: Partial<ProfilesRow>) => {
    setProfile((prev) => {
      if (!prev) return prev
      return { ...prev, ...updates }
    })
    console.log('[AuthContext] Profile updated directly:', updates)
  }, [])

  const signOut = useCallback(async () => {
    console.log('[AuthContext] signOut called')
    try {
      // 先清除所有状态
      setSession(null)
      setUser(null)
      setProfile(null)
      
      // 清除所有存储（包括 localStorage 和 sessionStorage）
      if (typeof window !== 'undefined') {
        // 清除 localStorage 中的 Supabase 相关
        Object.keys(localStorage).forEach(key => {
          if (key.includes('supabase') || key.includes('auth') || key.includes('sb-')) {
            localStorage.removeItem(key)
          }
        })
        // 清除 sessionStorage 中的 Supabase 相关
        Object.keys(sessionStorage).forEach(key => {
          if (key.includes('supabase') || key.includes('auth') || key.includes('sb-') || key === 'mahidol-forum-auth' || key === '_page_refresh') {
            sessionStorage.removeItem(key)
          }
        })
        // 清除 admin 相关
        localStorage.removeItem('admin_id')
        localStorage.removeItem('admin_email')
        localStorage.removeItem('admin_username')
      }
      
      // 然后调用 Supabase signOut（即使失败也继续）
      try {
        const { error } = await supabase.auth.signOut()
        if (error) {
          console.warn('[AuthContext] Supabase signOut error (ignored):', error)
        } else {
          console.log('[AuthContext] Supabase signOut successful')
        }
      } catch (supabaseError) {
        console.warn('[AuthContext] Supabase signOut exception (ignored):', supabaseError)
      }
      
      console.log('[AuthContext] Sign out completed, state cleared')
    } catch (err) {
      console.error('[AuthContext] Sign out error:', err)
      // 即使出错也清除状态
      setSession(null)
      setUser(null)
      setProfile(null)
      if (typeof window !== 'undefined') {
        localStorage.clear() // 清除所有 localStorage
        sessionStorage.clear() // 清除所有 sessionStorage
      }
    }
  }, [])

  const accessToken = session?.access_token ?? null
  
  // 添加调试日志
  useEffect(() => {
    if (session) {
      console.log('[AuthContext] ====== Session updated ======')
      console.log('[AuthContext] Session exists:', !!session)
      console.log('[AuthContext] Access token length:', session.access_token?.length || 0)
      console.log('[AuthContext] Access token preview:', session.access_token?.substring(0, 50) + '...' || 'null')
      console.log('[AuthContext] User ID:', session.user?.id || 'null')
      console.log('[AuthContext] Token expires at:', session.expires_at || 'null')
    } else {
      console.log('[AuthContext] ====== Session is null ======')
    }
  }, [session])

  const value = useMemo<AuthContextValue>(
    () => ({ session, user, profile, loading, signOut, accessToken, refreshProfile, updateProfile }),
    [session, user, profile, loading, signOut, accessToken, refreshProfile, updateProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}


