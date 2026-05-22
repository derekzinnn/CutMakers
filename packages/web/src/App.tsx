import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { AdminPage } from './pages/admin/AdminPage'
import { EditorDashboard } from './pages/editor/EditorDashboard'
import { CreatorDashboard } from './pages/creator/CreatorDashboard'
import { EditorPublicProfile } from './pages/EditorPublicProfile'
import { OrderDetailPage } from './pages/orders/OrderDetailPage'

// ─── Guards ───────────────────────────────────────────────────────────────────

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token')
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

function RoleRoute({
  children,
  allowed,
}: {
  children: React.ReactNode
  allowed: ('CREATOR' | 'EDITOR' | 'BOTH' | 'ADMIN')[]
}) {
  const token = localStorage.getItem('token')
  if (!token) return <Navigate to="/login" replace />

  const stored = localStorage.getItem('user')
  const user = stored ? JSON.parse(stored) : null
  if (!user || !allowed.includes(user.role)) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Públicas */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Perfil público do editor — qualquer autenticado pode ver */}
        <Route
          path="/editors/:id"
          element={
            <PrivateRoute>
              <EditorPublicProfile />
            </PrivateRoute>
          }
        />

        {/* Admin */}
        <Route
          path="/admin"
          element={
            <RoleRoute allowed={['ADMIN']}>
              <AdminPage />
            </RoleRoute>
          }
        />

        {/* Creator dashboard */}
        <Route
          path="/dashboard/creator"
          element={
            <RoleRoute allowed={['CREATOR', 'BOTH', 'ADMIN']}>
              <CreatorDashboard />
            </RoleRoute>
          }
        />

        {/* Editor dashboard */}
        <Route
          path="/dashboard/editor"
          element={
            <RoleRoute allowed={['EDITOR', 'BOTH', 'ADMIN']}>
              <EditorDashboard />
            </RoleRoute>
          }
        />

        {/* Order detail — acessível para creator e editor */}
        <Route
          path="/orders/:id"
          element={
            <PrivateRoute>
              <OrderDetailPage />
            </PrivateRoute>
          }
        />

        {/* Fallback */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
