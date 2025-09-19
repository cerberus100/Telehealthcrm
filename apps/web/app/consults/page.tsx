"use client"
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import Link from 'next/link'

export default function ConsultsPage() {
  const { role } = useAuth()
  if (role !== 'DOCTOR' && role !== 'SUPER_ADMIN') return <p>Access denied</p>

  const [status, setStatus] = useState<string>('')
  const { data, isLoading, error } = useQuery({ queryKey: ['consults'], queryFn: Api.consults })
  const items = useMemo(() => {
    if (!data) return []
    return data.items.filter((c) => (status ? c.status === status : true))
  }, [data, status])

  if (isLoading) return <p>Loading…</p>
  if (error || !data) return <p>Failed to load.</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Consults</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Status</label>
          <select className="border rounded px-2 py-1 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="PENDING">PENDING</option>
            <option value="PASSED">PASSED</option>
            <option value="FAILED">FAILED</option>
            <option value="APPROVED">APPROVED</option>
            <option value="DECLINED">DECLINED</option>
          </select>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="p-2 text-left">ID</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">Created</th>
              <th className="p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-2">{c.id}</td>
                <td className="p-2">{c.status}</td>
                <td className="p-2">{new Date(c.created_at).toLocaleString()}</td>
                <td className="p-2">
                  <Link href={`/consults/${c.id}`} className="text-brand-600 hover:text-brand-800">Open</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
