/**
 * Avatar compartilhado.
 *
 * Mostra a foto se houver `url`, senão a inicial sobre a cor da marca. Cor ÚNICA de
 * propósito: uma paleta categórica (azul/roxo/verde…) fazia a interface parecer ter
 * várias identidades visuais — o usuário logado era verde no cabeçalho e laranja no
 * perfil. A identidade de cada pessoa vem da foto e do nome, não de um matiz.
 */
export const AVATAR_PALETTE = ['var(--brand)'] as const

/** Mantida por compatibilidade com quem importa; hoje é sempre a cor da marca. */
export function avatarColor(_name: string): string {
  return AVATAR_PALETTE[0]
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
