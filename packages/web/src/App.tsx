import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

// ─── Code splitting ───────────────────────────────────────────────────────────
// Cada página vira um chunk separado — o browser só baixa o que a rota atual usa,
// em vez do bundle inteiro no primeiro acesso.

const LandingPage = lazy(() => import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })))
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const RegisterPage = lazy(() => import('./pages/RegisterPage').then((m) => ({ default: m.RegisterPage })))
const AdminPage = lazy(() => import('./pages/admin/AdminPage').then((m) => ({ default: m.AdminPage })))
const EditorDashboard = lazy(() => import('./pages/editor/EditorDashboard').then((m) => ({ default: m.EditorDashboard })))
const CreatorDashboard = lazy(() => import('./pages/creator/CreatorDashboard').then((m) => ({ default: m.CreatorDashboard })))
const EditorPublicProfile = lazy(() => import('./pages/EditorPublicProfile').then((m) => ({ default: m.EditorPublicProfile })))
const OrderDetailPage = lazy(() => import('./pages/orders/OrderDetailPage').then((m) => ({ default: m.OrderDetailPage })))

function PageLoader() {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ background: '#0D1B2A' }}
    >
      <div
        className="h-8 w-8 animate-spin rounded-full"
        style={{ border: '3px solid rgba(244,99,30,0.2)', borderTopColor: '#F4631E' }}
      />
    </div>
  )
}

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
      <Suspense fallback={<PageLoader />}>
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

          {/* Landing — público */}
          <Route path="/" element={<LandingPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
