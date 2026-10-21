/**
 * Avatar compartilhado — antes copiado em 7 arquivos, com a MESMA função de
 * hash (`h * 31 + charCodeAt`) e paletas quase iguais em cada um.
 *
 * Mostra a foto se houver `url`, senão a inicial sobre uma cor derivada do nome
 * (determinística: o mesmo usuário tem sempre a mesma cor em toda a interface).
 *
 * A paleta é CATEGÓRICA — matizes distintos de propósito, para dois usuários
 * lado a lado não se confundirem. Por isso fica em hex cru, fora dos tokens do
 * tema (os `--chart-*` do preset são todos laranja/âmbar).
 */
export const AVATAR_PALETTE = [
  'var(--brand)',
  '#3B82F6',
  '#8B5CF6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#06B6D4',
] as const

/** Índice determinístico na paleta a partir do nome. */
export function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % AVATAR_PALETTE.length
  return AVATAR_PALETTE[h]
}

export function Avatar({
  name,
  url = null,
  size = 36,
}: {
  name: string
  url?: string | null
  size?: number
}) {
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full font-heading font-bold text-white"
      style={{ width: size, height: size, background: avatarColor(name), fontSize: size * 0.38 }}
    >
      {url ? (
        <img src={url} alt={name} className="h-full w-full object-cover" />
      ) : (
        (name.charAt(0) || '?').toUpperCase()
      )}
    </div>
  )
}
