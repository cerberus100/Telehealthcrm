import { z } from 'zod'
import { request } from './http'
import { API_BASE_URL, USE_MOCKS } from '../app/providers'

export const MeSchema = z.object({
  user: z.object({ id: z.string(), email: z.string().email(), role: z.string(), org_id: z.string(), last_login_at: z.string().nullable() }),
  org: z.object({ id: z.string(), type: z.string(), name: z.string() })
})
export type Me = z.infer<typeof MeSchema>

const ConsultSummarySchema = z.object({
  id: z.string(),
  status: z.string(),
  created_at: z.string(),
  provider_org_id: z.string()
})
export const ConsultListSchema = z.object({ items: z.array(ConsultSummarySchema), next_cursor: z.string().nullable() })
export type ConsultList = z.infer<typeof ConsultListSchema>

const RxSchema = z.object({
  id: z.string(),
  status: z.string(),
  consult_id: z.string(),
  pharmacy_org_id: z.string(),
  refills_allowed: z.number(),
  refills_used: z.number(),
})
export const RxListSchema = z.object({ items: z.array(RxSchema), next_cursor: z.string().nullable() })
export type RxList = z.infer<typeof RxListSchema>

const ShipmentSchema = z.object({
  id: z.string(),
  lab_order_id: z.string(),
  carrier: z.string(),
  tracking_number: z.string(),
  status: z.string(),
  last_event_at: z.string(),
  ship_to: z.object({ name: z.string(), city: z.string(), state: z.string(), zip: z.string() })
})
export const ShipmentListSchema = z.object({ items: z.array(ShipmentSchema), next_cursor: z.string().nullable() })
export type ShipmentList = z.infer<typeof ShipmentListSchema>

const NotificationSchema = z.object({ id: z.string(), type: z.string(), created_at: z.string(), payload: z.record(z.any()).optional() })
export const NotificationListSchema = z.object({ items: z.array(NotificationSchema), next_cursor: z.string().nullable() })
export type NotificationList = z.infer<typeof NotificationListSchema>

async function http<T>(path: string, schema: z.ZodSchema<T>, init?: RequestInit): Promise<T> {
  if (USE_MOCKS) {
    if (path === '/me') {
      const mock = {
        user: { id: 'u_1', email: 'dr@example.com', role: 'DOCTOR', org_id: 'org_1', last_login_at: new Date().toISOString() },
        org: { id: 'org_1', type: 'PROVIDER', name: 'Acme Clinic' }
      }
      return schema.parse(mock)
    }
    if (path.startsWith('/consults')) {
      const mock = { items: [{ id: 'c_1', status: 'PASSED', created_at: new Date().toISOString(), provider_org_id: 'org_1' }], next_cursor: null }
      return schema.parse(mock)
    }
    if (path.startsWith('/rx')) {
      if (path === '/rx') {
        const mock = { items: [{ id: 'rx_1', status: 'SUBMITTED', consult_id: 'c_1', pharmacy_org_id: 'ph_1', refills_allowed: 2, refills_used: 0 }], next_cursor: null }
        return schema.parse(mock)
      }
      const mock = { id: 'rx_1', status: 'SUBMITTED', consult_id: 'c_1', pharmacy_org_id: 'ph_1', refills_allowed: 2, refills_used: 0 }
      return schema.parse(mock)
    }
    if (path.startsWith('/shipments')) {
      const mock = { items: [{ id: 'sh_1', lab_order_id: 'lo_1', carrier: 'UPS', tracking_number: '1Z...', status: 'IN_TRANSIT', last_event_at: new Date().toISOString(), ship_to: { name: 'John D', city: 'Austin', state: 'TX', zip: '78701' } }], next_cursor: null }
      return schema.parse(mock)
    }
    if (path.startsWith('/notifications')) {
      const mock = { items: [{ id: 'n_1', type: 'LAB_RESULT_READY', created_at: new Date().toISOString(), payload: { lab_order_id: 'lo_1' } }], next_cursor: null }
      return schema.parse(mock)
    }
  }
  return request(path, schema, init)
}

export const Api = {
  me: () => http('/me', MeSchema),
  consults: () => http('/consults', ConsultListSchema),
  rxList: () => http('/rx', RxListSchema),
  rxDetail: (id: string) => http(`/rx/${id}`, RxSchema),
  shipments: () => http('/shipments', ShipmentListSchema),
  notifications: () => http('/notifications', NotificationListSchema),
}
