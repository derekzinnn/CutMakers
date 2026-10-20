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

  verifyToken(token: string): TokenPayload {
    return jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload
  }

  verifyRefreshToken(token: string): TokenPayload {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as TokenPayload
  }
}
