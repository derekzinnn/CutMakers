import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { AdminPage } from './pages/admin/AdminPage'

// ─── Guards ───────────────────────────────────────────────────────────────────

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token')
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token')
  if (!token) return <Navigate to="/login" replace />

  const stored = localStorage.getItem('user')
  const user = stored ? JSON.parse(stored) : null
  if (user?.role !== 'ADMIN') return <Navigate to="/login" replace />

  return <>{children}</>
}

// ─── Placeholder para Fase 2 ──────────────────────────────────────────────────

function ComingSoon({ title }: { title: string }) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4"
      style={{ background: '#0D1B2A' }}
    >
      <div className="text-center">
        <h1
          className="text-3xl font-bold text-white"
          style={{ fontFamily: "'Syne', sans-serif" }}
        >
          {title}
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Em desenvolvimento — Fase 2
        </p>
      </div>
      <a
        href="/login"
        className="text-sm hover:underline"
        style={{ color: '#F4631E' }}
        onClick={() => { localStorage.clear() }}
      >
        ← Sair
      </a>
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Públicas */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Admin — apenas role ADMIN */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          }
        />

        {/* Creator — Fase 2 */}
        <Route
          path="/dashboard/creator"
          element={
            <PrivateRoute>
              <ComingSoon title="Dashboard Creator" />
            </PrivateRoute>
          }
        />

        {/* Editor — Fase 2 */}
        <Route
          path="/dashboard/editor"
          element={
            <PrivateRoute>
              <ComingSoon title="Dashboard Editor" />
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
