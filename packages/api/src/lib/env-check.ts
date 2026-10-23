// Validação dos segredos de autenticação na subida do servidor.
// Em produção, config insegura derruba o boot (fail-closed) em vez de rodar assinando
// tokens com um segredo adivinhável. Em dev só avisa, para não travar o ambiente local.

const PLACEHOLDER = /(troque|change[-_ ]?me|your[-_ ]?secret|example|exemplo|placeholder|default|secret123|senha)/i
const MIN_LENGTH = 32

export interface EnvIssues {
  errors: string[]
  warnings: string[]
}

export function checkAuthSecrets(env: NodeJS.ProcessEnv = process.env): EnvIssues {
  const errors: string[] = []
  const warnings: string[] = []

  const named = [
    ['JWT_SECRET', env.JWT_SECRET],
    ['JWT_REFRESH_SECRET', env.JWT_REFRESH_SECRET],
  ] as const

  for (const [name, value] of named) {
    if (!value) {
      errors.push(`${name} não está definido`)
      continue
    }
    if (PLACEHOLDER.test(value)) errors.push(`${name} parece um valor de exemplo — gere um segredo novo`)
    if (value.length < MIN_LENGTH) {
      warnings.push(`${name} tem ${value.length} caracteres (recomendado ≥ ${MIN_LENGTH}; use: openssl rand -base64 48)`)
    }
  }

  if (env.JWT_SECRET && env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
    errors.push('JWT_SECRET e JWT_REFRESH_SECRET são iguais — um refresh token seria aceito como access token')
  }

  return { errors, warnings }
}

/** Chamada no boot. Em produção, qualquer erro aborta o processo. */
export function assertAuthSecrets(env: NodeJS.ProcessEnv = process.env): void {
  const { errors, warnings } = checkAuthSecrets(env)
  const prod = env.NODE_ENV === 'production'

  for (const w of warnings) console.warn(`[config] aviso: ${w}`)

  if (errors.length === 0) return
  if (prod) {
    throw new Error(`Configuração de segurança inválida:\n - ${errors.join('\n - ')}`)
  }
  for (const e of errors) console.warn(`[config] aviso (bloquearia em produção): ${e}`)
}
