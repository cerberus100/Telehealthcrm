import { z } from 'zod'
import { USE_MOCKS } from '../app/providers'

// Central API base URL: prefer explicit env, else infer from window hostname
function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const env = (window as any).NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL
    if (env) return env as string
    return `http://${window.location.hostname}:3001`
  }
  return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:3001'
}
import { getAuthHeader } from './auth'

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }
function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export async function request<T>(path: string, schema: z.ZodSchema<T>, init?: RequestInit): Promise<T> {
  // Mocking handled by callers that want it; fall through to network
  const method = (init?.method || 'GET').toUpperCase()
  const base = getApiBaseUrl()
  const correlationId = uuid()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Correlation-Id': correlationId,
    ...(getAuthHeader() ? { Authorization: getAuthHeader()! } : {}),
    ...(init?.headers as Record<string, string> | undefined),
  }
  if (method !== 'GET') headers['Idempotency-Key'] = headers['Idempotency-Key'] || uuid()

  const url = `${base}${path}`
  const maxRetries = 3
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, { ...init, headers, cache: 'no-store' })
    if (res.ok) {
      const json = (await res.json().catch(() => null)) as unknown
      return schema.parse(json)
    }
    // Retry on transient errors
    if ([429, 502, 503, 504].includes(res.status) && attempt < maxRetries) {
      const retryAfter = Number(res.headers.get('Retry-After') || 0)
      const backoff = retryAfter > 0 ? retryAfter * 1000 : (50 * 2 ** attempt) + Math.floor(Math.random() * 50)
      await sleep(backoff)
      continue
    }
    const body = await res.text().catch(() => '')
    const err = new Error(`HTTP ${res.status} ${res.statusText} (cid=${correlationId})\n${body}`)
    ;(err as any).correlationId = correlationId
    throw err
  }
  throw new Error(`Request failed after retries (cid=${correlationId})`)
}
