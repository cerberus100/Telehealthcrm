"use client"
import { useQuery } from '@tanstack/react-query'
import { Api } from '../lib/api'
import { useAuth } from '../lib/auth'
import Link from 'next/link'

export default function Page() {
  const { purposeOfUse, logout } = useAuth()
  const { data, isLoading, error } = useQuery({ queryKey: ['me'], queryFn: Api.me })
  if (!purposeOfUse) return <div><p>Purpose of use required.</p><Link href="/purpose" className="underline">Set purpose</Link></div>
  if (isLoading) return <p>Loading…</p>
  if (error || !data) return <p>Failed to load.</p>
  return (
    <div>
      <div className="flex items-center gap-4">
        <h1>Welcome, {data.user.email}</h1>
        <button className="border px-2 py-1" onClick={logout}>Logout</button>
      </div>
      <p>Role: {data.user.role}</p>
      <p>Org: {data.org.name}</p>
    </div>
  )
}
