// Logo D — Play + scrubber (escolha final do usuário no Claude Design)

interface CMLogoProps {
  size?: number
  variant?: 'orange' | 'navy' | 'inverse'
}

export function CMLogo({ size = 40, variant = 'orange' }: CMLogoProps) {
  const bg =
    variant === 'orange' ? 'var(--brand)' : variant === 'navy' ? 'var(--card)' : 'transparent'
  const fg = variant === 'navy' ? 'var(--brand)' : 'var(--foreground)'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 84 84"
      fill="none"
      style={{ flexShrink: 0, display: 'block' }}
    >
      <rect width="84" height="84" rx={size > 32 ? 18 : 14} fill={bg} />
      {/* timeline bars */}
      <rect x="14" y="20" width="56" height="3" rx="1.5" fill={fg} opacity="0.45" />
      <rect x="14" y="61" width="56" height="3" rx="1.5" fill={fg} opacity="0.45" />
      {/* play triangle */}
      <path d="M30 28 L58 42 L30 56 Z" fill={fg} />
      {/* scrubber playhead */}
      <rect x="49.5" y="14" width="2.5" height="56" rx="1.25" fill={fg} />
      <rect x="46" y="11" width="9.5" height="5" rx="1.2" fill={fg} />
    </svg>
  )
}

export function CMLockup({
  size = 36,
  wordSize,
  color = 'var(--foreground)',
  variant = 'orange',
  gap = 10,
}: CMLogoProps & { wordSize?: number; color?: string; gap?: number }) {
  const ws = wordSize ?? Math.round((size ?? 36) * 0.6)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap }}>
      <CMLogo size={size} variant={variant} />
      <div
        style={{
          fontFamily: "var(--font-heading)",
          fontWeight: 800,
          fontSize: ws,
          color,
          letterSpacing: '-0.02em',
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}
      >
        Cut<span style={{ fontWeight: 500 }}>Makers</span>
      </div>
    </div>
  )
}

/**
 * Marca como botão de recolher o menu. SVG animado (logo-animada-hover.svg): a animação
 * toca no hover e também ao clicar (`cutting`) — ver `.cm-cut` em index.css.
 */
export function CMCutLogo({
  size = 30,
  cutting,
  onClick,
  label,
  expanded,
}: {
  size?: number
  cutting: boolean
  onClick: () => void
  label: string
  expanded: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-expanded={expanded}
      className={`cm-cut${cutting ? ' is-cutting' : ''}`}
    >
      <svg width={size} height={size} viewBox="0 0 84 84" fill="none" aria-hidden="true">
        <rect width="84" height="84" rx="18" fill="var(--brand)" />
        <g className="slice-left">
          <rect x="14" y="20" width="56" height="3" rx="1.5" fill="#fff" opacity="0.45" />
          <rect x="14" y="61" width="56" height="3" rx="1.5" fill="#fff" opacity="0.45" />
          <path className="play" d="M30 28 L58 42 L30 56 Z" fill="#fff" />
        </g>
        <g className="slice-right">
          <rect className="cut-glow" x="47" y="17" width="7" height="50" rx="3.5" fill="#fff" />
        </g>
        <rect className="blade" x="49.5" y="14" width="2.5" height="56" rx="1.25" fill="#fff" />
        <rect className="blade" x="46" y="11" width="9.5" height="5" rx="1.2" fill="#fff" />
      </svg>
    </button>
  )
}
