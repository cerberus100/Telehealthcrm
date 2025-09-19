"use client"
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function PortalLogin() {
  const router = useRouter()
  const params = useSearchParams()
  const [status, setStatus] = useState('')

  useEffect(() => {
    const token = params.get('token')
    if (!token) { setStatus('Missing invite token'); return }
    if (typeof window === 'undefined') return
    const invites = JSON.parse(window.localStorage.getItem('portal_invites_demo') || '[]') as any[]
    const found = invites.find(i => i.token === token)
    if (!found) { setStatus('Invalid or expired invite'); return }
    // Create a demo patient session
    const sess = { portal: true, patientId: found.patientId, name: found.patientName, issuedAt: new Date().toISOString() }
    window.localStorage.setItem('portal_session', JSON.stringify(sess))
    setStatus('Logged in, redirecting…')
    const t = setTimeout(() => router.replace('/portal'), 500)
    return () => clearTimeout(t)
  }, [params, router])

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="rounded border bg-white p-6 w-full max-w-sm text-center">
        <h1 className="text-lg font-semibold mb-2">Patient Portal Login</h1>
        <p className="text-sm text-slate-700">{status || 'Validating token…'}</p>
      </div>
    </div>
  )
}


