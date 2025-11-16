import { createClient } from '@supabase/supabase-js'

const fallbackUrl = 'https://miwhruqwrhbppaxexptc.supabase.co'
const fallbackAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pd2hydXF3cmhicHBheGV4cHRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNzg0OTUsImV4cCI6MjA3Njc1NDQ5NX0.sWtOHZuBau1EVFMv5m1q4DF_0_A4cKqcMgNAb55RiTw'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || fallbackUrl
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || fallbackAnonKey

// Validate that we have the required keys
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase] Missing required environment variables:', {
    url: !!supabaseUrl,
    key: !!supabaseAnonKey,
  })
}


const sessionStorageAdapter = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null
    try {
      
      const sessionValue = sessionStorage.getItem(key)
      if (sessionValue) {
        console.log('[Supabase] Found session in sessionStorage')
        return sessionValue
      }
      
      
      const localValue = localStorage.getItem(key)
      if (localValue) {
        console.log('[Supabase] Migrating token from localStorage to sessionStorage')
        sessionStorage.setItem(key, localValue)
        
        sessionStorage.setItem('_page_refresh', 'true')
        return localValue
      }
      
      console.log('[Supabase] No session found in storage')
      return null
    } catch (error) {
      console.error('[Supabase] Error reading from storage:', error)
      return null
    }
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined') return
    try {
      sessionStorage.setItem(key, value)
  
      sessionStorage.setItem('_page_refresh', 'true')
      console.log('[Supabase] Session saved to sessionStorage')
    } catch (error) {
      console.error('[Supabase] Error writing to storage:', error)
    }
  },
  removeItem: (key: string): void => {
    if (typeof window === 'undefined') return
    try {
      sessionStorage.removeItem(key)
      localStorage.removeItem(key)
      console.log('[Supabase] Session removed from storage')
    } catch (error) {
      console.error('[Supabase] Error removing from storage:', error)
    }
  },
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storage: sessionStorageAdapter,
    storageKey: 'mahidol-forum-auth',
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storageSync: true,
  },
  global: {
    headers: {
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
  },
  db: {
    schema: 'public',
  },
})

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type ProfilesRow = Tables<'profiles'>
export type ThreadsRow = Tables<'threads'>
export type PostsRow = Tables<'posts'>
export type LineApplicationsRow = Tables<'line_applications'>

type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string | null
          avatar_url: string | null
          created_at: string
        }
        Insert: {
          id: string
          username?: string | null
          avatar_url?: string | null
        }
        Update: {
          username?: string | null
          avatar_url?: string | null
        }
      }
      threads: {
        Row: {
          id: string
          title: string
          category: string | null
          summary: string | null
          cover_image_url: string | null
          author_id: string
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          title: string
          category?: string | null
          summary?: string | null
          cover_image_url?: string | null
          author_id: string
        }
        Update: {
          title?: string
          category?: string | null
          summary?: string | null
          cover_image_url?: string | null
        }
      }
      posts: {
        Row: {
          id: string
          content: string
          thread_id: string
          author_id: string
          created_at: string
        }
        Insert: {
          id?: string
          content: string
          thread_id: string
          author_id: string
        }
        Update: {
          content?: string
        }
      }
      line_applications: {
        Row: {
          id: string
          user_id: string
          message: string
          status: 'pending' | 'approved' | 'rejected'
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          message: string
          status?: 'pending' | 'approved' | 'rejected'
        }
        Update: {
          status?: 'pending' | 'approved' | 'rejected'
          message?: string
        }
      }
    }
  }
}


