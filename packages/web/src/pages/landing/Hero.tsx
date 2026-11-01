import { useEffect, useRef, useState } from 'react'
import {
  IconArrowRight,
  IconFileCertificate,
  IconPlayerPlayFilled,
  IconScale,
  IconShieldCheck,
  IconVideo,
} from '@tabler/icons-react'
import { prefersReducedMotion } from './motion'

/*
 * A peça central da landing é o material do negócio se mexendo (como as placas
 * do site de energia solar do acervo): uma timeline de edição em que a agulha
 * percorre o vídeo, os clipes vão sendo cortados e o pedido avança até o
 * pagamento liberado. Conta a história do produto sem uma linha de texto a mais.
 */

const LOOP_MS = 11000
const TOTAL_SECONDS = 222 // 03:42, duração do "episódio" de exemplo
const FPS = 30

const STAGES = [
  { at: 0, label: 'Bruto enviado' },
  { at: 0.18, label: 'Em edição' },
  { at: 0.46, label: 'Entrega v2 recebida' },
  { at: 0.72, label: 'Aprovado pelo criador' },
  { at: 0.88, label: 'Pagamento liberado' },
]

// left/width em % da trilha
const VIDEO = [
  { l: 0, w: 17 },
  { l: 17.6, w: 23 },
  { l: 41.2, w: 13 },
  { l: 54.8, w: 26 },
  { l: 81.4, w: 18.6 },
]
const CAPTIONS = [
  { l: 3, w: 11 },
  { l: 20, w: 15 },
  { l: 44, w: 8 },
  { l: 58, w: 17 },
  { l: 84, w: 12 },
]
const WAVE = Array.from({ length: 56 }, (_, i) =>
  Math.round(28 + 60 * Math.abs(Math.sin(i * 0.7) * Math.cos(i * 0.23))),
)

function stageAt(t: number) {
  let idx = 0
  STAGES.forEach((s, i) => {
    if (t >= s.at) idx = i
  })
  return idx
}

function timecode(t: number) {
  const total = t * TOTAL_SECONDS
  const m = Math.floor(total / 60)
  const s = Math.floor(total % 60)
  const f = Math.floor((total % 1) * FPS)
  return [m, s, f].map((n) => String(n).padStart(2, '0')).join(':')
}

function Timeline() {
  const rootRef = useRef<HTMLDivElement>(null)
  const tcRef = useRef<HTMLSpanElement>(null)
  const clipRefs = useRef<(HTMLDivElement | null)[]>([])
  const [stage, setStage] = useState(0)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const paint = (t: number) => {
      root.style.setProperty('--t', t.toFixed(4))
      if (tcRef.current) tcRef.current.textContent = timecode(t)
      VIDEO.forEach((c, i) => {
        const el = clipRefs.current[i]
        if (el) el.dataset.cut = String(t * 100 >= c.l + c.w)
      })
      const next = stageAt(t)
      setStage((prev) => (prev === next ? prev : next))
    }

    // Sem movimento: mostra o fim da história (tudo cortado, pagamento liberado)
    if (prefersReducedMotion()) {
      paint(0.999)
      return
    }

    let raf = 0
    let start = 0
    let visible = true
    let elapsedAtPause = 0

    const frame = (now: number) => {
      if (!start) start = now - elapsedAtPause
      const elapsed = (now - start) % LOOP_MS
      elapsedAtPause = elapsed
      paint(elapsed / LOOP_MS)
      if (visible) raf = requestAnimationFrame(frame)
    }

    // Fora da tela não gasta quadro
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      cancelAnimationFrame(raf)
      if (visible) {
        start = 0
        raf = requestAnimationFrame(frame)
      }
    })
    io.observe(root)

    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [])

  const done = stage === STAGES.length - 1

  return (
    <div
      ref={rootRef}
      className="lp-tl relative rounded-2xl border border-border bg-card p-3 shadow-2xl sm:p-4"
      role="img"
      aria-label="Exemplo de pedido na CutMakers: o vídeo bruto é editado, entregue, aprovado e o pagamento é liberado ao editor."
    >
      {/* Barra do "editor de vídeo" */}
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-surface-raised" />
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-surface-raised" />
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-surface-raised" />
          <span className="ml-2 truncate font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            ep12_podcast_bruto.mp4
          </span>
        </div>
        <span ref={tcRef} className="font-mono text-xs tabular-nums text-foreground">
          00:00:00
        </span>
      </div>

      {/* Monitor */}
      <div className="lp-texture relative aspect-video overflow-hidden rounded-lg border border-border bg-background">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-raised">
            <IconPlayerPlayFilled size={22} className="text-foreground" />
          </div>
        </div>
        <div className="absolute left-3 top-3 rounded-md bg-background px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          EP 12 · Podcast
        </div>
        <div
          className="lp-stage absolute bottom-3 left-3 rounded-full bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand"
          data-done={done}
          aria-hidden="true"
        >
          {STAGES[stage].label}
        </div>
      </div>

      {/* Trilhas */}
      <div className="mt-4 flex gap-2" aria-hidden="true">
        <div className="flex w-7 shrink-0 flex-col gap-1.5 font-mono text-[10px] leading-[26px] text-muted-foreground">
          <span>V2</span>
          <span>V1</span>
          <span>A1</span>
        </div>

        {/* A agulha (lp-playhead) atravessa as três trilhas */}
        <div className="lp-tl-tracks flex flex-1 flex-col gap-1.5">
          <div className="lp-track">
            {CAPTIONS.map((c, i) => (
              <div key={i} className="lp-clip" data-kind="caption" style={{ left: `${c.l}%`, width: `${c.w}%` }} />
            ))}
          </div>
          <div className="lp-track">
            {VIDEO.map((c, i) => (
              <div
                key={i}
                ref={(el) => {
                  clipRefs.current[i] = el
                }}
                className="lp-clip"
                data-kind="video"
                style={{ left: `${c.l}%`, width: `${c.w}%` }}
              />
            ))}
          </div>
          <div className="lp-track">
            <div className="lp-clip" style={{ left: 0, width: '100%' }}>
              <div className="lp-wave">
                {WAVE.map((h, i) => (
                  <span key={i} style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
          </div>
          <div className="lp-playhead" />
        </div>
      </div>
    </div>
  )
}

export function Hero({ onRegister }: { onRegister: () => void }) {
  return (
    <section id="topo" className="relative overflow-hidden">
      <div className="lp-glow -right-40 -top-40 h-[560px] w-[560px]" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-14 pt-10 sm:px-6 sm:pt-14 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:px-8 lg:pb-20">
        <div className="anim-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3.5 py-1.5 text-xs font-semibold tracking-wide text-brand">
            <IconVideo size={14} stroke={2} /> Marketplace de edição de vídeo
          </span>
          <h1 className="mt-6 text-[clamp(2.25rem,5.4vw,3.6rem)] font-extrabold leading-[1.02] tracking-[-0.035em] text-foreground">
            O editor certo para o seu vídeo, <span className="text-brand">no corte certo.</span>
          </h1>
          <p className="mt-5 max-w-[34rem] text-base leading-relaxed text-muted-foreground sm:text-[17px]">
            Encontre editores freelancers pelo portfólio, combine tudo em contrato e pague com segurança: o dinheiro
            só chega ao editor quando você aprova a entrega.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onRegister}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-brand px-6 font-heading text-[15px] font-semibold text-brand-foreground transition-colors hover:bg-brand-hover"
            >
              Encontrar editor <IconArrowRight size={17} stroke={2.2} />
            </button>
            <a
              href="#para-editores"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-border bg-surface px-6 font-heading text-[15px] font-semibold text-foreground transition-colors hover:bg-surface-raised"
            >
              Sou editor
            </a>
          </div>
          <ul className="mt-10 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3 sm:gap-4">
            {[
              { icon: IconShieldCheck, label: 'Pagamento retido até a aprovação' },
              { icon: IconFileCertificate, label: 'Contrato em cada pedido' },
              { icon: IconScale, label: 'Disputa mediada pela equipe' },
            ].map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2">
                <Icon size={17} className="shrink-0 text-brand" /> {label}
              </li>
            ))}
          </ul>
        </div>

        <Timeline />
      </div>
    </section>
  )
}
