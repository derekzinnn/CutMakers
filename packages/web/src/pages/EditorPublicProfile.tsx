import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  IconArrowLeft,
  IconStar,
  IconCheck,
  IconCrown,
  IconPlayerPlay,
  IconCalendar,
} from '@tabler/icons-react'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { NewOrderModal } from '@/components/orders/NewOrderModal'

interface EditorFullDTO {
  id: string
  name: string
  email: string
  role: string
  avatarUrl: string | null
  bio: string | null
  createdAt: string
  profile: {
    id: string
    isPremium: boolean
    avgRating: number
    totalJobs: number
    categories: { id: string; name: string }[]
    portfolioItems: {
      id: string
      title: string
      description: string | null
      videoUrl: string
      thumbnailUrl: string | null
      basePrice: number
      category: { id: string; name: string }
      createdAt: string
    }[]
  }
}

export function EditorPublicProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [editor, setEditor] = useState<EditorFullDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [orderModalOpen, setOrderModalOpen] = useState(false)

  const canHire =
    !!user && user.id !== id && (user.role === 'CREATOR' || user.role === 'BOTH' || user.role === 'ADMIN')

  useEffect(() => {
    if (!id) return
    setLoading(true)
    api
      .get<{ editor: EditorFullDTO }>(`/editors/${id}`)
      .then(({ data }) => setEditor(data.editor))
      .catch((err) => {
        setError(err?.response?.data?.message ?? 'Editor não encontrado')
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center text-sm"
        style={{ background: '#0D1B2A', color: 'rgba(255,255,255,0.4)' }}
      >
        Carregando perfil...
      </div>
    )
  }

  if (error || !editor) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-4"
        style={{ background: '#0D1B2A' }}
      >
        <h1 className="font-heading text-xl font-bold text-white">{error}</h1>
        <button
          onClick={() => navigate(-1)}
          className="rounded-[8px] px-4 py-2 text-sm transition-colors"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'white',
            cursor: 'pointer',
          }}
        >
          Voltar
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#0D1B2A' }}>
      {/* Top bar */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 backdrop-blur"
        style={{
          background: 'rgba(13,27,42,0.85)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 rounded-[8px] px-3 py-2 text-sm transition-colors"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.8)',
            cursor: 'pointer',
          }}
        >
          <IconArrowLeft size={14} stroke={1.5} />
          Voltar
        </button>
        <Link
          to="/dashboard/creator"
          className="flex items-center gap-2 text-sm"
          style={{ color: 'rgba(255,255,255,0.5)' }}
        >
          <span className="h-2 w-2 rounded-full" style={{ background: '#F4631E' }} />
          <span className="font-heading font-extrabold text-white">CutMakers</span>
        </Link>
      </div>

      {/* Hero */}
      <div
        className="px-6 py-12"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="mx-auto flex max-w-4xl flex-col gap-6 md:flex-row md:items-start">
          <div
            className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl font-heading text-3xl font-bold text-white"
            style={{ background: '#F4631E' }}
          >
            {editor.avatarUrl ? (
              <img src={editor.avatarUrl} alt={editor.name} className="h-full w-full object-cover" />
            ) : (
              editor.name.charAt(0).toUpperCase()
            )}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-3xl font-bold text-white">{editor.name}</h1>
              {editor.profile.isPremium && (
                <span
                  className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{ background: 'rgba(244,99,30,0.15)', color: '#F4631E' }}
                >
                  <IconCrown size={11} stroke={2} />
                  Premium
                </span>
              )}
            </div>

            {editor.bio && (
              <p className="mt-3 max-w-xl text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {editor.bio}
              </p>
            )}

            {/* Stats inline */}
            <div className="mt-4 flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-1.5">
                <IconStar size={14} stroke={1.5} color="#F4631E" />
                <span className="font-heading font-bold text-white">
                  {editor.profile.avgRating ? editor.profile.avgRating.toFixed(1) : '—'}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>avaliação</span>
              </div>
              <div className="flex items-center gap-1.5">
                <IconCheck size={14} stroke={1.5} color="#F4631E" />
                <span className="font-heading font-bold text-white">
                  {editor.profile.totalJobs}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>jobs entregues</span>
              </div>
              <div className="flex items-center gap-1.5">
                <IconCalendar size={14} stroke={1.5} color="#F4631E" />
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Desde {new Date(editor.createdAt).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>

            {/* Categorias */}
            {editor.profile.categories.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {editor.profile.categories.map((c) => (
                  <span
                    key={c.id}
                    className="rounded-full px-3 py-1 text-xs font-medium"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      color: 'rgba(255,255,255,0.8)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    {c.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* CTA */}
          {canHire && (
            <button
              onClick={() => setOrderModalOpen(true)}
              className="rounded-[8px] px-6 py-3 text-sm font-semibold transition-all"
              style={{
                background: '#F4631E',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontFamily: "'Syne', sans-serif",
              }}
            >
              Contratar →
            </button>
          )}
        </div>
      </div>

      {/* Portfólio */}
      <div className="mx-auto max-w-4xl px-6 py-10">
        <h2 className="mb-6 font-heading text-xl font-bold text-white">
          Portfólio · {editor.profile.portfolioItems.length}{' '}
          {editor.profile.portfolioItems.length === 1 ? 'projeto' : 'projetos'}
        </h2>

        {editor.profile.portfolioItems.length === 0 ? (
          <div
            className="rounded-card p-12 text-center"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Este editor ainda não adicionou projetos ao portfólio.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {editor.profile.portfolioItems.map((item) => (
              <a
                key={item.id}
                href={item.videoUrl}
                target="_blank"
                rel="noreferrer"
                className="group overflow-hidden rounded-card"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  textDecoration: 'none',
                }}
              >
                <div className="relative aspect-video w-full overflow-hidden" style={{ background: '#0D1B2A' }}>
                  {item.thumbnailUrl ? (
                    <img src={item.thumbnailUrl} alt={item.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <IconPlayerPlay size={32} stroke={1.5} style={{ color: 'rgba(255,255,255,0.2)' }} />
                    </div>
                  )}
                  <div
                    className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ background: 'rgba(0,0,0,0.5)' }}
                  >
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-full"
                      style={{ background: '#F4631E' }}
                    >
                      <IconPlayerPlay size={20} stroke={2} color="white" fill="white" />
                    </div>
                  </div>
                </div>

                <div className="p-4">
                  <span
                    className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{ background: 'rgba(244,99,30,0.15)', color: '#F4631E' }}
                  >
                    {item.category.name}
                  </span>
                  <h3 className="mt-2 line-clamp-1 text-sm font-semibold text-white">
                    {item.title}
                  </h3>
                  {item.description && (
                    <p className="mt-1 line-clamp-2 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      {item.description}
                    </p>
                  )}
                  <p className="mt-2 font-heading text-base font-bold" style={{ color: '#F4631E' }}>
                    R$ {item.basePrice.toFixed(2)}
                  </p>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {canHire && id && (
        <NewOrderModal
          open={orderModalOpen}
          onClose={() => setOrderModalOpen(false)}
          editor={{ id, name: editor.name }}
          onSuccess={() => navigate('/dashboard/creator?section=orders')}
        />
      )}
    </div>
  )
}
