import { http, HttpResponse } from 'msw'

export const handlers = [
  http.get('/me', () => {
    return HttpResponse.json({
      user: { id: 'u_1', email: 'dr@example.com', role: 'DOCTOR', org_id: 'org_1', last_login_at: new Date().toISOString() },
      org: { id: 'org_1', type: 'PROVIDER', name: 'Acme Clinic' }
    })
  }),
  http.get('/consults', () => {
    return HttpResponse.json({ items: [{ id: 'c_1', status: 'PASSED', created_at: new Date().toISOString(), provider_org_id: 'org_1' }], next_cursor: null })
  }),
  http.get('/shipments', () => {
    return HttpResponse.json({ items: [{ id: 'sh_1', lab_order_id: 'lo_1', carrier: 'UPS', tracking_number: '1Z...', status: 'IN_TRANSIT', last_event_at: new Date().toISOString(), ship_to: { name: 'John D', city: 'Austin', state: 'TX', zip: '78701' } }], next_cursor: null })
  })
]
