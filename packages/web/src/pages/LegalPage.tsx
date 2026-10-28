import { Link } from 'react-router-dom'
import { CMLockup } from '@/components/ui/CMLogo'
import { PLATFORM_TERMS } from '@/lib/terms'
import { CONTACT_EMAIL, PRIVACY_POLICY } from '@/lib/privacy'

/** Páginas legais públicas (sem login): exigidas, por exemplo, pela tela de consentimento do Google. */
function LegalPage({ title, text }: { title: string; text: string }) {
  return (
    <div className="min-h-dvh" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Link to="/" aria-label="Voltar para a página inicial" style={{ textDecoration: 'none' }}>
          <CMLockup size={30} wordSize={18} />
        </Link>
        <nav className="flex gap-5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
          <Link to="/termos" style={{ color: 'inherit' }}>Termos de uso</Link>
          <Link to="/privacidade" style={{ color: 'inherit' }}>Privacidade</Link>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-16">
        <h1 className="mb-6 font-heading text-2xl font-bold">{title}</h1>
        <pre
          className="whitespace-pre-wrap text-sm leading-relaxed"
          style={{ fontFamily: 'var(--font-body)', margin: 0, color: 'var(--foreground)' }}
        >
          {text}
        </pre>
      </main>
    </div>
  )
}

export function PrivacyPage() {
  const contato = CONTACT_EMAIL
    ? `Escreva para ${CONTACT_EMAIL} informando o seu pedido e o e-mail da sua conta.`
    : 'Entre em contato pelos canais indicados na página inicial da CutMakers, informando o seu pedido e o e-mail da sua conta.'
  return <LegalPage title="Política de Privacidade" text={PRIVACY_POLICY.replace('{{CONTATO}}', contato)} />
}

export function TermsPage() {
  return <LegalPage title="Termos de Uso" text={PLATFORM_TERMS} />
}
