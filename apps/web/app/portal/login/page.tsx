"use client"
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { EudauraLogo } from '../../../components/EudauraLogo'

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
    <div className="relative min-h-screen flex items-center justify-center bg-hero-aura">
      {/* Background Eudaura Logo */}
      <div className="absolute inset-0 flex items-center justify-center">
        <EudauraLogo size="bg" className="opacity-15 scale-125" />
      </div>

      {/* Login Form */}
      <div className="relative z-10 w-full max-w-sm mx-4 fade-up">
        <div className="card-premium rounded-xl p-6 text-center">
          <div className="mb-4">
            <h1 className="text-xl font-bold text-foreground mb-2">Eudaura Patient Portal</h1>
            <p className="text-sm text-muted">Welcome to your healthcare portal</p>
          </div>

          <div className="min-h-[60px] flex items-center justify-center">
            <p className="text-sm text-foreground">
              {status || 'Validating token…'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}


