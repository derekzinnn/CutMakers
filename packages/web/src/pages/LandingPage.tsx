import { useNavigate } from 'react-router-dom'
import { Header } from './landing/Header'
import { Hero } from './landing/Hero'
import { FormatsTicker, Needs } from './landing/Needs'
import { HowItWorks } from './landing/HowItWorks'
import { Audiences } from './landing/Audiences'
import { Editors } from './landing/Editors'
import { Faq, FinalCta, Footer, MobileBar } from './landing/Closing'
import './landing/landing.css'

/**
 * Landing pública. Estrutura e mecanismos vêm dos sites do acervo da Biig
 * (ver comentário de cada seção); identidade é a do app: tokens do preset,
 * Noto Sans + Nunito Sans, laranja --brand e o logo D.
 * Copy e regras citadas ficam em ./landing/content.ts.
 */
export function LandingPage() {
  const navigate = useNavigate()
  const onLogin = () => navigate('/login')
  const onRegister = () => navigate('/register')

  return (
    <div className="lp-root min-h-dvh bg-background font-sans text-foreground">
      <Header onLogin={onLogin} onRegister={onRegister} />
      <main>
        <Hero onRegister={onRegister} />
        <FormatsTicker />
        <Needs onRegister={onRegister} />
        <HowItWorks />
        <Audiences onRegister={onRegister} />
        <Editors onRegister={onRegister} />
        <Faq />
        <FinalCta onRegister={onRegister} />
      </main>
      <Footer />
      <MobileBar onRegister={onRegister} />
    </div>
  )
}
