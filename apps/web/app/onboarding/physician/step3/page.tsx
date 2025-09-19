"use client"
import { useEffect, useState } from 'react'

export default function PhysicianStep3() {
  const [id, setId] = useState('')
  const [acceptTos, setAcceptTos] = useState(false)
  const [acceptBaa, setAcceptBaa] = useState(false)
  const [signature, setSignature] = useState('')
  const [tosUrl, setTosUrl] = useState<string | null>(null)
  const [baaUrl, setBaaUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [result, setResult] = useState<any>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('onboarding_id')
      if (saved) setId(saved)
      setTosUrl(window.localStorage.getItem('agreements_terms') || null)
      setBaaUrl(window.localStorage.getItem('agreements_baa') || null)
    }
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!id) { setError('Missing onboarding ID'); return }
    if (!(acceptTos && acceptBaa)) { setError('Please accept Terms of Use and BAA'); return }
    if (!signature.trim()) { setError('Please type your full name as signature'); return }
    // Demo: call sign endpoint
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://telehealth-alb-prod-422934810.us-east-1.elb.amazonaws.com'}/onboarding/physician/step4/sign`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id })
    })
    setResult(res.ok ? await res.json() : { error: await res.text() })
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Physician Onboarding — Step 3 (Agreements & E-Sign)</h1>
      <form onSubmit={submit} className="bg-white p-4 rounded shadow space-y-4">
        {error && <div className="p-2 bg-red-50 text-red-700 text-sm rounded">{error}</div>}
        <label className="text-sm">Onboarding ID
          <input className="mt-1 w-full border rounded px-2 py-1" value={id} onChange={(e)=>setId(e.target.value)} />
        </label>

        <fieldset className="border rounded p-3 space-y-3">
          <legend className="text-sm font-medium">Terms of Use</legend>
          {tosUrl ? (
            <iframe src={tosUrl} className="w-full h-64 border rounded" title="Terms of Use" />
          ) : (
            <div className="text-sm text-slate-700 bg-slate-50 p-3 rounded h-64 overflow-auto border">
              <h3 className="font-semibold mb-2">Teleplatform Terms of Use (Sample)</h3>
              <p className="mb-2">These Terms govern your use of the Teleplatform clinician portal. By proceeding, you affirm that you are authorized to practice, and you will comply with applicable laws and standards of care.</p>
              <ul className="list-disc ml-5 space-y-1">
                <li>Use of PHI: You agree to access and use PHI solely for treatment and minimum-necessary purposes.</li>
                <li>Security: You will maintain account security, MFA, and report suspected incidents within 24 hours.</li>
                <li>Prohibited Uses: No scraping, redistributing PHI, or unauthorized disclosures.</li>
                <li>Audit: Activities may be audited and logged for compliance.</li>
              </ul>
              <p className="mt-2">By checking the box below, you accept these Terms.</p>
            </div>
          )}
          <label className="text-sm inline-flex items-center gap-2">
            <input type="checkbox" checked={acceptTos} onChange={(e)=>setAcceptTos(e.target.checked)} /> I agree to the Terms of Use
          </label>
        </fieldset>

        <fieldset className="border rounded p-3 space-y-3">
          <legend className="text-sm font-medium">Business Associate Agreement (BAA)</legend>
          {baaUrl ? (
            <iframe src={baaUrl} className="w-full h-64 border rounded" title="BAA" />
          ) : (
            <div className="text-sm text-slate-700 bg-slate-50 p-3 rounded h-64 overflow-auto border">
              <h3 className="font-semibold mb-2">Business Associate Agreement (Sample Extract)</h3>
              <p className="mb-2">This Sample BAA outlines responsibilities for safeguarding ePHI under HIPAA. Key provisions include:</p>
              <ul className="list-disc ml-5 space-y-1">
                <li>Permitted Uses/Disclosures: Only as required for services and minimum necessary.</li>
                <li>Safeguards: Administrative, physical, and technical controls; encryption in transit and at rest.</li>
                <li>Breach Notification: Report any security incident without unreasonable delay, no later than 60 days.</li>
                <li>Subcontractors: Must agree in writing to comply with equivalent protections.</li>
                <li>Termination: Return or destroy PHI; if infeasible, extend protections indefinitely.</li>
              </ul>
              <p className="mt-2">By checking the box below, you agree to the Sample BAA for demo purposes.</p>
            </div>
          )}
          <label className="text-sm inline-flex items-center gap-2">
            <input type="checkbox" checked={acceptBaa} onChange={(e)=>setAcceptBaa(e.target.checked)} /> I agree to the BAA
          </label>
        </fieldset>

        <label className="text-sm">Type your full name (e-signature)
          <input className="mt-1 w-full border rounded px-2 py-1" value={signature} onChange={(e)=>setSignature(e.target.value)} placeholder="First Last" />
        </label>

        <div className="flex justify-end">
          <button className="px-4 py-2 rounded bg-brand-600 text-white">Sign & Continue</button>
        </div>
      </form>
      {result && <pre className="text-xs bg-slate-50 p-3 rounded overflow-auto">{JSON.stringify(result, null, 2)}</pre>}
    </div>
  )
}


