import { z } from 'zod'
import { API_BASE_URL, USE_MOCKS } from '../app/providers'
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
  const base = API_BASE_URL || ''
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
