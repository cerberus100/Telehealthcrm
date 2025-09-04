"use client"
import { useQuery } from '@tanstack/react-query'
import { Api } from '../../lib/api'
import { useAuth } from '../../lib/auth'

export default function ConsultsPage() {
  const { role } = useAuth()
  if (role !== 'SUPER_ADMIN') return <p>Access denied</p>
  const { data, isLoading, error } = useQuery({ queryKey: ['consults'], queryFn: Api.consults })
  if (isLoading) return <p>Loading…</p>
  if (error || !data) return <p>Failed to load.</p>
  return (
    <div>
      <h1 className="text-lg font-semibold mb-2">Consults</h1>
      <table className="w-full border text-sm">
        <thead>
          <tr className="bg-slate-100">
            <th className="p-2 text-left">ID</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2 text-left">Created</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((c) => (
            <tr key={c.id} className="border-t">
              <td className="p-2">{c.id}</td>
              <td className="p-2">{c.status}</td>
              <td className="p-2">{new Date(c.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
