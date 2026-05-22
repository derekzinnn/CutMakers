// Logo D — Play + scrubber (escolha final do usuário no Claude Design)

interface CMLogoProps {
  size?: number
  variant?: 'orange' | 'navy' | 'inverse'
}

export function CMLogo({ size = 40, variant = 'orange' }: CMLogoProps) {
  const bg =
    variant === 'orange' ? '#F4631E' : variant === 'navy' ? '#162436' : 'transparent'
  const fg = variant === 'navy' ? '#F4631E' : '#FFFFFF'

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
  color = '#FFFFFF',
  variant = 'orange',
  gap = 10,
}: CMLogoProps & { wordSize?: number; color?: string; gap?: number }) {
  const ws = wordSize ?? Math.round((size ?? 36) * 0.6)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap }}>
      <CMLogo size={size} variant={variant} />
      <div
        style={{
          fontFamily: "'Syne', sans-serif",
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
