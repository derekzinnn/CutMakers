import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

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

    const token = jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: (process.env.JWT_EXPIRES_IN ?? '15m') as string,
    })

    const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
      expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ?? '7d') as string,
    })

    return { token, refreshToken }
  }

  verifyToken(token: string): TokenPayload {
    return jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload
  }

  verifyRefreshToken(token: string): TokenPayload {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as TokenPayload
  }
}
