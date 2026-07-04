import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  IconMail,
  IconLock,
  IconEye,
  IconEyeOff,
  IconArrowRight,
  IconArrowLeft,
  IconBrandGoogle,
} from '@tabler/icons-react'
import { api } from '@/lib/api'
import { useAuth, type AuthUser } from '@/hooks/use-auth'
import { RoleSelectorModal } from '@/components/RoleSelectorModal'

export function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pendingUser, setPendingUser] = useState<AuthUser | null>(null)
  const [pendingTokens, setPendingTokens] = useState<{ token: string; refreshToken: string } | null>(null)

  function redirectByRole(role: AuthUser['role']) {
    if (role === 'CREATOR') navigate('/dashboard/creator')
    else if (role === 'EDITOR') navigate('/dashboard/editor')
    else if (role === 'ADMIN') navigate('/admin')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data } = await api.post<{ token: string; refreshToken: string; user: AuthUser }>(
        '/auth/login',
        { email, password },
      )

      if (data.user.role === 'BOTH') {
        setPendingUser(data.user)
        setPendingTokens({ token: data.token, refreshToken: data.refreshToken })
        return
      }

      login(data.token, data.refreshToken, data.user)
      redirectByRole(data.user.role)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Falha ao entrar. Tente novamente.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  function handleSelectRole(role: 'creator' | 'editor') {
    if (!pendingUser || !pendingTokens) return
    login(pendingTokens.token, pendingTokens.refreshToken, pendingUser)
    navigate(role === 'creator' ? '/dashboard/creator' : '/dashboard/editor')
  }

  return (
    <>
      <div className="flex min-h-screen" style={{ background: '#0D1B2A' }}>

        {/* ─── PAINEL ESQUERDO 40% — institucional ──────────────────────────── */}
        <div
          className="relative hidden w-[40%] flex-col justify-between overflow-hidden p-10 lg:flex"
          style={{ background: '#162436', borderRight: '1px solid rgba(255,255,255,0.06)' }}
        >
          {/* Círculos decorativos (SVG sutil) */}
          <svg
            className="pointer-events-none absolute"
            style={{ left: '-30%', top: '50%', transform: 'translateY(-50%)' }}
            width="700"
            height="700"
            viewBox="0 0 700 700"
            fill="none"
          >
            <circle cx="350" cy="350" r="349" stroke="rgba(255,255,255,0.04)" />
            <circle cx="350" cy="350" r="280" stroke="rgba(255,255,255,0.03)" />
            <circle cx="350" cy="350" r="210" stroke="rgba(255,255,255,0.02)" />
            <circle cx="350" cy="350" r="140" stroke="rgba(244,99,30,0.05)" />
          </svg>

          {/* Logo */}
          <div className="relative z-10 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#F4631E' }} />
            <span
              className="text-[22px] font-extrabold text-white"
              style={{ fontFamily: "'Syne', sans-serif" }}
            >
              CutMakers
            </span>
          </div>

          {/* Headline */}
          <div className="relative z-10 max-w-md">
            <p
              className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em]"
              style={{ color: '#F4631E' }}
            >
              Plataforma de Creators
            </p>
            <h1
              className="text-[40px] font-bold leading-[1.1] text-white"
              style={{ fontFamily: "'Syne', sans-serif" }}
            >
              O match perfeito entre{' '}
              <span style={{ color: '#F4631E' }}>criador</span> e{' '}
              <span style={{ color: '#F4631E' }}>editor</span>
            </h1>
            <p
              className="mt-5 max-w-sm text-[15px] leading-relaxed"
              style={{ color: 'rgba(255,255,255,0.5)' }}
            >
              Conectamos influenciadores a editores freelancers profissionais de forma rápida e segura.
            </p>
          </div>

          {/* Stats */}
          <div className="relative z-10 flex gap-10">
            {[
              { value: '2.4k+', label: 'Editores' },
              { value: '8.1k+', label: 'Projetos' },
              { value: '4.9★', label: 'Avaliação' },
            ].map((stat) => (
              <div key={stat.label}>
                <p
                  className="text-[26px] font-bold text-white"
                  style={{ fontFamily: "'Syne', sans-serif" }}
                >
                  {stat.value}
                </p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ─── PAINEL DIREITO 60% — formulário ──────────────────────────────── */}
        <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-10 lg:px-12">
          {/* Voltar para a landing */}
          <Link
            to="/"
            className="absolute left-6 top-6 flex items-center gap-1.5 rounded-[8px] px-3 py-2 text-sm transition-colors lg:left-8 lg:top-8"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.6)',
              textDecoration: 'none',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.07)'
              e.currentTarget.style.color = 'rgba(255,255,255,0.9)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
              e.currentTarget.style.color = 'rgba(255,255,255,0.6)'
            }}
          >
            <IconArrowLeft size={16} stroke={1.5} />
            Voltar
          </Link>

          {/* Logo mobile */}
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <span className="h-2 w-2 rounded-full" style={{ background: '#F4631E' }} />
            <span
              className="text-xl font-extrabold text-white"
              style={{ fontFamily: "'Syne', sans-serif" }}
            >
              CutMakers
            </span>
          </div>

          <div className="w-full max-w-[400px]">
            <h2
              className="text-[28px] font-bold text-white"
              style={{ fontFamily: "'Syne', sans-serif" }}
            >
              Entrar na conta
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Acesse com seu e-mail e senha
            </p>

            {/* Formulário */}
            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              {/* Email */}
              <div>
                <label
                  className="mb-1.5 block text-xs font-medium"
                  style={{ color: 'rgba(255,255,255,0.7)' }}
                >
                  E-mail
                </label>
                <div className="relative">
                  <span
                    className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'rgba(255,255,255,0.4)' }}
                  >
                    <IconMail size={16} stroke={1.5} />
                  </span>
                  <input
                    type="email"
                    placeholder="seuemail@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="input-field pl-9"
                  />
                </div>
              </div>

              {/* Senha */}
              <div>
                <label
                  className="mb-1.5 block text-xs font-medium"
                  style={{ color: 'rgba(255,255,255,0.7)' }}
                >
                  Senha
                </label>
                <div className="relative">
                  <span
                    className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'rgba(255,255,255,0.4)' }}
                  >
                    <IconLock size={16} stroke={1.5} />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="input-field pl-9 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 transition-colors"
                    style={{
                      color: 'rgba(255,255,255,0.4)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)' }}
                  >
                    {showPassword ? <IconEyeOff size={16} stroke={1.5} /> : <IconEye size={16} stroke={1.5} />}
                  </button>
                </div>
                <div className="mt-2 flex justify-end">
                  <a
                    href="#"
                    className="text-xs transition-colors"
                    style={{ color: '#F4631E' }}
                    onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline' }}
                    onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none' }}
                  >
                    Esqueceu a senha?
                  </a>
                </div>
              </div>

              {/* Erro */}
              {error && (
                <p
                  className="rounded-[8px] px-3 py-2 text-xs"
                  style={{
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    color: '#FCA5A5',
                  }}
                >
                  {error}
                </p>
              )}

              {/* Submit */}
              <button type="submit" disabled={loading} className="btn-primary flex items-center justify-center gap-2">
                {loading ? 'Entrando...' : 'Entrar'}
                {!loading && <IconArrowRight size={16} stroke={2} />}
              </button>
            </form>

            {/* Divider */}
            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.08)' }} />
              <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
                OU
              </span>
              <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.08)' }} />
            </div>

            {/* Google (placeholder — OAuth não está na Fase 1) */}
            <button
              type="button"
              onClick={() => alert('Login com Google será implementado em fase futura.')}
              className="flex w-full items-center justify-center gap-2 rounded-[8px] py-2.5 text-sm font-medium transition-colors"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.85)',
                fontFamily: "'DM Sans', sans-serif",
                cursor: 'pointer',
                height: '42px',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
            >
              <IconBrandGoogle size={16} stroke={1.5} />
              Continuar com Google
            </button>

            {/* Cadastrar */}
            <p className="mt-6 text-center text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Não tem conta?{' '}
              <Link to="/register" style={{ color: '#F4631E', fontWeight: 500 }} className="hover:underline">
                Criar conta grátis
              </Link>
            </p>
          </div>
        </div>
      </div>

      {pendingUser && (
        <RoleSelectorModal
          user={pendingUser}
          onSelectCreator={() => handleSelectRole('creator')}
          onSelectEditor={() => handleSelectRole('editor')}
        />
      )}
    </>
  )
}
