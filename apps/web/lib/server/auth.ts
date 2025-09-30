import { jwtVerify, createRemoteJWKSet } from 'jose'
import { getEnv } from './env'

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null

export interface Claims {
  sub: string
  email?: string
  role?: string
  orgId?: string
  allowedStates?: string[]
}

export async function verifyAccessToken(token?: string): Promise<Claims> {
  if (!token) throw new Error('Missing access token')
  const env = getEnv()
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${env.COGNITO_ISSUER}/.well-known/jwks.json`))
  }

  const { payload } = await jwtVerify(token, jwks, {
    issuer: env.COGNITO_ISSUER,
    audience: env.COGNITO_AUDIENCE,
  })

  const allowedStates = Array.isArray(payload['custom:allowed_states'])
    ? (payload['custom:allowed_states'] as string[])
    : typeof payload['custom:allowed_states'] === 'string'
      ? (payload['custom:allowed_states'] as string).split(',').map((s) => s.trim()).filter(Boolean)
      : undefined

  return {
    sub: payload.sub as string,
    email: payload.email as string | undefined,
    role: payload['custom:role'] as string | undefined,
    orgId: payload['custom:org_id'] as string | undefined,
    allowedStates,
  }
}

export function requireRole(claims: Claims, allowed: string[]): void {
  if (!claims.role || !allowed.includes(claims.role)) {
    throw new Error('Forbidden')
  }
}
