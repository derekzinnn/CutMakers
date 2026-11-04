import type { ReactNode } from 'react'

export function SectionHead({
  eyebrow,
  title,
  children,
  aside,
}: {
  eyebrow: string
  title: ReactNode
  children?: ReactNode
  aside?: ReactNode
}) {
  return (
    <div className="mb-10 flex flex-col gap-6 lg:mb-12 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-2xl">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-brand">{eyebrow}</p>
        <h2 className="text-[clamp(1.75rem,3.6vw,2.4rem)] font-extrabold leading-[1.06] tracking-[-0.03em] text-foreground">
          {title}
        </h2>
        {children && <p className="mt-4 text-base leading-relaxed text-muted-foreground">{children}</p>}
      </div>
      {aside}
    </div>
  )
}
