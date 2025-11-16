import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import './i18n/config'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes - 数据在5分钟内被认为是新鲜的
      gcTime: 10 * 60 * 1000, // 10 minutes - 缓存时间（原 cacheTime）
      refetchOnWindowFocus: false, // 窗口聚焦时不自动重新获取
      refetchOnReconnect: true, // 网络重连时重新获取
      retry: 1, // 失败时只重试1次
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
