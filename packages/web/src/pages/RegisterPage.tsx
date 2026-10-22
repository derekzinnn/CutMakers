import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { IconUser, IconMail, IconLock, IconCamera, IconMovie, IconEye, IconEyeOff } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { useAuth, type AuthUser } from '@/hooks/use-auth'
import { Modal } from '@/components/ui/Modal'
import { PLATFORM_TERMS } from '@/lib/terms'

type Role = 'CREATOR' | 'EDITOR'

export function RegisterPage() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [role, setRole] = useState<Role>('CREATOR')
  const [showPassword, setShowPassword] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [termsOpen, setTermsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!acceptTerms) {
      setError('É necessário aceitar os Termos de Uso para criar a conta.')
      return
    }

    setLoading(true)

    try {
      const { data } = await api.post<{ token: string; refreshToken: string; user: AuthUser }>(
        '/auth/register',
        { name, email, password, role, acceptTerms },
      )

      login(data.token, data.refreshToken, data.user)

      if (data.user.role === 'CREATOR') navigate('/dashboard/creator')
      else navigate('/dashboard/editor')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Erro ao criar conta. Tente novamente.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--background)' }}>
      {/* Painel esquerdo */}
      <div
        className="hidden w-[40%] flex-col justify-between p-10 lg:flex"
        style={{ background: 'var(--card)', borderRight: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: 'var(--brand)' }} />
          <span className="text-[22px] font-extrabold text-white" style={{ fontFamily: "'Syne', sans-serif" }}>
            CutMakers
          </span>
        </div>

        <div>
          <h1 className="text-[30px] font-bold leading-tight text-white" style={{ fontFamily: "'Syne', sans-serif" }}>
            Comece sua jornada na <span style={{ color: 'var(--brand)' }}>edição profissional</span>
          </h1>
          <p className="mt-4 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Seja você um criador buscando o editor perfeito ou um editor em busca de novos clientes.
          </p>
        </div>

        <div className="flex gap-8">
          {[
            { value: 'Grátis', label: 'Para criar conta' },
            { value: '48h', label: 'Entrega média' },
            { value: '5★', label: 'Avaliação média' },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-2xl font-bold text-white" style={{ fontFamily: "'Syne', sans-serif" }}>
                {stat.value}
              </p>
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Painel direito — formulário */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 lg:px-12">
        <div className="w-full max-w-sm">
          <h2 className="mb-1 text-2xl font-bold text-white" style={{ fontFamily: "'Syne', sans-serif" }}>
            Criar conta
          </h2>
          <p className="mb-8 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Escolha como você vai usar a plataforma
          </p>

          {/* Seletor de role */}
          <div className="mb-6 grid grid-cols-2 gap-3">
            {([
              { value: 'CREATOR', label: 'Criador', desc: 'Quero contratar editores', Icon: IconCamera },
              { value: 'EDITOR', label: 'Editor', desc: 'Quero receber projetos', Icon: IconMovie },
            ] as const).map(({ value, label, desc, Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setRole(value)}
                className="flex flex-col items-center gap-2 rounded-card p-4 text-left transition-all"
                style={{
                  background: role === value ? 'var(--brand-soft)' : 'var(--surface-subtle)',
                  border: `1px solid ${role === value ? 'var(--brand-border)' : 'var(--border)'}`,
                }}
              >
                <Icon
                  size={24}
                  stroke={1.5}
                  color={role === value ? 'var(--brand)' : 'var(--muted-foreground)'}
                />
                <span
                  className="text-sm font-semibold"
                  style={{ color: role === value ? 'var(--brand)' : 'var(--foreground)', fontFamily: "'Syne', sans-serif" }}
                >
                  {label}
                </span>
                <span className="text-center text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  {desc}
                </span>
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }}>
                <IconUser size={16} stroke={1.5} />
              </span>
              <input
                type="text"
                placeholder="Seu nome completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                className="input-field pl-9"
              />
            </div>

            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }}>
                <IconMail size={16} stroke={1.5} />
              </span>
              <input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input-field pl-9"
              />
            </div>

            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }}>
                <IconLock size={16} stroke={1.5} />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="input-field pl-9 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 transition-colors"
                style={{ color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--foreground)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted-foreground)' }}
              >
                {showPassword ? <IconEyeOff size={16} stroke={1.5} /> : <IconEye size={16} stroke={1.5} />}
              </button>
            </div>

            {/* Aceite dos Termos de Uso */}
            <label
              className="flex cursor-pointer items-start gap-2.5 rounded-[8px] px-3 py-2.5"
              style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}
            >
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[var(--brand)]"
              />
              <span className="text-xs leading-relaxed" style={{ color: 'var(--foreground)' }}>
                Li e aceito os{' '}
                <button
                  type="button"
                  onClick={() => setTermsOpen(true)}
                  className="font-medium hover:underline"
                  style={{ color: 'var(--brand)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                >
                  Termos de Uso
                </button>{' '}
                da CutMakers. Entendo que a plataforma atua como intermediadora e que cada
                usuário é responsável pelo conteúdo e pelos compromissos que assume.
              </span>
            </label>

            {error && (
              <p
                className="rounded-[8px] px-3 py-2 text-xs text-red-400"
                style={{ background: 'var(--destructive-soft)', border: '1px solid var(--destructive-border)' }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !acceptTerms}
              className="btn-primary"
              style={{ opacity: loading || !acceptTerms ? 0.6 : 1, cursor: loading || !acceptTerms ? 'not-allowed' : 'pointer' }}
            >
              {loading ? 'Criando conta...' : 'Criar conta'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Já tem conta?{' '}
            <Link to="/login" style={{ color: 'var(--brand)' }} className="hover:underline">
              Entrar
            </Link>
          </p>
        </div>
      </div>

      {/* Modal com os Termos de Uso completos */}
      <Modal
        open={termsOpen}
        onClose={() => setTermsOpen(false)}
        title="Termos de Uso"
        subtitle="CutMakers — plataforma de intermediação"
        size="lg"
        footer={
          <button
            onClick={() => { setAcceptTerms(true); setTermsOpen(false) }}
            className="rounded-[8px] px-5 py-2 text-sm font-semibold"
            style={{ background: 'var(--brand)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: "'Syne', sans-serif" }}
          >
            Li e aceito
          </button>
        }
      >
        <pre
          className="whitespace-pre-wrap text-xs leading-relaxed"
          style={{ color: 'var(--foreground)', fontFamily: "'DM Sans', sans-serif", margin: 0 }}
        >
          {PLATFORM_TERMS}
        </pre>
      </Modal>
    </div>
  )
}
