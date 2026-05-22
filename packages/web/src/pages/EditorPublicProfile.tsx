import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  IconArrowLeft,
  IconStarFilled,
  IconRosetteDiscountCheckFilled,
  IconPlayerPlay,
  IconMessage2,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconBell,
} from '@tabler/icons-react'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { NewOrderModal } from '@/components/orders/NewOrderModal'
import { CMLockup } from '@/components/ui/CMLogo'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PortfolioItem {
  id: string
  title: string
  description: string | null
  videoUrl: string
  thumbnailUrl: string | null
  basePrice: number
  category: { id: string; name: string }
  createdAt: string
}

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
    portfolioItems: PortfolioItem[]
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_PALETTE = [
  '#3B82F6', '#10B981', '#8B5CF6', '#EC4899',
  '#14B8A6', '#F59E0B', '#EF4444', '#06B6D4', '#F4631E',
]

function getAvatarColor(name: string): string {
  let hash = 0
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) % AVATAR_PALETTE.length
  return AVATAR_PALETTE[Math.abs(hash)]
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

function formatPrice(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

// ─── Package derivation from portfolio items ──────────────────────────────────

interface DerivedPackage {
  name: string
  description: string
  price: number
  highlighted: boolean
  portfolioItemId: string
}

function derivePackages(items: PortfolioItem[]): DerivedPackage[] {
  if (items.length === 0) return []
  const sorted = [...items].sort((a, b) => a.basePrice - b.basePrice)
  const tiers = ['Express', 'Pro', 'Studio']
  return sorted.slice(0, 3).map((item, i) => ({
    name: tiers[i] ?? `Pacote ${i + 1}`,
    description: item.description ?? item.title,
    price: item.basePrice,
    highlighted: i === 1,
    portfolioItemId: item.id,
  }))
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EditorPublicProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [editor, setEditor] = useState<EditorFullDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [orderModalOpen, setOrderModalOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string>('all')

  const canHire =
    !!user &&
    user.id !== id &&
    (user.role === 'CREATOR' || user.role === 'BOTH' || user.role === 'ADMIN')

  useEffect(() => {
    if (!id) return
    setLoading(true)
    api
      .get<{ editor: EditorFullDTO }>(`/editors/${id}`)
      .then(({ data }) => setEditor(data.editor))
      .catch(err => setError(err?.response?.data?.message ?? 'Editor não encontrado'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh', background: '#0D1B2A',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'rgba(255,255,255,0.4)', fontSize: 14,
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        Carregando perfil...
      </div>
    )
  }

  if (error || !editor) {
    return (
      <div
        style={{
          minHeight: '100vh', background: '#0D1B2A',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 16,
        }}
      >
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 20, color: '#fff', margin: 0 }}>
          {error ?? 'Editor não encontrado'}
        </h1>
        <button onClick={() => navigate(-1)} style={ghostBtn}>
          Voltar
        </button>
      </div>
    )
  }

  const { profile } = editor
  const packages = derivePackages(profile.portfolioItems)
  const portfolioCategories = Array.from(new Set(profile.portfolioItems.map(i => i.category.name)))
  const firstCategory = portfolioCategories[0]
  const minPrice = profile.portfolioItems.length
    ? Math.min(...profile.portfolioItems.map(p => p.basePrice))
    : null
  const filteredPortfolio =
    activeCategory === 'all'
      ? profile.portfolioItems
      : profile.portfolioItems.filter(i => i.category.name === activeCategory)

  return (
    <div style={{ minHeight: '100vh', background: '#0D1B2A', fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Top navbar ── */}
      <nav
        style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: 'rgba(13,27,42,0.92)', backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', gap: 16,
          padding: '0 24px', height: 56,
        }}
      >
        <button onClick={() => navigate(-1)} style={{ ...ghostBtn, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconArrowLeft size={15} stroke={1.8} />
          <span style={{ fontSize: 13 }}>Voltar</span>
        </button>

        <div style={{ flex: 1 }} />

        <CMLockup size={28} wordSize={14} color="#FFFFFF" variant="orange" gap={8} />

        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            style={{
              width: 34, height: 34, borderRadius: 8,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <IconBell size={15} stroke={1.5} style={{ color: 'rgba(255,255,255,0.6)' }} />
          </button>
          {user && (
            <div
              style={{
                width: 34, height: 34, borderRadius: '50%',
                background: getAvatarColor(user.name ?? ''),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 800, color: '#fff',
                fontFamily: "'Syne', sans-serif", overflow: 'hidden',
              }}
            >
              {initials(user.name ?? '')}
            </div>
          )}
        </div>
      </nav>

      {/* ── Breadcrumb ── */}
      <div
        style={{
          padding: '10px 32px',
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 12, color: 'rgba(255,255,255,0.4)',
        }}
      >
        <button
          onClick={() => navigate('/dashboard/creator')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: "'DM Sans', sans-serif', padding: 0" }}
        >
          Buscar editores
        </button>
        {firstCategory && (
          <>
            <IconChevronRight size={12} stroke={1.5} />
            <span>{firstCategory}</span>
          </>
        )}
        <IconChevronRight size={12} stroke={1.5} />
        <span style={{ color: 'rgba(255,255,255,0.7)' }}>{editor.name}</span>
      </div>

      {/* ── Hero banner ── */}
      <div
        style={{
          background: '#162436',
          backgroundImage:
            'repeating-linear-gradient(135deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 20px)',
          padding: '32px 32px 36px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', gap: 28, flexWrap: 'wrap' }}>

          {/* Avatar + info */}
          <div style={{ display: 'flex', gap: 24, flex: 1, minWidth: 280 }}>
            {/* Avatar with verified badge */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div
                style={{
                  width: 88, height: 88, borderRadius: '50%',
                  background: '#F4631E',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 28, fontWeight: 800, color: '#fff',
                  fontFamily: "'Syne', sans-serif", overflow: 'hidden',
                  border: '3px solid rgba(255,255,255,0.15)',
                }}
              >
                {editor.avatarUrl ? (
                  <img src={editor.avatarUrl} alt={editor.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  initials(editor.name)
                )}
              </div>
              {/* Verified badge */}
              <div
                style={{
                  position: 'absolute', bottom: 2, right: 2,
                  width: 22, height: 22, borderRadius: '50%',
                  background: '#F4631E', border: '2px solid #162436',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <IconCheck size={11} stroke={3} color="#fff" />
              </div>
            </div>

            {/* Name + meta */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                <h1
                  style={{
                    fontFamily: "'Syne', sans-serif", fontWeight: 800,
                    fontSize: 26, color: '#fff', margin: 0, lineHeight: 1.1,
                  }}
                >
                  {editor.name}
                </h1>
                {profile.isPremium && (
                  <span
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      background: 'rgba(244,99,30,0.18)', color: '#F4631E',
                      fontSize: 11, fontWeight: 700, padding: '3px 9px',
                      borderRadius: 20, fontFamily: "'Syne', sans-serif",
                      border: '1px solid rgba(244,99,30,0.25)',
                    }}
                  >
                    <IconRosetteDiscountCheckFilled size={12} />
                    PREMIUM
                  </span>
                )}
              </div>

              {/* Rating row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <IconStarFilled size={13} color="#F4631E" />
                  <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, color: '#fff' }}>
                    {profile.avgRating ? profile.avgRating.toFixed(1) : '—'}
                  </span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                    · {profile.totalJobs} avaliações
                  </span>
                </div>
                <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>·</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Online agora</span>
              </div>

              {/* Category + tool tags */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {profile.categories.map(c => (
                  <span key={c.id} style={tagStyle}>{c.name}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Price + actions */}
          <div
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
              justifyContent: 'center', gap: 12, flexShrink: 0,
            }}
          >
            {minPrice != null && (
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 3px' }}>
                  A partir de
                </p>
                <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 900, fontSize: 36, color: '#fff', lineHeight: 1, margin: 0 }}>
                  R$ {formatPrice(minPrice)}
                </p>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                disabled
                title="Mensagens disponíveis em breve"
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.14)',
                  borderRadius: 8, padding: '10px 18px',
                  fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)',
                  cursor: 'not-allowed', fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <IconMessage2 size={15} stroke={1.5} />
                Mensagem
              </button>
              {canHire && (
                <button
                  onClick={() => setOrderModalOpen(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: '#F4631E', color: '#fff', border: 'none',
                    borderRadius: 8, padding: '10px 20px',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    fontFamily: "'Syne', sans-serif",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#E0551A')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#F4631E')}
                >
                  Contratar
                  <IconChevronRight size={15} stroke={2} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 32px', display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* ── Left column ── */}
        <div style={{ flex: '1 1 540px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Sobre */}
          {editor.bio && (
            <section style={sectionCard}>
              <h2 style={sectionTitle}>Sobre</h2>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 1.7, margin: 0 }}>
                {editor.bio}
              </p>
            </section>
          )}

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
            <StatCard value={String(profile.totalJobs)} label="Jobs concluídos" />
            <StatCard
              value={profile.avgRating ? `${(profile.avgRating / 5 * 100).toFixed(0)}%` : '—'}
              label="Taxa de aprovação"
            />
            <StatCard value="—" label="Tempo médio" />
            <StatCard value="—" label="Aprovação 1ª entrega" />
          </div>

          {/* Portfólio */}
          {profile.portfolioItems.length > 0 && (
            <section style={sectionCard}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <h2 style={{ ...sectionTitle, margin: 0 }}>Portfólio</h2>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <FilterTab active={activeCategory === 'all'} onClick={() => setActiveCategory('all')}>
                    Todos
                  </FilterTab>
                  {portfolioCategories.map(cat => (
                    <FilterTab key={cat} active={activeCategory === cat} onClick={() => setActiveCategory(cat)}>
                      {cat}
                    </FilterTab>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                {filteredPortfolio.map(item => (
                  <a
                    key={item.id}
                    href={item.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ textDecoration: 'none' }}
                  >
                    <PortfolioThumb item={item} />
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Avaliações */}
          <section style={sectionCard}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ ...sectionTitle, margin: 0 }}>Avaliações</h2>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                {profile.avgRating ? `${profile.avgRating.toFixed(1)} média` : 'Sem avaliações'}
              </span>
            </div>
            <div
              style={{
                padding: '32px 16px', textAlign: 'center',
                background: 'rgba(255,255,255,0.03)', borderRadius: 10,
                border: '1px dashed rgba(255,255,255,0.08)',
              }}
            >
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', margin: 0 }}>
                Avaliações aparecem após a conclusão de pedidos.
              </p>
            </div>
          </section>
        </div>

        {/* ── Right sidebar ── */}
        <div style={{ flexShrink: 0, width: 280, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Pacotes */}
          {packages.length > 0 && (
            <div style={sideCard}>
              <h3 style={sideTitle}>Pacotes</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {packages.map(pkg => (
                  <div
                    key={pkg.portfolioItemId}
                    style={{
                      borderRadius: 9,
                      padding: '10px 12px',
                      background: pkg.highlighted ? 'rgba(244,99,30,0.14)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${pkg.highlighted ? 'rgba(244,99,30,0.3)' : 'rgba(255,255,255,0.07)'}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span
                        style={{
                          fontFamily: "'Syne', sans-serif", fontWeight: 700,
                          fontSize: 13, color: pkg.highlighted ? '#F4631E' : '#fff',
                        }}
                      >
                        {pkg.name}
                      </span>
                      <span
                        style={{
                          fontFamily: "'Syne', sans-serif", fontWeight: 800,
                          fontSize: 13, color: pkg.highlighted ? '#F4631E' : '#fff',
                        }}
                      >
                        R$ {formatPrice(pkg.price)}
                      </span>
                    </div>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', margin: '0 0 5px', lineHeight: 1.4 }}>
                      {pkg.description}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <IconClock size={11} stroke={1.5} style={{ color: 'rgba(255,255,255,0.35)' }} />
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Prazo a combinar</span>
                    </div>
                  </div>
                ))}
              </div>

              {canHire && (
                <button
                  onClick={() => setOrderModalOpen(true)}
                  style={{
                    width: '100%', background: '#F4631E', color: '#fff',
                    border: 'none', borderRadius: 9, padding: '11px 0',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    fontFamily: "'Syne', sans-serif",
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#E0551A')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#F4631E')}
                >
                  Contratar {packages[1] ? packages[1].name : packages[0].name}
                  <IconChevronRight size={14} stroke={2.5} />
                </button>
              )}
            </div>
          )}

          {/* Categories info */}
          {profile.categories.length > 0 && (
            <div style={sideCard}>
              <h3 style={sideTitle}>Especialidades</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {profile.categories.map(c => (
                  <span key={c.id} style={tagStyle}>{c.name}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Order modal ── */}
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div
      style={{
        background: '#162436', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 10, padding: '14px 16px', textAlign: 'center',
      }}
    >
      <p
        style={{
          fontFamily: "'Syne', sans-serif", fontWeight: 800,
          fontSize: 20, color: '#fff', margin: '0 0 4px',
        }}
      >
        {value}
      </p>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: 0, lineHeight: 1.3 }}>
        {label}
      </p>
    </div>
  )
}

function FilterTab({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 12px', borderRadius: 20, fontSize: 12,
        fontWeight: active ? 700 : 400, cursor: 'pointer', border: 'none',
        fontFamily: "'DM Sans', sans-serif",
        background: active ? '#F4631E' : 'rgba(255,255,255,0.07)',
        color: active ? '#fff' : 'rgba(255,255,255,0.55)',
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  )
}

function PortfolioThumb({ item }: { item: PortfolioItem }) {
  return (
    <div
      style={{
        borderRadius: 10, overflow: 'hidden',
        background: '#1E3045',
        backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 18px)',
        border: '1px solid rgba(255,255,255,0.07)',
        position: 'relative', aspectRatio: '4/3',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(244,99,30,0.3)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}
    >
      {item.thumbnailUrl && (
        <img
          src={item.thumbnailUrl}
          alt={item.title}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}
      {/* Overlay with play */}
      <div
        style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.2)',
        }}
      >
        <div
          style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <IconPlayerPlay size={13} stroke={1.5} style={{ color: 'rgba(255,255,255,0.8)', marginLeft: 1 }} />
        </div>
      </div>
      {/* Category badge */}
      <div
        style={{
          position: 'absolute', top: 7, right: 7,
          background: 'rgba(255,255,255,0.9)', color: '#0D1B2A',
          fontSize: 9, fontWeight: 700, padding: '2px 7px',
          borderRadius: 20, fontFamily: "'DM Sans', sans-serif",
          backdropFilter: 'blur(4px)',
        }}
      >
        {item.category.name}
      </div>
      {/* Title bottom */}
      <div
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
          padding: '16px 8px 7px',
        }}
      >
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', margin: 0, fontWeight: 600, lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.title.toUpperCase()}
        </p>
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const ghostBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, padding: '8px 14px',
  fontSize: 13, color: 'rgba(255,255,255,0.75)',
  cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
}

const tagStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.07)',
  color: 'rgba(255,255,255,0.75)',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 6, padding: '4px 10px',
  fontSize: 12, fontFamily: "'DM Sans', sans-serif",
}

const sectionCard: React.CSSProperties = {
  background: '#162436',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 12, padding: 20,
}

const sectionTitle: React.CSSProperties = {
  fontFamily: "'Syne', sans-serif", fontWeight: 700,
  fontSize: 17, color: '#fff', margin: '0 0 14px',
}

const sideCard: React.CSSProperties = {
  background: '#162436',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 12, padding: 16,
}

const sideTitle: React.CSSProperties = {
  fontFamily: "'Syne', sans-serif", fontWeight: 700,
  fontSize: 14, color: '#fff', margin: '0 0 12px',
}
