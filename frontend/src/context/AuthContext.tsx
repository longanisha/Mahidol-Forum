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
  refreshProfile: (forceRefresh?: boolean) => Promise<void>
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

  // Profile 
  const PROFILE_STORAGE_KEY = 'mahidol-forum-profile'

  // Load Profile
  const loadProfileFromStorage = useCallback((userId: string): ProfilesRow | null => {
    if (typeof window === 'undefined') return null
    try {
      const stored = sessionStorage.getItem(`${PROFILE_STORAGE_KEY}-${userId}`)
      if (stored) {
        const parsed = JSON.parse(stored)
        console.log('[AuthContext] Profile loaded from sessionStorage:', {
          id: parsed.id,
          username: parsed.username,
          avatar_url: parsed.avatar_url,
        })
        return parsed
      }
    } catch (error) {
      console.warn('[AuthContext] Failed to load profile from sessionStorage:', error)
    }
    return null
  }, [])

  // Save Profile to Session Storage
  const saveProfileToStorage = useCallback((userId: string, profileData: ProfilesRow | null) => {
    if (typeof window === 'undefined') return
    try {
      if (profileData) {
        sessionStorage.setItem(`${PROFILE_STORAGE_KEY}-${userId}`, JSON.stringify(profileData))
        console.log('[AuthContext] Profile saved to sessionStorage:', {
          id: profileData.id,
          username: profileData.username,
          avatar_url: profileData.avatar_url,
        })
      } else {
        sessionStorage.removeItem(`${PROFILE_STORAGE_KEY}-${userId}`)
        console.log('[AuthContext] Profile removed from sessionStorage')
      }
    } catch (error) {
      console.warn('[AuthContext] Failed to save profile to sessionStorage:', error)
    }
  }, [])

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, created_at, total_points, level')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.error('[AuthContext] Failed to load profile', error)
      return null
    }
    
    if (data) {
      console.log('[AuthContext] Profile loaded from Supabase:', {
        id: data.id,
        username: data.username,
        avatar_url: data.avatar_url,
        has_avatar_url: !!data.avatar_url,
      })

      saveProfileToStorage(userId, data)
    } else {
      console.log('[AuthContext] No profile data found for user:', userId)
    }
    
    return data
  }, [saveProfileToStorage])

  useEffect(() => {
    let mounted = true
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let sessionFromStateChange: Session | null = null

    if (typeof window !== 'undefined') {
      const navigationType = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      const isReload = navigationType?.type === 'reload'
      
      if (isReload) {
        sessionStorage.setItem('_page_refresh', 'true')
        console.log('[AuthContext] Page reload detected, preserving sessionStorage')
      } else {
        const hasRefreshFlag = sessionStorage.getItem('_page_refresh')
        if (!hasRefreshFlag) {
          sessionStorage.setItem('_page_refresh', 'false')
        }
      }
      
      const sessionKey = 'mahidol-forum-auth'
      const hasSession = sessionStorage.getItem(sessionKey)
      if (hasSession && isReload) {
        console.log('[AuthContext] Session found in sessionStorage on reload, will restore')
      }
    }

    const handlePageHide = (e: PageTransitionEvent) => {
      if (e.persisted) {
        return
      }
      
      try {
        const navigationType = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
        const isReload = navigationType?.type === 'reload'
        
        const hasRefreshFlag = sessionStorage.getItem('_page_refresh') === 'true'
        
        if (isReload || hasRefreshFlag) {
          return
        }
        
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
        console.error('[AuthContext] Error in handlePageHide:', error)
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', handlePageHide)
    }

    // Set up auth state change listener FIRST, before init
    // This way we can capture the session if it arrives before getSession() completes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!mounted) return
      
      console.log('[AuthContext] Auth state changed:', event, nextSession ? 'session exists' : 'no session')
      
      if (event === 'INITIAL_SESSION' && nextSession) {
        console.log('[AuthContext] ✅ INITIAL_SESSION event with session - this is a reload with existing session')
      }
      
      // Store session from state change for use in init
      // Always update sessionFromStateChange if we get a session
      if (nextSession) {
        console.log('[AuthContext] Storing session from auth state change for init')
        sessionFromStateChange = nextSession
      } else {
        // If session is null, also update to indicate we checked
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
          const storedProfile = loadProfileFromStorage(nextUser.id)
          if (storedProfile && mounted) {
            setProfile(storedProfile)
            console.log('[AuthContext] Profile loaded from sessionStorage (temporary)')
          }
          const profileData = await loadProfile(nextUser.id)
          if (mounted) {
            setProfile(profileData)
          }
        } catch (profileError) {
          console.error('[AuthContext] Failed to load profile on auth change', profileError)
          if (mounted) {
            setProfile(null)
            saveProfileToStorage(nextUser.id, null)
          }
        }
      } else {
        setProfile(null)
      }
      
      const navigationType = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      const isReload = navigationType?.type === 'reload'
      if (mounted) {
        if (nextSession || !isReload) {
          setLoading(false)
        } else {
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
        
        const navigationType = typeof window !== 'undefined' 
          ? (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming)
          : null
        const isReload = navigationType?.type === 'reload'
        
        const maxWaitTime = 1000 // 
        const startTime = Date.now()
        
        // Try to get session from Supabase (with shorter timeout for faster page load)
        let result: { data: { session: Session | null }; error: any } | null = null
        
        // First attempt: try getSession with a short timeout
        try {
          console.log('[AuthContext] Attempting to get session from Supabase...')
          
          if (typeof window !== 'undefined') {
            const sessionKey = 'mahidol-forum-auth'
            const hasStoredSession = sessionStorage.getItem(sessionKey)
            console.log('[AuthContext] SessionStorage has session data:', !!hasStoredSession)
            if (hasStoredSession) {
              console.log('[AuthContext] SessionStorage data length:', hasStoredSession.length)
            }
          }
          
          
          if (isReload) {

            console.log('[AuthContext] Page reload detected, waiting for Supabase to restore session...')

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
            await new Promise(resolve => setTimeout(resolve, 200)) //200ms
          }
          
          const sessionPromise = supabase.auth.getSession()
          

          const timeoutDuration = isReload ? 5000 : maxWaitTime // 5 
          
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
            if (isReload && typeof window !== 'undefined') {
              try {
                const sessionKey = 'mahidol-forum-auth'
                const storedSession = sessionStorage.getItem(sessionKey)
                if (storedSession) {
                  console.log('[AuthContext] Attempting to manually restore session from sessionStorage')
                  const parsedSession = JSON.parse(storedSession)
                  if (parsedSession && parsedSession.currentSession) {
                    console.log('[AuthContext] Found session in storage, will restore in background')

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
                if (isReload) {
                  console.log('[AuthContext] Reload detected, waiting for Supabase initialization...')
                  await new Promise(resolve => setTimeout(resolve, 500)) // 500ms
                }
                
                console.log('[AuthContext] Background session check starting...')
                const backgroundResult = await supabase.auth.getSession()
                if (backgroundResult.data?.session && mounted) {
                  console.log('[AuthContext] ✅ Got session in background')
                  setSession(backgroundResult.data.session)
                  setUser(backgroundResult.data.session.user ?? null)
                  if (backgroundResult.data.session.user) {
                    const userId = backgroundResult.data.session.user.id
                    const storedProfile = loadProfileFromStorage(userId)
                    if (storedProfile && mounted) {
                      setProfile(storedProfile)
                      console.log('[AuthContext] Profile loaded from sessionStorage (background check)')
                    }
                    loadProfile(userId).then(profileData => {
                      if (mounted) {
                        setProfile(profileData)
                      }
                    })
                  }
                } else if (isReload && mounted) {
                  console.log('[AuthContext] No session on first background check, will retry...')
                  setTimeout(async () => {
                    try {
                      await new Promise(resolve => setTimeout(resolve, 1000)) // 
                      const retryResult = await supabase.auth.getSession()
                      if (retryResult.data?.session && mounted) {
                        console.log('[AuthContext] ✅ Got session on retry')
                        setSession(retryResult.data.session)
                        setUser(retryResult.data.session.user ?? null)
                        if (retryResult.data.session.user) {
                          const userId = retryResult.data.session.user.id
                          const storedProfile = loadProfileFromStorage(userId)
                          if (storedProfile && mounted) {
                            setProfile(storedProfile)
                            console.log('[AuthContext] Profile loaded from sessionStorage (retry)')
                          }
                  
                          loadProfile(userId).then(profileData => {
                            if (mounted) {
                              setProfile(profileData)
                              
                            }
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
      
        const waitTime = isReload ? 2000 : maxWaitTime // 
        
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
       
        if (result === null || result?.data?.session === null) {
          // No session available - stop loading immediately to allow page render
          console.log('[AuthContext] No session found, stopping loading to allow page render')
          if (mounted) {
            
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
              
                const navigationType = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
                const isReload = navigationType?.type === 'reload'
                if (isReload) {
                  console.log('[AuthContext] Reload detected in background check, waiting for Supabase initialization...')
                  await new Promise(resolve => setTimeout(resolve, 500)) //  500ms
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
                  
                  console.log('[AuthContext] No session on first background check, will retry...')
                  setTimeout(async () => {
                    try {
                      await new Promise(resolve => setTimeout(resolve, 1000)) 
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
              const userId = initialSession.user.id
              console.log('[AuthContext] Loading profile for user:', userId)
              setLoading(false) // Set loading to false first
              
              const storedProfile = loadProfileFromStorage(userId)
              if (storedProfile && mounted) {
                setProfile(storedProfile)
                console.log('[AuthContext] Profile loaded from sessionStorage (initial session)')
              }
             
              const profileData = await loadProfile(userId)
              if (mounted) {
                setProfile(profileData)
                console.log('[AuthContext] Profile loaded:', profileData ? 'success' : 'not found')
                
              }
            } catch (profileError) {
              console.error('[AuthContext] Failed to load profile', profileError)
              if (mounted) {
                setProfile(null)
                if (initialSession.user?.id) {
                  saveProfileToStorage(initialSession.user.id, null)
                }
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

  const refreshProfile = useCallback(async (forceRefresh: boolean = false) => {
    if (!user?.id) {
      console.log('[AuthContext] No user to refresh profile for')
      return
    }
    try {
      console.log('[AuthContext] Refreshing profile for user:', user.id, forceRefresh ? '(FORCE REFRESH - no cache, ignore sessionStorage)' : '')
      

      if (forceRefresh) {
        console.log('[AuthContext] Force refresh: clearing sessionStorage profile to ensure fresh data from database')
        saveProfileToStorage(user.id, null)
        
      }
      
     
      try {
        const { apiFetch } = await import('../lib/api')
        const session = await supabase.auth.getSession()
        if (session.data?.session?.access_token) {
          console.log('[AuthContext] Fetching profile from backend API (no cache)...')
          
          const timestamp = Date.now()
          const apiProfile = await apiFetch<{
            id: string
            username: string | null
            avatar_url: string | null
            total_points: number
            level: number
            created_at: string
          }>(`/points/profile?t=${timestamp}`, {
            accessToken: session.data.session.access_token,
          
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0',
            },
          })
          
          if (apiProfile) {
         
            const profileData: ProfilesRow = {
              id: apiProfile.id,
              username: apiProfile.username,
              avatar_url: apiProfile.avatar_url,
              created_at: apiProfile.created_at,
            }
          
            setProfile(profileData)
            
            saveProfileToStorage(user.id, profileData)
            console.log('[AuthContext] ✅ Profile refreshed from API (database) and saved to sessionStorage:', {
              id: apiProfile.id,
              username: apiProfile.username,
              avatar_url: apiProfile.avatar_url,
              has_avatar_url: !!apiProfile.avatar_url,
            })
            return
          }
        }
      } catch (apiErr) {
        console.warn('[AuthContext] Failed to fetch profile from API, falling back to Supabase:', apiErr)
      }
      
    
      console.log('[AuthContext] Falling back to Supabase query (direct database query)...')
      const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => {
          console.warn('[AuthContext] Supabase profile query timeout after 5 seconds')
          resolve(null)
        }, 5000)
      })
      
      const profilePromise = loadProfile(user.id)
      const profileData = await Promise.race([profilePromise, timeoutPromise])
      
      if (profileData !== null) {
      
        setProfile(profileData)
        
        saveProfileToStorage(user.id, profileData)
        console.log('[AuthContext] ✅ Profile refreshed from Supabase (database) and saved to sessionStorage:', profileData ? 'success' : 'not found')
        console.log('[AuthContext] Profile avatar_url:', profileData?.avatar_url || 'none')
        console.log('[AuthContext] Profile username:', profileData?.username || 'none')
      } else {
        console.warn('[AuthContext] Profile refresh failed from both API and Supabase')
    
        if (!forceRefresh) {
          const storedProfile = loadProfileFromStorage(user.id)
          if (storedProfile) {
            console.log('[AuthContext] Using profile from sessionStorage as fallback (non-force refresh)')
            setProfile(storedProfile)
          }
        } else {
          console.error('[AuthContext] Force refresh failed: unable to get profile from database, not using sessionStorage cache')
        }
      }
    } catch (profileError) {
      console.error('[AuthContext] Failed to refresh profile', profileError)
     
      if (!forceRefresh) {
        
        const storedProfile = loadProfileFromStorage(user.id)
        if (storedProfile) {
          console.log('[AuthContext] Error occurred, using sessionStorage as fallback (non-force refresh)')
          setProfile(storedProfile)
        }
      }
    }
  }, [user?.id, loadProfile, saveProfileToStorage, loadProfileFromStorage])


  const updateProfile = useCallback((updates: Partial<ProfilesRow>) => {
    setProfile((prev) => {
      if (!prev) return prev
      const updated = { ...prev, ...updates }
      if (user?.id) {
        saveProfileToStorage(user.id, updated)
      }
      console.log('[AuthContext] Profile updated directly and saved to sessionStorage:', updates)
      return updated
    })
  }, [user?.id, saveProfileToStorage])
  

  const signOut = useCallback(async () => {
    console.log('[AuthContext] signOut called')
    try {
      const currentUserId = user?.id
      setSession(null)
      setUser(null)
      setProfile(null)
      if (currentUserId) {
        saveProfileToStorage(currentUserId, null)
      }
      
      if (typeof window !== 'undefined') {
        Object.keys(localStorage).forEach(key => {
          if (key.includes('supabase') || key.includes('auth') || key.includes('sb-')) {
            localStorage.removeItem(key)
          }
        })
        Object.keys(sessionStorage).forEach(key => {
          if (key.includes('supabase') || key.includes('auth') || key.includes('sb-') || key === 'mahidol-forum-auth' || key === '_page_refresh') {
            sessionStorage.removeItem(key)
          }
        })
        localStorage.removeItem('admin_id')
        localStorage.removeItem('admin_email')
        localStorage.removeItem('admin_username')
      }
      
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
      setSession(null)
      setUser(null)
      setProfile(null)
      if (typeof window !== 'undefined') {
        localStorage.clear() // localStorage
        sessionStorage.clear() // sessionStorage
      }
    }
  }, [])

  const accessToken = session?.access_token ?? null
  
 
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


