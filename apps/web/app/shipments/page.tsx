"use client"
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import ShipmentDrawer from '../../components/ShipmentDrawer'
import BulkUploadModal from '../../components/BulkUploadModal'

type Carrier = 'UPS' | 'FEDEX' | 'USPS' | 'OTHER'
const carrierLink = (carrier: string, tracking: string): string => {
  const n = tracking?.trim()
  switch ((carrier || '').toUpperCase()) {
    case 'UPS':
      return `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}`
    case 'FEDEX':
      return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(n)}`
    case 'USPS':
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(n)}`
    default:
      return '#'
  }
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    CREATED: 'bg-slate-100 text-slate-700',
    IN_TRANSIT: 'bg-blue-100 text-blue-800',
    OUT_FOR_DELIVERY: 'bg-amber-100 text-amber-800',
    DELIVERED: 'bg-green-100 text-green-800',
    EXCEPTION: 'bg-red-100 text-red-800',
  }
  const cls = map[status] || 'bg-slate-100 text-slate-700'
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{status}</span>
}

export default function ShipmentsPage() {
  const qc = useQueryClient()
  const { role } = useAuth()
  const isAdmin = role === 'MARKETER_ADMIN' || role === 'SUPER_ADMIN'
  if (!(role === 'MARKETER' || role === 'MARKETER_ADMIN' || role === 'SUPER_ADMIN')) {
    return <p>Access denied</p>
  }

  const { data, isLoading, error } = useQuery({ queryKey: ['shipments'], queryFn: Api.shipments })

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string>('')
  const [myOnly, setMyOnly] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newCarrier, setNewCarrier] = useState<Carrier>('UPS')
  const [newTracking, setNewTracking] = useState('')
  const [newReference, setNewReference] = useState('')
  const [assignTo, setAssignTo] = useState('')
  const [selectedShipment, setSelectedShipment] = useState<any>(null)
  const [showBulkUpload, setShowBulkUpload] = useState(false)

  const filtered = useMemo(() => {
    const items = data?.items ?? []
    return items.filter((s) => {
      const q = search.toLowerCase()
      const matches = !q || s.tracking_number.toLowerCase().includes(q) || (s as any).reference?.toLowerCase?.().includes(q)
      const stOk = !status || s.status === status
      // myOnly is a no-op in mock; reserved for real assignments
      return matches && stOk && (!myOnly || true)
    })
  }, [data, search, status, myOnly])

  const createMutation = useMutation({
    mutationFn: async () => {
      // Demo: optimistic insert; when API exists, POST /shipments
      return {
        id: `tmp_${Date.now()}`,
        tracking_number: newTracking,
        carrier: newCarrier,
        reference: newReference,
        status: 'CREATED',
        last_event_at: new Date().toISOString(),
        eta: null,
      }
    },
    onSuccess: (created: any) => {
      qc.setQueryData(['shipments'], (prev: any) => {
        if (!prev) return prev
        return { ...prev, items: [created, ...prev.items] }
      })
      setIsModalOpen(false)
      setNewTracking('')
      setNewReference('')
      setAssignTo('')
      setNewCarrier('UPS')
    },
  })

  if (isLoading) return <p>Loading…</p>
  if (error || !data) return <p>Failed to load.</p>

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Specimen Shipments</h1>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 rounded bg-brand-600 text-white hover:bg-brand-700" onClick={() => setIsModalOpen(true)}>Add Shipment</button>
            <button className="px-3 py-1.5 rounded border" onClick={() => setShowBulkUpload(true)}>Upload CSV</button>
          </div>
        )}
      </div>

      <div className="mb-3 grid grid-cols-1 md:grid-cols-4 gap-2">
        <input className="border rounded px-2 py-1" placeholder="Search tracking or reference" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="border rounded px-2 py-1" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="CREATED">Created</option>
          <option value="IN_TRANSIT">In Transit</option>
          <option value="OUT_FOR_DELIVERY">Out for delivery</option>
          <option value="DELIVERED">Delivered</option>
          <option value="EXCEPTION">Exception</option>
        </select>
        <input className="border rounded px-2 py-1" type="date" />
        <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={myOnly} onChange={(e) => setMyOnly(e.target.checked)} />My Shipments</label>
      </div>

      <table className="w-full border text-sm">
        <thead>
          <tr className="bg-slate-100">
            <th className="p-2 text-left">Tracking</th>
            <th className="p-2 text-left">Carrier</th>
            <th className="p-2 text-left">Reference</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2 text-left">ETA</th>
            <th className="p-2 text-left">Last event</th>
            <th className="p-2 text-left">Updated</th>
            <th className="p-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((s: any) => (
            <tr key={s.id} className="border-t">
              <td className="p-2 text-brand-700 underline"><a href={carrierLink(s.carrier, s.tracking_number)} target="_blank" rel="noreferrer">{s.tracking_number}</a></td>
              <td className="p-2">{s.carrier}</td>
              <td className="p-2">{(s as any).reference || ''}</td>
              <td className="p-2"><StatusChip status={s.status} /></td>
              <td className="p-2">{(s as any).eta ? new Date((s as any).eta).toLocaleString() : '-'}</td>
              <td className="p-2">{s.last_event_at ? new Date(s.last_event_at).toLocaleString() : '-'}</td>
              <td className="p-2">{s.last_event_at ? new Date(s.last_event_at).toLocaleString() : '-'}</td>
              <td className="p-2">
                <div className="flex gap-2">
                  <button className="text-brand-700 underline" onClick={() => setSelectedShipment(s)}>View</button>
                  <button className="text-slate-700 underline" onClick={() => alert('Re-poll coming soon')}>Refresh</button>
                  {isAdmin && (
                    <>
                      <button className="text-slate-700 underline" onClick={() => setSelectedShipment(s)}>Edit</button>
                      <button className="text-red-700 underline" onClick={() => alert('Delete coming soon')}>Delete</button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-lg rounded bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold mb-4">Add Shipment</h2>
            <div className="grid grid-cols-1 gap-3">
              <label className="text-sm">Carrier
                <select className="mt-1 w-full border rounded px-2 py-1" value={newCarrier} onChange={(e) => setNewCarrier(e.target.value as Carrier)}>
                  <option value="UPS">UPS</option>
                  <option value="FEDEX">FedEx</option>
                  <option value="USPS">USPS</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>
              <label className="text-sm">Tracking Number
                <input className="mt-1 w-full border rounded px-2 py-1" value={newTracking} onChange={(e) => setNewTracking(e.target.value)} placeholder="1Z..." />
              </label>
              <label className="text-sm">Reference (non‑PHI)
                <input className="mt-1 w-full border rounded px-2 py-1" value={newReference} onChange={(e) => setNewReference(e.target.value)} placeholder="client name, case id" />
              </label>
              <label className="text-sm">Assign To (email)
                <input className="mt-1 w-full border rounded px-2 py-1" value={assignTo} onChange={(e) => setAssignTo(e.target.value)} placeholder="optional@yourorg.com" />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="px-3 py-1.5 rounded border" onClick={() => setIsModalOpen(false)}>Cancel</button>
              <button
                className="px-3 py-1.5 rounded bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
                disabled={!newTracking.trim()}
                onClick={() => createMutation.mutate()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
      
      {selectedShipment && (
        <ShipmentDrawer 
          shipment={selectedShipment} 
          onClose={() => setSelectedShipment(null)} 
        />
      )}
      
      {showBulkUpload && (
        <BulkUploadModal onClose={() => setShowBulkUpload(false)} />
      )}
    </div>
  )
}
