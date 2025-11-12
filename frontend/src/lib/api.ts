type FetchOptions = RequestInit & {
  accessToken?: string | null
  adminId?: string | null
  adminEmail?: string | null
}

const defaultBaseUrl = 'http://localhost:8000'

function normalizeBaseUrl(value: string | undefined | null): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  return trimmed.replace(/\/+$/g, '')
}

function getApiBaseUrl() {
  const candidates = [
    import.meta.env.VITE_API_BASE_URL,
    import.meta.env.VITE_API_URL, // backwards compatibility with older env files
  ]
  for (const candidate of candidates) {
    const normalized = normalizeBaseUrl(candidate)
    if (normalized) {
      return normalized
    }
  }
  return defaultBaseUrl
}

export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const baseUrl = getApiBaseUrl()
  const url = `${baseUrl}${path}`

  const headers = new Headers(options.headers ?? {})
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  if (options.accessToken) {
    console.log('[apiFetch] ====== Setting Authorization header ======')
    console.log('[apiFetch] Token length:', options.accessToken.length)
    console.log('[apiFetch] Token preview:', options.accessToken.substring(0, 50) + '...')
    console.log('[apiFetch] Token ends with:', '...' + options.accessToken.substring(options.accessToken.length - 20))
    const authHeader = `Bearer ${options.accessToken}`
    headers.set('Authorization', authHeader)
    console.log('[apiFetch] Authorization header set, length:', authHeader.length)
    console.log('[apiFetch] Authorization header preview:', authHeader.substring(0, 60) + '...')
  } else {
    // 某些端点不需要认证（如 /posts/, /announcements 等），所以没有 token 是正常的
    // 只在调试模式下输出信息日志
    if (import.meta.env.DEV) {
      console.log('[apiFetch] No accessToken provided for request to:', path, '(this may be normal for public endpoints)')
    }
  }
  
  // 支持 admin 认证（如果没有 accessToken）
  if (!options.accessToken && options.adminId && options.adminEmail) {
    headers.set('X-Admin-ID', options.adminId)
    headers.set('X-Admin-Email', options.adminEmail)
  }

  // 如果 options 中已经有 signal，则使用它；否则不设置超时限制
  let response: Response
  try {
    console.log('[apiFetch] ====== Sending request ======')
    console.log('[apiFetch] URL:', url)
    console.log('[apiFetch] Method:', options.method || 'GET')
    console.log('[apiFetch] Headers:', Object.fromEntries(headers.entries()))
    response = await fetch(url, {
      ...options,
      headers,
      signal: options.signal, // 只使用用户提供的 signal，不自动创建超时
    })
    console.log('[apiFetch] ====== Response received ======')
    console.log('[apiFetch] Status:', response.status, response.statusText)
    console.log('[apiFetch] OK:', response.ok)
  } catch (networkError) {
    const message =
      networkError instanceof Error
        ? `Unable to reach API at ${baseUrl}: ${networkError.message}`
        : `Unable to reach API at ${baseUrl}`
    throw new Error(message)
  }

  // Handle 204 No Content (empty response)
  if (response.status === 204) {
    if (!response.ok) {
      throw new Error(response.statusText || 'Request failed')
    }
    return null as T
  }

  // Read response text first (can only be read once)
  const responseText = await response.text()
  
  // Check if response has content
  const hasContent = responseText.trim().length > 0
  
  const contentType = response.headers.get('content-type') ?? ''
  const isJson = contentType.includes('application/json')
  
  let payload: any
  if (hasContent && isJson) {
    try {
      payload = JSON.parse(responseText)
    } catch (jsonError) {
      // If JSON parsing fails, throw a more descriptive error
      throw new Error(`Failed to parse JSON response: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`)
    }
  } else if (hasContent) {
    payload = responseText
  } else {
    payload = null
  }

  if (!response.ok) {
    // 处理 401 未授权错误（token 过期或无效）
    if (response.status === 401) {
      const message =
        typeof payload === 'object' && payload && 'detail' in payload
          ? String(payload.detail)
          : 'Your session has expired. Please log in again.'
      
      // 尝试刷新 token（如果可能）
      try {
        // 动态导入 supabase 以避免循环依赖
        const { supabase } = await import('./supabase')
        const { data: { session }, error: refreshError } = await supabase.auth.refreshSession()
        
        if (refreshError || !session) {
          // 刷新失败，token 已完全过期
          console.warn('[apiFetch] Token refresh failed:', refreshError?.message || 'No session')
          const error = new Error(message)
          ;(error as any).status = 401
          ;(error as any).isUnauthorized = true
          ;(error as any).tokenRefreshFailed = true
          throw error
        } else {
          // 刷新成功，但当前请求已经失败，需要调用方重试
          console.log('[apiFetch] Token refreshed successfully, but current request failed')
          const error = new Error(message)
          ;(error as any).status = 401
          ;(error as any).isUnauthorized = true
          ;(error as any).tokenRefreshed = true
          throw error
        }
      } catch (refreshErr) {
        // 刷新 token 时出错，token 已完全过期
        console.warn('[apiFetch] Token refresh error:', refreshErr)
        const error = new Error(message)
        ;(error as any).status = 401
        ;(error as any).isUnauthorized = true
        ;(error as any).tokenRefreshFailed = true
        throw error
      }
    }
    
    // 处理 403 禁止访问错误（权限不足）
    if (response.status === 403) {
      const message =
        typeof payload === 'object' && payload && 'detail' in payload
          ? String(payload.detail)
          : 'Access forbidden. You do not have permission to perform this action.'
      throw new Error(message)
    }
    
    // 处理 422 验证错误
    if (response.status === 422) {
      let message = 'Validation failed'
      if (typeof payload === 'object' && payload) {
        if ('detail' in payload) {
          // FastAPI 422 错误通常是数组格式
          if (Array.isArray(payload.detail)) {
            const errors = payload.detail.map((err: any) => {
              if (typeof err === 'object' && err.loc && err.msg) {
                return `${err.loc.join('.')}: ${err.msg}`
              }
              return String(err)
            })
            message = errors.join('; ')
          } else {
            message = String(payload.detail)
          }
        } else if ('message' in payload) {
          message = String(payload.message)
        }
      }
      throw new Error(message)
    }
    
    const message =
      typeof payload === 'object' && payload && 'detail' in payload
        ? String(payload.detail)
        : response.statusText || 'Request failed'
    throw new Error(message)
  }

  return payload as T
}

