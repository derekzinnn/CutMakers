import bcrypt from 'bcryptjs'
import jwt, { Secret, SignOptions } from 'jsonwebtoken'

interface TokenPayload {
  sub: string
  role: string
}

export class AuthService {
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10)
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash)
  }

  generateTokens(userId: string, role: string) {
    const payload: TokenPayload = { sub: userId, role }

    const secret: Secret = process.env.JWT_SECRET!
    const refreshSecret: Secret = process.env.JWT_REFRESH_SECRET!

    const tokenOptions: SignOptions = {
      expiresIn: (process.env.JWT_EXPIRES_IN ?? '15m') as SignOptions['expiresIn'],
    }
    const refreshOptions: SignOptions = {
      expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ?? '7d') as SignOptions['expiresIn'],
    }

    const token = jwt.sign(payload, secret, tokenOptions)
    const refreshToken = jwt.sign(payload, refreshSecret, refreshOptions)

    return { token, refreshToken }
  }

  /**
   * Verifica um ID token do Google chamando o endpoint oficial de tokeninfo,
   * que valida assinatura e expiracao. Confere que o `aud` casa com o nosso
   * GOOGLE_CLIENT_ID (senao qualquer token Google de outro app passaria).
   * Sem lib pesada (google-auth-library) — uma chamada HTTP basta.
   */
  async verifyGoogleToken(idToken: string): Promise<{ sub: string; email: string; name: string; picture: string | null }> {
    const clientId = process.env.GOOGLE_CLIENT_ID
    if (!clientId) {
      throw new Error('GOOGLE_CLIENT_ID nao configurado')
    }
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`)
    if (!res.ok) throw new Error('Token do Google invalido')
    const data = (await res.json()) as {
      aud?: string; sub?: string; email?: string; email_verified?: string | boolean; name?: string; picture?: string
    }
    if (data.aud !== clientId) throw new Error('Token do Google de outro aplicativo')
    if (!data.sub || !data.email) throw new Error('Token do Google sem email')
    const verified = data.email_verified === true || data.email_verified === 'true'
    if (!verified) throw new Error('Email do Google nao verificado')
    return { sub: data.sub, email: data.email.toLowerCase(), name: data.name ?? data.email, picture: data.picture ?? null }
  }

  verifyToken(token: string): TokenPayload {
    return jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload
  }

  verifyRefreshToken(token: string): TokenPayload {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as TokenPayload
  }
}
