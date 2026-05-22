import { useNavigate } from 'react-router-dom'
import {
  IconBolt,
  IconArrowRight,
  IconVideo,
  IconShieldCheck,
  IconClock,
  IconCheck,
  IconSearch,
  IconBriefcase,
  IconStarFilled,
  IconRosetteDiscountCheckFilled,
  IconMovie,
  IconBrandInstagram,
  IconBrandYoutube,
  IconBrandTiktok,
  IconUsers,
} from '@tabler/icons-react'
import { CMLockup } from '@/components/ui/CMLogo'

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  navy:     '#0D1B2A',
  navyMid:  '#162436',
  navyLight:'#1E3045',
  navyLift: '#243954',
  orange:   '#F4631E',
  border:   'rgba(255,255,255,0.08)',
  borderSt: 'rgba(255,255,255,0.14)',
  text80:   'rgba(255,255,255,0.80)',
  text60:   'rgba(255,255,255,0.60)',
  text40:   'rgba(255,255,255,0.40)',
  orangeSoft: 'rgba(244,99,30,0.12)',
  syne: "'Syne', sans-serif",
  dm:   "'DM Sans', sans-serif",
}

// ─── Hero video thumbnail placeholder ────────────────────────────────────────

function Thumb({
  label,
  badge,
  tone = 0,
  aspect = '16/9',
}: {
  label: string
  badge?: string
  tone?: number
  aspect?: string
}) {
  const tones = [
    ['#1E3045', '#0D1B2A'],
    ['#243954', '#162436'],
    ['#2A4A7A', '#1E3045'],
    ['#162436', '#0D1B2A'],
  ]
  const [c1, c2] = tones[tone % tones.length]
  return (
    <div
      style={{
        width: '100%',
        aspectRatio: aspect,
        borderRadius: 10,
        overflow: 'hidden',
        background: `linear-gradient(135deg, ${c1}, ${c2})`,
        position: 'relative',
        border: `1px solid ${C.border}`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0 14px, transparent 14px 28px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%,-50%)',
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.14)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
          <path d="M7 4v16l13-8z" />
        </svg>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 10,
          bottom: 10,
          fontFamily: 'monospace',
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.55)',
        }}
      >
        {label}
      </div>
      {badge && (
        <div
          style={{
            position: 'absolute',
            right: 10,
            top: 10,
            fontFamily: C.dm,
            fontSize: 11,
            fontWeight: 600,
            background: 'rgba(13,27,42,0.7)',
            color: '#fff',
            padding: '4px 8px',
            borderRadius: 6,
            backdropFilter: 'blur(6px)',
          }}
        >
          {badge}
        </div>
      )}
    </div>
  )
}

function Avatar({ size = 40, name = 'AB', tone = 0 }: { size?: number; name?: string; tone?: number }) {
  const tones = [
    ['#F4631E', '#FFB591'],
    ['#3A6EE8', '#9CC0FF'],
    ['#16A37F', '#7FD9C2'],
    ['#B65EE8', '#E0B7F2'],
    ['#E89B16', '#F5D38C'],
    ['#E6446D', '#F2A3B6'],
  ]
  const [c1, c2] = tones[tone % tones.length]
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${c1}, ${c2})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: C.syne,
        fontWeight: 700,
        color: '#fff',
        fontSize: size * 0.38,
        flexShrink: 0,
      }}
    >
      {name}
    </div>
  )
}

// ─── Nav ─────────────────────────────────────────────────────────────────────

function Nav({ onLogin, onRegister }: { onLogin: () => void; onRegister: () => void }) {
  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '22px 56px',
        borderBottom: `1px solid ${C.border}`,
        background: 'rgba(13,27,42,0.6)',
        backdropFilter: 'blur(8px)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <CMLockup size={36} wordSize={22} variant="orange" />
      <div style={{ display: 'flex', gap: 32, fontFamily: C.dm, fontSize: 14, color: C.text80 }}>
        {['Como funciona', 'Editores', 'Categorias', 'Preços', 'Para editores'].map((l) => (
          <span
            key={l}
            style={{ cursor: 'pointer' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = C.text80)}
          >
            {l}
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button
          onClick={onLogin}
          style={{
            fontFamily: C.syne,
            fontWeight: 600,
            fontSize: 14,
            padding: '10px 18px',
            borderRadius: 8,
            border: 'none',
            background: 'transparent',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Entrar
        </button>
        <button
          onClick={onRegister}
          style={{
            fontFamily: C.syne,
            fontWeight: 600,
            fontSize: 14,
            padding: '10px 18px',
            borderRadius: 8,
            border: 'none',
            background: C.orange,
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Cadastrar grátis
        </button>
      </div>
    </nav>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero({ onRegister }: { onRegister: () => void }) {
  return (
    <section
      style={{
        padding: '90px 56px 80px',
        display: 'grid',
        gridTemplateColumns: '1.05fr 1fr',
        gap: 64,
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* decorative radial */}
      <div
        style={{
          position: 'absolute',
          right: -160,
          top: -160,
          width: 520,
          height: 520,
          borderRadius: '50%',
          background: `radial-gradient(circle at 30% 30%, ${C.orangeSoft}, transparent 60%)`,
          pointerEvents: 'none',
        }}
      />

      {/* left copy */}
      <div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 14px',
            borderRadius: 999,
            background: C.orangeSoft,
            color: C.orange,
            fontFamily: C.dm,
            fontSize: 12.5,
            fontWeight: 600,
            letterSpacing: '0.02em',
            marginBottom: 28,
          }}
        >
          <IconBolt size={14} stroke={2} /> +2.400 editores verificados em todo o Brasil
        </div>
        <h1
          style={{
            fontFamily: C.syne,
            fontWeight: 800,
            fontSize: 'clamp(44px, 5vw, 68px)',
            lineHeight: 1.02,
            letterSpacing: '-0.035em',
            margin: 0,
            color: '#fff',
          }}
        >
          O editor perfeito
          <br />
          para seus vídeos —
          <br />
          <span style={{ color: C.orange }}>no corte certo.</span>
        </h1>
        <p
          style={{
            fontFamily: C.dm,
            fontSize: 18,
            lineHeight: 1.55,
            color: C.text80,
            marginTop: 24,
            maxWidth: 520,
            fontWeight: 400,
          }}
        >
          Marketplace que conecta criadores de conteúdo a editores freelancers de vídeo.
          Pagamento seguro com escrow, portfólio verificado e entrega rastreada.
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 36 }}>
          <button
            onClick={onRegister}
            style={{
              fontFamily: C.syne,
              fontWeight: 600,
              fontSize: 15,
              padding: '12px 22px',
              borderRadius: 8,
              border: 'none',
              background: C.orange,
              color: '#fff',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            Encontrar editor <IconArrowRight size={16} stroke={2.2} />
          </button>
          <button
            style={{
              fontFamily: C.syne,
              fontWeight: 600,
              fontSize: 15,
              padding: '12px 22px',
              borderRadius: 8,
              background: 'rgba(255,255,255,0.06)',
              color: '#fff',
              border: `1px solid ${C.border}`,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <IconVideo size={16} /> Sou editor
          </button>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 32,
            marginTop: 48,
            fontFamily: C.dm,
            fontSize: 13,
            color: C.text60,
          }}
        >
          {[
            { icon: <IconShieldCheck size={16} color={C.orange} />, label: 'Pagamento em escrow' },
            { icon: <IconRosetteDiscountCheckFilled size={16} color={C.orange} />, label: 'Portfólio verificado' },
            { icon: <IconClock size={16} color={C.orange} />, label: 'Entrega em até 72h' },
          ].map(({ icon, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {icon} {label}
            </div>
          ))}
        </div>
      </div>

      {/* right: floating cards */}
      <div style={{ position: 'relative', height: 520 }}>
        {/* back card */}
        <div
          style={{
            position: 'absolute',
            right: 80,
            top: 0,
            width: 340,
            background: C.navyMid,
            borderRadius: 16,
            padding: 16,
            border: `1px solid ${C.border}`,
            transform: 'rotate(-3deg)',
            boxShadow: '0 30px 60px -20px rgba(0,0,0,0.45)',
          }}
        >
          <Thumb aspect="9/12" label="REEL · 00:42" tone={2} badge="Aprovado" />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar size={28} name="MR" tone={1} />
              <span style={{ fontFamily: C.dm, fontSize: 12.5, color: '#fff' }}>Maíra R.</span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontFamily: C.dm,
                fontSize: 12,
                color: '#fff',
              }}
            >
              <IconStarFilled size={13} color={C.orange} /> 4.9
            </div>
          </div>
        </div>

        {/* front card */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 60,
            width: 380,
            background: C.navyMid,
            borderRadius: 16,
            padding: 18,
            border: `1px solid ${C.borderSt}`,
            boxShadow: '0 40px 80px -24px rgba(0,0,0,0.6)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar size={40} name="DC" tone={0} />
              <div>
                <div
                  style={{
                    fontFamily: C.syne,
                    fontWeight: 700,
                    fontSize: 15,
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  Diego Cardoso <IconRosetteDiscountCheckFilled size={14} color={C.orange} />
                </div>
                <div
                  style={{ fontFamily: C.dm, fontSize: 11.5, color: C.text60, marginTop: 2 }}
                >
                  YouTube · Podcast · Corporativo
                </div>
              </div>
            </div>
            <div
              style={{
                background: C.orangeSoft,
                color: C.orange,
                fontFamily: C.dm,
                fontSize: 10.5,
                fontWeight: 600,
                padding: '4px 8px',
                borderRadius: 6,
                letterSpacing: '0.04em',
              }}
            >
              PREMIUM
            </div>
          </div>
          <Thumb aspect="16/9" label="EP 12 · TIMELINE" tone={1} badge="03:42" />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 14,
            }}
          >
            <div style={{ fontFamily: C.dm, fontSize: 12.5, color: C.text60 }}>
              A partir de <b style={{ color: '#fff', fontWeight: 600 }}>R$ 480</b>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontFamily: C.dm,
                fontSize: 12.5,
                color: '#fff',
              }}
            >
              <IconStarFilled size={13} color={C.orange} /> 5.0 · 128 jobs
            </div>
          </div>
        </div>

        {/* approval toast */}
        <div
          style={{
            position: 'absolute',
            right: 0,
            bottom: 80,
            background: C.navyLift,
            padding: '14px 18px',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            border: `1px solid ${C.borderSt}`,
            boxShadow: '0 20px 40px -16px rgba(0,0,0,0.45)',
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: C.orangeSoft,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconCheck size={18} color={C.orange} stroke={2.4} />
          </div>
          <div>
            <div style={{ fontFamily: C.syne, fontWeight: 700, fontSize: 14, color: '#fff' }}>
              Entrega aprovada
            </div>
            <div style={{ fontFamily: C.dm, fontSize: 11.5, color: C.text60 }}>
              R$ 480 liberados
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Social proof logos ───────────────────────────────────────────────────────

function Logos() {
  const brands = ['Globoplay', 'Suno', 'Flow', 'Quero na Mesa', 'BandNews', 'Inteli', 'Nubank']
  return (
    <div
      style={{
        padding: '30px 56px 60px',
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      <div
        style={{
          fontFamily: C.dm,
          fontSize: 12,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: C.text40,
          textAlign: 'center',
        }}
      >
        Editores que já cortaram para
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        {brands.map((b) => (
          <span
            key={b}
            style={{
              fontFamily: C.syne,
              fontWeight: 700,
              fontSize: 22,
              color: C.text40,
              letterSpacing: '-0.02em',
            }}
          >
            {b}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Como funciona ────────────────────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    {
      n: '01',
      icon: <IconSearch size={22} color={C.orange} />,
      t: 'Encontre seu editor',
      d: 'Filtre por categoria, faixa de preço, prazo e portfólio. Veja avaliações reais de outros criadores.',
    },
    {
      n: '02',
      icon: <IconBriefcase size={22} color={C.orange} />,
      t: 'Envie o briefing',
      d: 'Faça upload do material bruto, defina o escopo e o pagamento fica em escrow até a aprovação final.',
    },
    {
      n: '03',
      icon: <IconCheck size={22} color={C.orange} />,
      t: 'Aprove e publique',
      d: 'Receba o corte final, peça revisões ilimitadas conforme o plano e libere o pagamento ao aprovar.',
    },
  ]
  return (
    <section
      style={{ padding: '90px 56px', borderBottom: `1px solid ${C.border}` }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginBottom: 48,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: C.dm,
              fontSize: 12.5,
              color: C.orange,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: 14,
            }}
          >
            · Como funciona
          </div>
          <h2
            style={{
              fontFamily: C.syne,
              fontWeight: 800,
              fontSize: 48,
              color: '#fff',
              letterSpacing: '-0.03em',
              lineHeight: 1.05,
              margin: 0,
            }}
          >
            Três passos do briefing
            <br />
            ao vídeo aprovado.
          </h2>
        </div>
        <button
          style={{
            fontFamily: C.syne,
            fontWeight: 600,
            fontSize: 14,
            padding: '10px 18px',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.06)',
            color: '#fff',
            border: `1px solid ${C.border}`,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          Ver guia completo <IconArrowRight size={14} stroke={2.2} />
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
        {steps.map((s) => (
          <div
            key={s.n}
            style={{
              background: C.navyMid,
              borderRadius: 12,
              padding: 28,
              border: `1px solid ${C.border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              minHeight: 240,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: C.orangeSoft,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {s.icon}
              </div>
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: 11,
                  color: C.text40,
                  letterSpacing: '0.1em',
                }}
              >
                {s.n}
              </div>
            </div>
            <div
              style={{
                fontFamily: C.syne,
                fontWeight: 700,
                fontSize: 22,
                color: '#fff',
                letterSpacing: '-0.02em',
                marginTop: 12,
              }}
            >
              {s.t}
            </div>
            <div
              style={{ fontFamily: C.dm, fontSize: 14.5, color: C.text60, lineHeight: 1.55 }}
            >
              {s.d}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Categorias ───────────────────────────────────────────────────────────────

function Categories() {
  const cats = [
    { t: 'Reels & Shorts', d: 'Cortes verticais virais', n: '842 editores', icon: <IconBrandInstagram size={20} /> },
    { t: 'YouTube', d: 'Long-form & vlogs', n: '614 editores', icon: <IconBrandYoutube size={20} /> },
    { t: 'TikTok', d: 'Trends & UGC', n: '1.1k editores', icon: <IconBrandTiktok size={20} /> },
    { t: 'Podcast', d: 'Cortes + áudio sync', n: '238 editores', icon: <IconVideo size={20} /> },
    { t: 'Corporativo', d: 'Institucional & cases', n: '412 editores', icon: <IconBriefcase size={20} /> },
    { t: 'Wedding', d: 'Cinematic & resumos', n: '196 editores', icon: <IconMovie size={20} /> },
  ]
  return (
    <section
      style={{
        padding: '90px 56px',
        background: C.navyMid,
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      <div style={{ marginBottom: 48 }}>
        <div
          style={{
            fontFamily: C.dm,
            fontSize: 12.5,
            color: C.orange,
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: 14,
          }}
        >
          · Categorias
        </div>
        <h2
          style={{
            fontFamily: C.syne,
            fontWeight: 800,
            fontSize: 48,
            color: '#fff',
            letterSpacing: '-0.03em',
            lineHeight: 1.05,
            margin: 0,
          }}
        >
          O corte certo, para cada formato.
        </h2>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
        {cats.map((c) => (
          <div
            key={c.t}
            style={{
              background: C.navy,
              borderRadius: 12,
              padding: 22,
              border: `1px solid ${C.border}`,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              cursor: 'pointer',
              transition: 'border-color .15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(244,99,30,0.4)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 10,
                background: 'rgba(255,255,255,0.04)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: C.orange,
              }}
            >
              {c.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: C.syne, fontWeight: 700, fontSize: 17, color: '#fff' }}>
                {c.t}
              </div>
              <div style={{ fontFamily: C.dm, fontSize: 13, color: C.text60, marginTop: 2 }}>
                {c.d}
              </div>
            </div>
            <div style={{ fontFamily: C.dm, fontSize: 12, color: C.text40, fontWeight: 500 }}>
              {c.n}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Editores em destaque ─────────────────────────────────────────────────────

function FeaturedEditors({ onRegister }: { onRegister: () => void }) {
  const editors = [
    { name: 'Diego Cardoso', tags: 'YouTube · Podcast', rate: 'R$ 480', rating: '5.0', jobs: '128', tone: 0, premium: true },
    { name: 'Maíra Reis', tags: 'Reels · TikTok', rate: 'R$ 220', rating: '4.9', jobs: '341', tone: 1, premium: true },
    { name: 'Pedro Aragão', tags: 'Wedding · Cinemático', rate: 'R$ 1.200', rating: '4.8', jobs: '62', tone: 2, premium: false },
    { name: 'Júlia Tavares', tags: 'Corporativo · Cases', rate: 'R$ 950', rating: '5.0', jobs: '87', tone: 3, premium: true },
  ]
  return (
    <section style={{ padding: '90px 56px', borderBottom: `1px solid ${C.border}` }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginBottom: 36,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: C.dm,
              fontSize: 12.5,
              color: C.orange,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: 14,
            }}
          >
            · Editores em destaque
          </div>
          <h2
            style={{
              fontFamily: C.syne,
              fontWeight: 800,
              fontSize: 48,
              color: '#fff',
              letterSpacing: '-0.03em',
              lineHeight: 1.05,
              margin: 0,
            }}
          >
            Talentos verificados
            <br />
            prontos para cortar.
          </h2>
        </div>
        <button
          onClick={onRegister}
          style={{
            fontFamily: C.syne,
            fontWeight: 600,
            fontSize: 14,
            padding: '10px 18px',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.06)',
            color: '#fff',
            border: `1px solid ${C.border}`,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          Ver todos os editores <IconArrowRight size={14} stroke={2.2} />
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
        {editors.map((e) => (
          <div
            key={e.name}
            style={{
              background: C.navyMid,
              borderRadius: 12,
              padding: 18,
              border: `1px solid ${C.border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              cursor: 'pointer',
              transition: 'transform .15s, border-color .15s',
            }}
            onMouseEnter={(ev) => {
              ev.currentTarget.style.transform = 'translateY(-2px)'
              ev.currentTarget.style.borderColor = 'rgba(244,99,30,0.3)'
            }}
            onMouseLeave={(ev) => {
              ev.currentTarget.style.transform = 'none'
              ev.currentTarget.style.borderColor = C.border
            }}
          >
            <Thumb aspect="16/10" label="PORTFÓLIO" tone={e.tone} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar
                  size={34}
                  name={e.name.split(' ').map((n) => n[0]).join('')}
                  tone={e.tone}
                />
                <div>
                  <div
                    style={{
                      fontFamily: C.syne,
                      fontWeight: 700,
                      fontSize: 14,
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    {e.name} {e.premium && <IconRosetteDiscountCheckFilled size={12} color={C.orange} />}
                  </div>
                  <div style={{ fontFamily: C.dm, fontSize: 11.5, color: C.text60, marginTop: 1 }}>
                    {e.tags}
                  </div>
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  fontFamily: C.dm,
                  fontSize: 12,
                  color: '#fff',
                  fontWeight: 500,
                }}
              >
                <IconStarFilled size={11} color={C.orange} /> {e.rating}
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: 10,
                borderTop: `1px solid ${C.border}`,
              }}
            >
              <div style={{ fontFamily: C.dm, fontSize: 12, color: C.text60 }}>
                desde <b style={{ color: '#fff', fontWeight: 600 }}>{e.rate}</b>
              </div>
              <div style={{ fontFamily: C.dm, fontSize: 11, color: C.text40 }}>{e.jobs} jobs</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar() {
  const stats = [
    { n: '2.4k', l: 'Editores ativos' },
    { n: '18.7k', l: 'Vídeos entregues' },
    { n: '4.92', l: 'Avaliação média' },
    { n: '94%', l: 'Aprovação na 1ª entrega' },
  ]
  return (
    <section style={{ padding: '70px 56px', background: C.orange }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32 }}>
        {stats.map((s) => (
          <div key={s.l}>
            <div
              style={{
                fontFamily: C.syne,
                fontWeight: 800,
                fontSize: 64,
                color: '#fff',
                letterSpacing: '-0.04em',
                lineHeight: 1,
              }}
            >
              {s.n}
            </div>
            <div
              style={{
                fontFamily: C.dm,
                fontSize: 14,
                color: 'rgba(255,255,255,0.85)',
                marginTop: 8,
                fontWeight: 500,
              }}
            >
              {s.l}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── CTA ─────────────────────────────────────────────────────────────────────

function CTA({ onRegister }: { onRegister: () => void }) {
  return (
    <section style={{ padding: '90px 56px', borderBottom: `1px solid ${C.border}` }}>
      <div
        style={{
          background: C.navyMid,
          borderRadius: 20,
          padding: '64px 64px',
          border: `1px solid ${C.border}`,
          display: 'grid',
          gridTemplateColumns: '1.3fr 1fr',
          gap: 60,
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            right: -80,
            top: -80,
            width: 280,
            height: 280,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${C.orangeSoft}, transparent 70%)`,
          }}
        />
        <div style={{ position: 'relative' }}>
          <h2
            style={{
              fontFamily: C.syne,
              fontWeight: 800,
              fontSize: 44,
              color: '#fff',
              letterSpacing: '-0.03em',
              lineHeight: 1.05,
              margin: 0,
            }}
          >
            Comece com o primeiro
            <br />
            vídeo grátis.
          </h2>
          <p
            style={{
              fontFamily: C.dm,
              fontSize: 16,
              color: C.text80,
              lineHeight: 1.55,
              marginTop: 18,
              maxWidth: 460,
            }}
          >
            Crie sua conta como criador e ganhe R$ 100 de crédito para testar o primeiro corte. Sem cartão.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
            <button
              onClick={onRegister}
              style={{
                fontFamily: C.syne,
                fontWeight: 600,
                fontSize: 15,
                padding: '12px 22px',
                borderRadius: 8,
                border: 'none',
                background: C.orange,
                color: '#fff',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              Criar conta grátis <IconArrowRight size={16} stroke={2.2} />
            </button>
            <button
              style={{
                fontFamily: C.syne,
                fontWeight: 600,
                fontSize: 15,
                padding: '12px 22px',
                borderRadius: 8,
                background: 'transparent',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Falar com vendas
            </button>
          </div>
        </div>
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { icon: <IconShieldCheck size={18} color={C.orange} />, t: 'Pagamento em escrow', d: 'Liberado só após sua aprovação' },
            { icon: <IconBolt size={18} color={C.orange} />, t: 'Entrega rápida', d: 'Editores premium em 24-72h' },
            { icon: <IconUsers size={18} color={C.orange} />, t: 'Suporte humano', d: 'Time CutMakers no WhatsApp' },
          ].map((b) => (
            <div
              key={b.t}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 18px',
                background: C.navy,
                borderRadius: 10,
                border: `1px solid ${C.border}`,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: C.orangeSoft,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {b.icon}
              </div>
              <div>
                <div style={{ fontFamily: C.syne, fontWeight: 700, fontSize: 14, color: '#fff' }}>
                  {b.t}
                </div>
                <div style={{ fontFamily: C.dm, fontSize: 12.5, color: C.text60, marginTop: 1 }}>
                  {b.d}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  const cols = [
    { t: 'Produto', items: ['Como funciona', 'Categorias', 'Editores em destaque', 'Preços'] },
    { t: 'Para editores', items: ['Virar editor', 'Plano premium', 'Diretrizes', 'Suporte'] },
    { t: 'Empresa', items: ['Sobre', 'Carreiras', 'Imprensa', 'Contato'] },
    { t: 'Legal', items: ['Termos de uso', 'Privacidade', 'Cookies', 'LGPD'] },
  ]
  return (
    <footer style={{ padding: '64px 56px 32px' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr',
          gap: 40,
          marginBottom: 48,
        }}
      >
        <div>
          <CMLockup size={36} wordSize={22} variant="orange" />
          <p
            style={{
              fontFamily: C.dm,
              fontSize: 13.5,
              color: C.text60,
              lineHeight: 1.55,
              marginTop: 16,
              maxWidth: 280,
            }}
          >
            Marketplace brasileiro de edição de vídeo. Conectando criadores e editores desde 2026.
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.t}>
            <div
              style={{
                fontFamily: C.syne,
                fontWeight: 700,
                fontSize: 14,
                color: '#fff',
                marginBottom: 16,
              }}
            >
              {c.t}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {c.items.map((i) => (
                <span
                  key={i}
                  style={{ fontFamily: C.dm, fontSize: 13.5, color: C.text60, cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = C.text60)}
                >
                  {i}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: 24,
          borderTop: `1px solid ${C.border}`,
          fontFamily: C.dm,
          fontSize: 12.5,
          color: C.text40,
        }}
      >
        <span>© 2026 CutMakers Tecnologia LTDA · CNPJ 00.000.000/0001-00</span>
        <span>Feito com ✂︎ em São Paulo</span>
      </div>
    </footer>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function LandingPage() {
  const navigate = useNavigate()
  const onLogin = () => navigate('/login')
  const onRegister = () => navigate('/register')

  return (
    <div style={{ background: C.navy, color: '#fff', minHeight: '100vh', fontFamily: C.dm }}>
      <Nav onLogin={onLogin} onRegister={onRegister} />
      <Hero onRegister={onRegister} />
      <Logos />
      <HowItWorks />
      <Categories />
      <FeaturedEditors onRegister={onRegister} />
      <StatsBar />
      <CTA onRegister={onRegister} />
      <Footer />
    </div>
  )
}
