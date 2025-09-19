"use client"
import { useState } from 'react'

export default function PhysicianStep1() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [password, setPassword] = useState('')
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string>('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:3001'}/onboarding/physician/step1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, email, mobile, password })
    })
    if (!res.ok) {
      setError('Failed to submit')
      return
    }
    const json = await res.json()
    setResult(json)
    try { if (typeof window !== 'undefined') window.localStorage.setItem('onboarding_id', json.id) } catch {}
  }

  return (
    <div className="max-w-lg mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Physician Onboarding — Step 1</h1>
      <form onSubmit={submit} className="bg-white p-4 rounded shadow space-y-3">
        {error && <div className="p-2 bg-red-50 text-red-700 text-sm rounded">{error}</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm">First name
            <input className="mt-1 w-full border rounded px-2 py-1" value={firstName} onChange={(e)=>setFirstName(e.target.value)} />
          </label>
          <label className="text-sm">Last name
            <input className="mt-1 w-full border rounded px-2 py-1" value={lastName} onChange={(e)=>setLastName(e.target.value)} />
          </label>
        </div>
        <label className="text-sm">Email
          <input type="email" className="mt-1 w-full border rounded px-2 py-1" value={email} onChange={(e)=>setEmail(e.target.value)} />
        </label>
        <label className="text-sm">Mobile phone
          <input className="mt-1 w-full border rounded px-2 py-1" value={mobile} onChange={(e)=>setMobile(e.target.value)} placeholder="(555) 123-4567" />
        </label>
        <label className="text-sm">Password
          <input type="password" className="mt-1 w-full border rounded px-2 py-1" value={password} onChange={(e)=>setPassword(e.target.value)} />
        </label>
        <div className="flex justify-end">
          <button className="px-4 py-2 rounded bg-brand-600 text-white">Create account</button>
        </div>
      </form>
      {result && (
        <div className="bg-slate-50 p-3 rounded text-sm">
          <p>Account created. Save your onboarding ID:</p>
          <code className="break-all">{result.id}</code>
          <p className="text-xs text-slate-600 mt-2">We saved this to your browser and will prefill on Step 2.</p>
        </div>
      )}
    </div>
  )
}


