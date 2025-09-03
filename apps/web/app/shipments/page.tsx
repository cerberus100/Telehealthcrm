"use client"
import { useQuery } from '@tanstack/react-query'
import { Api } from '../../lib/api'

export default function ShipmentsPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['shipments'], queryFn: Api.shipments })
  if (isLoading) return <p>Loading…</p>
  if (error || !data) return <p>Failed to load.</p>
  return (
    <div>
      <h1 className="text-lg font-semibold mb-2">Shipments</h1>
      <table className="w-full border text-sm">
        <thead>
          <tr className="bg-slate-100">
            <th className="p-2 text-left">Tracking</th>
            <th className="p-2 text-left">Carrier</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2 text-left">Last event</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((s) => (
            <tr key={s.id} className="border-t">
              <td className="p-2">{s.tracking_number}</td>
              <td className="p-2">{s.carrier}</td>
              <td className="p-2">{s.status}</td>
              <td className="p-2">{new Date(s.last_event_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
