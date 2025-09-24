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
export const ConsultListSchema = z.object({ items: z.array(ConsultSummarySchema), next_cursor: z.string().optional() })
export type ConsultList = z.infer<typeof ConsultListSchema>

const RxSchema = z.object({
  id: z.string(),
  status: z.string(),
  consult_id: z.string(),
  pharmacy_org_id: z.string(),
  refills_allowed: z.number(),
  refills_used: z.number(),
})
export const RxListSchema = z.object({ items: z.array(RxSchema), next_cursor: z.string().optional() })
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
export const ShipmentListSchema = z.object({ items: z.array(ShipmentSchema), next_cursor: z.string().optional() })
export type ShipmentList = z.infer<typeof ShipmentListSchema>

const NotificationSchema = z.object({ id: z.string(), type: z.string(), created_at: z.string(), payload: z.record(z.any()).optional() })
export const NotificationListSchema = z.object({ items: z.array(NotificationSchema), next_cursor: z.string().optional() })
export type NotificationList = z.infer<typeof NotificationListSchema>

const LabOrderSchema = z.object({
  id: z.string(),
  status: z.string(),
  consult_id: z.string(),
  lab_org_id: z.string(),
  tests: z.array(z.string()),
  created_at: z.string(),
})
export const LabOrderListSchema = z.object({ items: z.array(LabOrderSchema), next_cursor: z.string().optional() })
export type LabOrderList = z.infer<typeof LabOrderListSchema>

const LabResultSchema = z.object({
  id: z.string(),
  lab_order_id: z.string(),
  flagged_abnormal: z.boolean().nullable(),
  released_to_provider_at: z.string().nullable(),
  result_blob_encrypted: z.string().optional(), // Only for authorized roles
})
export const LabResultListSchema = z.object({ items: z.array(LabResultSchema), next_cursor: z.string().optional() })
export type LabResultList = z.infer<typeof LabResultListSchema>

// Auth
const AuthLoginResponseSchema = z.object({ access_token: z.string(), refresh_token: z.string() })
export type AuthLoginResponse = z.infer<typeof AuthLoginResponseSchema>

// Analytics
const DashboardMetricsSchema = z.object({
  consultsApproved: z.object({
    value: z.number(),
    delta: z.number(),
    trend: z.enum(['up', 'down']),
    sparkline: z.array(z.number())
  }),
  avgTurnaroundTime: z.object({
    value: z.number(),
    suffix: z.string(),
    delta: z.number(),
    trend: z.enum(['up', 'down']),
    sparkline: z.array(z.number())
  }).optional(),
  kitsInTransit: z.object({
    value: z.number(),
    delta: z.number(),
    trend: z.enum(['up', 'down']),
    sparkline: z.array(z.number())
  }),
  resultsAging: z.object({
    value: z.number(),
    delta: z.number(),
    trend: z.enum(['up', 'down']),
    sparkline: z.array(z.number())
  })
})
export type DashboardMetrics = z.infer<typeof DashboardMetricsSchema>

const OperationalMetricsSchema = z.object({
  avgTurnaroundTime: z.object({
    value: z.number(),
    suffix: z.string(),
    delta: z.number(),
    trend: z.enum(['up', 'down']),
    sparkline: z.array(z.number())
  }),
  processingEfficiency: z.object({
    value: z.number(),
    suffix: z.string(),
    delta: z.number(),
    trend: z.enum(['up', 'down'])
  }),
  resourceUtilization: z.object({
    value: z.number(),
    suffix: z.string(),
    delta: z.number(),
    trend: z.enum(['up', 'down'])
  })
})
export type OperationalMetrics = z.infer<typeof OperationalMetricsSchema>

const ClientSchema = z.object({
  id: z.string(),
  name: z.string(),
  org_id: z.string(),
  contact_email: z.string(),
  status: z.string(),
  created_at: z.string(),
})
export const ClientListSchema = z.object({ items: z.array(ClientSchema), next_cursor: z.string().optional() })
export type ClientList = z.infer<typeof ClientListSchema>

const RequisitionTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  fields: z.array(z.object({
    name: z.string(),
    type: z.string(),
    required: z.boolean(),
  })),
  created_by_org_id: z.string(),
  published_at: z.string().nullable(),
})
export const RequisitionTemplateListSchema = z.object({ items: z.array(RequisitionTemplateSchema), next_cursor: z.string().optional() })
export type RequisitionTemplateList = z.infer<typeof RequisitionTemplateListSchema>

async function http<T>(path: string, schema: z.ZodSchema<T>, init?: RequestInit): Promise<T> {
  if (USE_MOCKS) {
    // Handle auth/login first
    if (path === '/auth/login') {
      const mock = { access_token: 'mock_access_user123', refresh_token: 'mock_refresh_user123' }
      return schema.parse(mock)
    }

    if (path === '/me') {
      const mock = {
        user: { id: 'u_1', email: 'dr@example.com', role: 'DOCTOR', org_id: 'org_1', last_login_at: new Date().toISOString() },
        org: { id: 'org_1', type: 'PROVIDER', name: 'Acme Clinic' }
      }
      return schema.parse(mock)
    }
    if (path.startsWith('/consults')) {
      const mock = { items: [{ id: 'c_1', status: 'PASSED', created_at: new Date().toISOString(), provider_org_id: 'org_1' }], next_cursor: undefined }
      return schema.parse(mock)
    }
    if (path.startsWith('/rx')) {
      if (path === '/rx') {
        const mock = { items: [{ id: 'rx_1', status: 'SUBMITTED', consult_id: 'c_1', pharmacy_org_id: 'ph_1', refills_allowed: 2, refills_used: 0 }], next_cursor: undefined }
        return schema.parse(mock)
      }
      const mock = { id: 'rx_1', status: 'SUBMITTED', consult_id: 'c_1', pharmacy_org_id: 'ph_1', refills_allowed: 2, refills_used: 0 }
      return schema.parse(mock)
    }
    if (path.startsWith('/shipments')) {
      const mock = { items: [{ id: 'sh_1', lab_order_id: 'lo_1', carrier: 'UPS', tracking_number: '1Z...', status: 'IN_TRANSIT', last_event_at: new Date().toISOString(), ship_to: { name: 'John D', city: 'Austin', state: 'TX', zip: '78701' } }], next_cursor: undefined }
      return schema.parse(mock)
    }
    if (path.startsWith('/notifications')) {
      const mock = { items: [{ id: 'n_1', type: 'LAB_RESULT_READY', created_at: new Date().toISOString(), payload: { lab_order_id: 'lo_1' } }], next_cursor: undefined }
      return schema.parse(mock)
    }
    if (path.startsWith('/lab-orders')) {
      if (path === '/lab-orders') {
        const mock = { items: [{ id: 'lo_1', status: 'SUBMITTED', consult_id: 'c_1', lab_org_id: 'lab_1', tests: ['COVID-19', 'Flu A/B'], created_at: new Date().toISOString() }], next_cursor: undefined }
        return schema.parse(mock)
      }
      const mock = { id: 'lo_1', status: 'SUBMITTED', consult_id: 'c_1', lab_org_id: 'lab_1', tests: ['COVID-19', 'Flu A/B'], created_at: new Date().toISOString() }
      return schema.parse(mock)
    }
    if (path.startsWith('/lab-results')) {
      const mock = { items: [{ id: 'lr_1', lab_order_id: 'lo_1', flagged_abnormal: false, released_to_provider_at: new Date().toISOString() }], next_cursor: undefined }
      return schema.parse(mock)
    }
    if (path.startsWith('/clients')) {
      if (path === '/clients') {
        const mock = { items: [{ id: 'cl_1', name: 'Acme Provider', org_id: 'org_provider', contact_email: 'contact@acme.com', status: 'ACTIVE', created_at: new Date().toISOString() }], next_cursor: undefined }
        return schema.parse(mock)
      }
      const mock = { id: 'cl_1', name: 'Acme Provider', org_id: 'org_provider', contact_email: 'contact@acme.com', status: 'ACTIVE', created_at: new Date().toISOString() }
      return schema.parse(mock)
    }
    if (path.startsWith('/requisition-templates')) {
      const mock = { items: [{
        id: 'rt_1',
        name: 'COVID-19 Test Kit',
        version: '1.0',
        fields: [
          { name: 'patient_name', type: 'text', required: true },
          { name: 'dob', type: 'date', required: true },
          { name: 'symptoms', type: 'textarea', required: false }
        ],
        created_by_org_id: 'org_lab',
        published_at: new Date().toISOString()
      }], next_cursor: undefined }
      return schema.parse(mock)
    }
    if (path === '/operational-analytics/metrics') {
      const mock = {
        consultsApproved: {
          value: 128,
          delta: 5,
          trend: 'up' as const,
          sparkline: [5, 7, 8, 9, 10, 9, 12, 14]
        },
        kitsInTransit: {
          value: 42,
          delta: 2,
          trend: 'up' as const,
          sparkline: [20, 22, 25, 28, 30, 33, 38, 42]
        },
        resultsAging: {
          value: 3,
          delta: -1,
          trend: 'down' as const,
          sparkline: [6, 5, 5, 4, 4, 4, 3, 3]
        }
      }
      return schema.parse(mock)
    }
    if (path === '/operational-analytics/operational-metrics') {
      const mock = {
        avgTurnaroundTime: {
          value: 2.4,
          suffix: 'h',
          delta: -8,
          trend: 'down' as const,
          sparkline: [3.2, 3.0, 2.9, 2.8, 2.7, 2.6, 2.5, 2.4]
        },
        processingEfficiency: {
          value: 94.2,
          suffix: '%',
          delta: 2.1,
          trend: 'up' as const
        },
        resourceUtilization: {
          value: 78.5,
          suffix: '%',
          delta: -1.2,
          trend: 'down' as const
        }
      }
      return schema.parse(mock)
    }

    // If no mock found and USE_MOCKS is true, return a basic mock
    if (USE_MOCKS) {
      console.warn(`No mock found for path: ${path}, returning empty mock`)
      return schema.parse({} as T)
    }
  }
  return request(path, schema, init)
}

export const Api = {
  me: () => http('/auth/me', MeSchema),
  consults: () => http('/consults', ConsultListSchema),
  rxList: () => http('/rx', RxListSchema),
  rxDetail: (id: string) => http(`/rx/${id}`, RxSchema),
  shipments: () => http('/shipments', ShipmentListSchema),
  notifications: () => http('/notifications', NotificationListSchema),
  labOrders: () => http('/lab-orders', LabOrderListSchema),
  labOrderDetail: (id: string) => http(`/lab-orders/${id}`, LabOrderSchema),
  labResults: () => http('/lab-results', LabResultListSchema),
  labResultDetail: (id: string) => http(`/lab-results/${id}`, LabResultSchema),
  clients: () => http('/clients', ClientListSchema),
  clientDetail: (id: string) => http(`/clients/${id}`, ClientSchema),
  requisitionTemplates: () => http('/requisition-templates', RequisitionTemplateListSchema),
  requisitionTemplateDetail: (id: string) => http(`/requisition-templates/${id}`, RequisitionTemplateSchema),
  authLogin: (email: string, password: string) => http('/auth/login', AuthLoginResponseSchema, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email || '', password: password || '' }),
  }),
  // Analytics
  dashboardMetrics: () => http('/operational-analytics/metrics', DashboardMetricsSchema),
  operationalMetrics: () => http('/operational-analytics/operational-metrics', OperationalMetricsSchema),
  // Generic helpers for forms/files
  get: async (path: string) => request(path, z.any()),
  postJson: async (path: string, body: unknown) => request(path, z.any(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
  postForm: async (path: string, form: FormData) => {
    const base = (typeof window !== 'undefined' && ((window as any).NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL)) || 'http://127.0.0.1:3001'
    const authHeader = typeof window !== 'undefined' ? (() => {
      const raw = window.localStorage.getItem('auth')
      if (!raw) return null
      const { token } = JSON.parse(raw) as any
      return token ? `Bearer ${token}` : null
    })() : null
    const res = await fetch(`${base}${path}`, { method: 'POST', body: form, headers: { ...(authHeader ? { Authorization: authHeader } : {}) } })
    if (!res.ok) throw new Error('Upload failed')
    return res.json().catch(()=>null)
  },
}
