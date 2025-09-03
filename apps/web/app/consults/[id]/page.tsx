"use client"
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Api } from '../../../lib/api'

function useConsult(id: string) {
  return useQuery({ queryKey: ['consult', id], queryFn: async () => ({ id, status: 'PENDING', created_at: new Date().toISOString(), provider_org_id: 'org_1' }) })
}

export default function ConsultDetail({ params }: { params: { id: string } }) {
  const { data, isLoading, error } = useConsult(params.id)
  const qc = useQueryClient()
  const setStatus = useMutation({
    mutationFn: async (status: string) => {
      // mock POST /consults/{id}/status
      await new Promise((r) => setTimeout(r, 300))
      return status
    },
    onSuccess: async (status) => {
      qc.setQueryData(['consult', params.id], (old: any) => ({ ...(old || {}), status }))
    }
  })

  if (isLoading) return <p>Loading…</p>
  if (error || !data) return <p>Failed to load.</p>
  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold">Consult {data.id}</h1>
      <p>Status: {data.status}</p>
      <div className="flex gap-2">
        <button className="border px-2 py-1" onClick={() => setStatus.mutate('PASSED')}>Pass</button>
        <button className="border px-2 py-1" onClick={() => setStatus.mutate('FAILED')}>Fail</button>
        <button className="border px-2 py-1" onClick={() => setStatus.mutate('APPROVED')}>Approve</button>
      </div>
    </div>
  )
}
