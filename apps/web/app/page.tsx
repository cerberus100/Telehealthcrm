"use client"
import { useQuery } from '@tanstack/react-query'
import { Api } from '../lib/api'

export default function Page() {
  const { data, isLoading, error } = useQuery({ queryKey: ['me'], queryFn: Api.me })
  if (isLoading) return <p>Loading…</p>
  if (error || !data) return <p>Failed to load.</p>
  return (
    <div>
      <h1>Welcome, {data.user.email}</h1>
      <p>Role: {data.user.role}</p>
      <p>Org: {data.org.name}</p>
    </div>
  )
}
