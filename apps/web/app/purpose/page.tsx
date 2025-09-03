"use client"
import { useState } from 'react'
import { useAuth } from '../../lib/auth'
import { useRouter } from 'next/navigation'

export default function PurposePage() {
  const { setPurposeOfUse } = useAuth()
  const [reason, setReason] = useState('Treatment')
  const router = useRouter()
  return (
    <div className="max-w-md space-y-3">
      <h1 className="text-xl font-semibold">Confirm purpose of use</h1>
      <p className="text-sm">Enter a short reason before accessing PHI.</p>
      <input className="border p-2 w-full" value={reason} onChange={(e) => setReason(e.target.value)} />
      <button className="border px-3 py-2" onClick={() => { setPurposeOfUse(reason); router.replace('/') }}>Continue</button>
    </div>
  )
}
