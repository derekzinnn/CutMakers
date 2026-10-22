import { useEffect, useRef, useState } from 'react'
import { IconBrandGoogle } from '@tabler/icons-react'
import { loginWithGoogle } from '@/lib/account'
import { useAuth } from '@/hooks/use-auth'
import { useNavigate } from 'react-router-dom'

/**
 * Botão "Continuar com Google".
 *
 * Ativa SOMENTE quando VITE_GOOGLE_CLIENT_ID está definido (mesmo padrão
 * dev-mode do resto do sistema). Sem a credencial, mostra o botão desabilitado
 * "Em breve" — exatamente o que havia antes. Assim o código do fluxo completo
 * já está no lugar; é só o dono criar o OAuth Client no Google Cloud e setar a
 * env (frontend: VITE_GOOGLE_CLIENT_ID; backend: GOOGLE_CLIENT_ID).
 *
 * Usa Google Identity Services (ID token), que é o que /auth/google verifica.
 */

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: { client_id: string; callback: (r: { credential: string }) => void }) => void
          renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void
        }
      }
    }
  }
}

export function GoogleButton() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!CLIENT_ID || !ref.current) return

    async function onCredential(resp: { credential: string }) {
      setErro(null)
      try {
        const data = await loginWithGoogle(resp.credential)
        login(data.token, data.refreshToken, data.user)
        // Admin vai pro /admin; demais escolhem o painel no proprio fluxo pos-login
        navigate(data.user.role === 'ADMIN' ? '/admin' : '/dashboard/creator')
      } catch (e) {
        const err = e as { response?: { data?: { message?: string } } }
        setErro(err?.response?.data?.message ?? 'Não foi possível entrar com o Google')
      }
    }

    function init() {
      if (!window.google || !ref.current) return
      window.google.accounts.id.initialize({ client_id: CLIENT_ID!, callback: onCredential })
      window.google.accounts.id.renderButton(ref.current, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: 320,
      })
    }

    if (window.google) {
      init()
    } else {
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.onload = init
      document.head.appendChild(script)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sem credencial: o botão "Em breve" de antes
  if (!CLIENT_ID) {
    return (
      <button
        type="button"
        disabled
        title="Login com Google em breve"
        className="flex w-full items-center justify-center gap-2 rounded-[8px] py-2.5 text-sm font-medium"
        style={{
          background: 'var(--surface-subtle)',
          border: '1px solid var(--border)',
          color: 'var(--muted-foreground)',
          fontFamily: "'DM Sans', sans-serif",
          cursor: 'not-allowed',
          height: '42px',
        }}
      >
        <IconBrandGoogle size={16} stroke={1.5} />
        Continuar com Google
        <span
          className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase"
          style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}
        >
          Em breve
        </span>
      </button>
    )
  }

  return (
    <div>
      <div ref={ref} className="flex justify-center" />
      {erro && (
        <p className="mt-2 text-center text-xs" style={{ color: 'var(--destructive)' }}>
          {erro}
        </p>
      )}
    </div>
  )
}
