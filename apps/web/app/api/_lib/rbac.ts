import { NextRequest } from 'next/server'
import { verifyAccessToken } from '../../lib/server/auth'

export type Role = 'ADMIN' | 'CLINICIAN' | 'PATIENT'

export class AuthError extends Error {
  constructor(message: string, public status: number) {
    super(message)
    this.name = 'AuthError'
  }
}

export interface AuthContext {
  claims: Awaited<ReturnType<typeof verifyAccessToken>>
}

export async function requireAuth(req: NextRequest, allowed: Role[]): Promise<AuthContext> {
  const header = req.headers.get('authorization')
  if (!header || !header.startsWith('Bearer ')) {
    throw new AuthError('Unauthorized', 401)
  }
  const token = header.slice('Bearer '.length)
  const claims = await verifyAccessToken(token).catch(() => { throw new AuthError('Unauthorized', 401) })
  if (!claims.role || !allowed.includes(claims.role as Role)) {
    throw new AuthError('Forbidden', 403)
  }
  return { claims }
}
