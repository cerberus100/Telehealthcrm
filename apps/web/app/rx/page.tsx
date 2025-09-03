"use client"
import { useQuery } from '@tanstack/react-query'
import { Api } from '../../lib/api'
import { useAuth } from '../../lib/auth'

export default function RxPage() {
  const { role } = useAuth()
  if (!(role === 'DOCTOR' || role === 'PHARMACIST')) return <p>Access denied</p>
  const { data, isLoading, error } = useQuery({ queryKey: ['rx'], queryFn: Api.rxList })
  if (isLoading) return <p>Loading…</p>
  if (error || !data) return <p>Failed to load.</p>
  return (
    <div>
      <h1 className="text-lg font-semibold mb-2">Rx</h1>
      <table className="w-full border text-sm">
        <thead>
          <tr className="bg-slate-100">
            <th className="p-2 text-left">ID</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2 text-left">Refills</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="p-2">{r.id}</td>
              <td className="p-2">{r.status}</td>
              <td className="p-2">{r.refills_used}/{r.refills_allowed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
