import { z } from 'zod'
import { API_BASE_URL, USE_MOCKS } from '../app/providers'

export const MeSchema = z.object({
  user: z.object({ id: z.string(), email: z.string().email(), role: z.string(), org_id: z.string(), last_login_at: z.string().nullable() }),
  org: z.object({ id: z.string(), type: z.string(), name: z.string() })
})
export type Me = z.infer<typeof MeSchema>

async function http<T>(path: string, schema: z.ZodSchema<T>, init?: RequestInit): Promise<T> {
  if (USE_MOCKS) {
    // minimal mock for /me
    if (path === '/me') {
      const mock = {
        user: { id: 'u_1', email: 'dr@example.com', role: 'DOCTOR', org_id: 'org_1', last_login_at: new Date().toISOString() },
        org: { id: 'org_1', type: 'PROVIDER', name: 'Acme Clinic' }
      }
      return schema.parse(mock)
    }
  }
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    cache: 'no-store'
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${txt}`)
  }
  const json = (await res.json()) as unknown
  return schema.parse(json)
}

export const Api = {
  me: () => http('/me', MeSchema),
}
