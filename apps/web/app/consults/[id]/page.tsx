"use client"
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../../lib/auth'
import Link from 'next/link'

function useConsult(id: string) {
  return useQuery({
    queryKey: ['consult', id],
    queryFn: async () => ({
      id,
      status: 'PENDING',
      created_at: new Date().toISOString(),
      provider_org_id: 'org_1',
      patient: {
        id: 'p_1',
        name: 'Jane Doe',
        dob: '1985-03-15',
        mrn: 'MRN12345',
        phone: '(555) 123-4567',
        address: '123 Main St, Austin, TX'
      },
      notes: [
        { id: 'n1', author: 'Dr. Smith', ts: new Date().toISOString(), text: 'Chief complaint: sore throat x3 days.' },
        { id: 'n2', author: 'Dr. Smith', ts: new Date().toISOString(), text: 'PE: mild erythema, afebrile.' }
      ],
      attachments: [ { id: 'a1', name: 'Photo_throat.jpg', size: '240 KB' } ]
    })
  })
}

export default function ConsultDetail({ params }: { params: { id: string } }) {
  const { role } = useAuth()
  const { data, isLoading, error } = useConsult(params.id)
  const qc = useQueryClient()
  const setStatus = useMutation({
    mutationFn: async (status: string) => {
      await new Promise((r) => setTimeout(r, 300))
      return status
    },
    onSuccess: async (status) => {
      qc.setQueryData(['consult', params.id], (old: any) => ({ ...(old || {}), status }))
    }
  })

  if (isLoading) return <p>Loading…</p>
  if (error || !data) return <p>Failed to load.</p>

  const canAct = role === 'DOCTOR' || role === 'SUPER_ADMIN'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Consult {data.id}</h1>
          <p className="text-sm text-slate-600">Status: {data.status}</p>
        </div>
        {canAct && (
          <div className="flex gap-2">
            <button className="bg-green-600 text-white px-3 py-2 rounded text-sm" onClick={() => setStatus.mutate('APPROVED')}>Approve</button>
            <button className="bg-yellow-600 text-white px-3 py-2 rounded text-sm" onClick={() => setStatus.mutate('PASSED')}>Pass triage</button>
            <button className="bg-red-600 text-white px-3 py-2 rounded text-sm" onClick={() => setStatus.mutate('FAILED')}>Decline</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded shadow p-4 lg:col-span-2">
          <h2 className="text-lg font-medium mb-3">Chart Notes</h2>
          <ul className="space-y-3">
            {data.notes.map((n: any) => (
              <li key={n.id} className="border rounded p-3">
                <div className="text-xs text-slate-500 mb-1">{n.author} • {new Date(n.ts).toLocaleString()}</div>
                <div className="text-sm">{n.text}</div>
              </li>
            ))}
          </ul>
        </div>
        <aside className="bg-white rounded shadow p-4">
          <h3 className="text-md font-medium mb-2">Patient</h3>
          <div className="text-sm">
            <div className="font-medium">{data.patient.name}</div>
            <div className="text-slate-600">DOB: {new Date(data.patient.dob).toLocaleDateString()}</div>
            <div className="text-slate-600">MRN: {data.patient.mrn}</div>
            <div className="text-slate-600">Phone: {data.patient.phone}</div>
            <div className="text-slate-600">{data.patient.address}</div>
          </div>
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-1">Attachments</h4>
            <ul className="text-sm list-disc ml-5">
              {data.attachments.map((a: any) => (
                <li key={a.id}>{a.name} <span className="text-slate-500">({a.size})</span></li>
              ))}
            </ul>
          </div>
          <div className="mt-4">
            <Link href={`/patients/${data.patient.id}`} className="text-brand-600 hover:text-brand-800 text-sm">Open patient profile →</Link>
          </div>
        </aside>
      </div>
    </div>
  )
}
