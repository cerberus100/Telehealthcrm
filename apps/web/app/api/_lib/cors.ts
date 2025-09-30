import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getEnv } from '../../lib/server/env'

function resolveAllowedOrigins(): string[] {
  const env = getEnv()
  const defaults = [
    'https://YOUR-LANDER.com',
    'http://localhost:3000',
    env.NEXT_PUBLIC_APP_URL,
  ]
  if (env.TELE_LANDER_ALLOWED_ORIGINS) {
    const extra = env.TELE_LANDER_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
    return [...defaults, ...extra]
  }
  return defaults
}

const allowedOrigins = new Set(resolveAllowedOrigins())
const allowHeaders = 'Content-Type, Authorization, X-Requested-With, X-Amz-Date, X-Amz-Security-Token, X-Amz-User-Agent'
const allowMethods = 'GET,POST,OPTIONS'

export function withCORS<T>(handler: (req: NextRequest, context: Record<string, unknown>) => Promise<NextResponse<T>> | NextResponse<T>) {
  return async (req: NextRequest, context: Record<string, unknown>) => {
    const origin = req.headers.get('origin')
    const response = await handler(req, context)
    if (origin && allowedOrigins.has(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin)
      response.headers.set('Access-Control-Allow-Credentials', 'true')
      response.headers.set('Access-Control-Allow-Headers', allowHeaders)
      response.headers.set('Access-Control-Allow-Methods', allowMethods)
      response.headers.set('Vary', 'Origin')
    }
    return response
  }
}

export function handleOptions(req: NextRequest): NextResponse {
  const origin = req.headers.get('origin')
  const res = new NextResponse(null, { status: 204 })
  if (origin && allowedOrigins.has(origin)) {
    res.headers.set('Access-Control-Allow-Origin', origin)
    res.headers.set('Access-Control-Allow-Credentials', 'true')
    res.headers.set('Access-Control-Allow-Headers', allowHeaders)
    res.headers.set('Access-Control-Allow-Methods', allowMethods)
    res.headers.set('Vary', 'Origin')
  }
  return res
}
