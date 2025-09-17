"use client"
import { useMemo, useState, useEffect } from 'react'
import { useApprovalUpdates } from '../../../lib/realtime'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../../lib/auth'

type Item = {
  id: string
  service: 'LABS' | 'RX'
  status: 'PENDING' | 'APPROVED' | 'DECLINED'
  patient: { name: string, initials: string, city?: string, state?: string }
  updated_at: string
}

export default function ApprovalsPage() {
  const { role } = useAuth()
  const { updates } = useApprovalUpdates()
  if (!(role === 'MARKETER' || role === 'MARKETER_ADMIN' || role === 'SUPER_ADMIN')) return <p>Access denied</p>

  // Show real-time updates banner
  useEffect(() => {
    if (updates.length > 0) {
      const latest = updates[0]
      console.log('Real-time approval update:', latest)
      // Could trigger toast notification or update UI
    }
  }, [updates])

  const { data } = useQuery({
    queryKey: ['marketer-approvals'],
    queryFn: async (): Promise<{ items: Item[] }> => ({
      items: [
        { id: 'c_101', service: 'LABS', status: 'APPROVED', patient: { name: 'Jane Doe', initials: 'JD', city: 'Austin', state: 'TX' }, updated_at: new Date().toISOString() },
        { id: 'c_102', service: 'RX', status: 'PENDING', patient: { name: 'John Smith', initials: 'JS' }, updated_at: new Date().toISOString() },
        { id: 'c_103', service: 'LABS', status: 'DECLINED', patient: { name: 'Mary J', initials: 'MJ', city: 'Dallas', state: 'TX' }, updated_at: new Date().toISOString() },
      ]
    })
  })

  const [service, setService] = useState('')
  const [status, setStatus] = useState('')
  const filtered = useMemo(() => {
    const items = data?.items ?? []
    return items.filter(i => (!service || i.service === service) && (!status || i.status === status))
  }, [data, service, status])

  const summary = useMemo(() => {
    const items = data?.items ?? []
    return {
      pending: items.filter(i => i.status === 'PENDING').length,
      approved: items.filter(i => i.status === 'APPROVED').length,
      declined: items.filter(i => i.status === 'DECLINED').length,
    }
  }, [data])

  const chip = (s: Item['status']) => {
    const cls = s === 'APPROVED' ? 'bg-green-100 text-green-800'
      : s === 'DECLINED' ? 'bg-red-100 text-red-800'
      : 'bg-yellow-100 text-yellow-800'
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{s}</span>
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Approvals</h1>
      <div className="flex gap-2 items-center">
        <div className="text-xs text-slate-600 mr-3">Summary: 
          <span className="ml-2 px-2 py-0.5 rounded bg-yellow-100 text-yellow-800">Pending {summary.pending}</span>
          <span className="ml-2 px-2 py-0.5 rounded bg-green-100 text-green-800">Approved {summary.approved}</span>
          <span className="ml-2 px-2 py-0.5 rounded bg-red-100 text-red-800">Declined {summary.declined}</span>
        </div>
        <select className="border rounded px-2 py-1" value={service} onChange={(e) => setService(e.target.value)}>
          <option value="">All Services</option>
          <option value="RX">Rx</option>
          <option value="LABS">Labs</option>
        </select>
        <select className="border rounded px-2 py-1" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="DECLINED">Declined</option>
        </select>
      </div>

      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="p-2 text-left">Consult</th>
            <th className="p-2 text-left">Service</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2 text-left">Updated</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((i) => (
            <tr key={i.id} className="border-t">
              <td className="p-2">{i.service === 'LABS' ? i.patient.name : i.patient.initials} <span className="text-slate-500">({i.id})</span></td>
              <td className="p-2">{i.service}</td>
              <td className="p-2">{chip(i.status)}</td>
              <td className="p-2">{new Date(i.updated_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}


