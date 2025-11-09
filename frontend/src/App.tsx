import { Routes, Route, Navigate } from 'react-router-dom'
import { MainLayout } from './components/layout/MainLayout'
import { HomePage } from './pages/HomePage'
import { ThreadPage } from './pages/ThreadPage'
import { AnnouncementPage } from './pages/AnnouncementPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { LineGroupPage } from './pages/LineGroupPage'
import { AdminPage } from './pages/AdminPage'
import { AdminLoginPage } from './pages/AdminLoginPage'
import { SuperAdminPage } from './pages/SuperAdminPage'
import { SuperAdminLoginPage } from './pages/SuperAdminLoginPage'
import { CreateThreadPage } from './pages/CreateThreadPage'
import { ProfilePage } from './pages/ProfilePage'
import { ProtectedRoute } from './components/ProtectedRoute'
import './App.css'

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <MainLayout>
            <HomePage />
          </MainLayout>
        }
      />

      <Route
        path="/thread/:id"
        element={
          <MainLayout>
            <ThreadPage />
          </MainLayout>
        }
      />

      <Route
        path="/announcement/:id"
        element={
          <MainLayout>
            <AnnouncementPage />
          </MainLayout>
        }
      />

      <Route
        path="/line-group"
        element={
          <MainLayout>
            <LineGroupPage />
          </MainLayout>
        }
      />

      <Route
        path="/admin/login"
        element={
          <MainLayout showHeader={false} showFooter={false}>
            <AdminLoginPage />
          </MainLayout>
        }
      />

      <Route
        path="/admin"
        element={
          <MainLayout showHeader={false} showFooter={false}>
            <AdminPage />
          </MainLayout>
        }
      />

      <Route
        path="/superadmin/login"
        element={
          <MainLayout showHeader={false} showFooter={false}>
            <SuperAdminLoginPage />
          </MainLayout>
        }
      />

      <Route
        path="/superadmin"
        element={
          <ProtectedRoute>
            <MainLayout>
              <SuperAdminPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/login"
        element={
          <MainLayout showHeader={false} showFooter={false}>
            <LoginPage />
          </MainLayout>
        }
      />

      <Route
        path="/register"
        element={
          <MainLayout showHeader={false} showFooter={false}>
            <RegisterPage />
          </MainLayout>
        }
      />

      <Route
        path="/create-thread"
        element={
          <ProtectedRoute>
            <MainLayout>
              <CreateThreadPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <MainLayout>
              <ProfilePage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

