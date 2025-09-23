"use client"
import { useEffect, useMemo, useState } from 'react'

type License = { state: string; number: string; expiration: string }
type BoardCert = { name: string; board: string; expiration: string }

const STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']

function isFuture(dateStr: string): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const now = new Date()
  return d.getTime() > now.getTime()
}

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr).getTime()
  const now = Date.now()
  return Math.ceil((d - now) / (1000*60*60*24))
}

function luhnCheck(npi: string): boolean {
  const digits = npi.replace(/\D/g, '')
  if (digits.length !== 10) return false
  // Generic Luhn over all digits
  let sum = 0
  let dbl = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits[i]!, 10)
    if (dbl) { d *= 2; if (d > 9) d -= 9 }
    sum += d
    dbl = !dbl
  }
  return sum % 10 === 0
}

export default function PhysicianStep2() {
  const [id, setId] = useState('')
  const [npi, setNpi] = useState('')
  const [dea, setDea] = useState('')
  const [pecos, setPecos] = useState<'yes' | 'no' | ''>('')
  const [states, setStates] = useState<string[]>([])
  const [licenses, setLicenses] = useState<License[]>([])
  const [boards, setBoards] = useState<BoardCert[]>([])
  const [malCarrier, setMalCarrier] = useState('')
  const [malPolicy, setMalPolicy] = useState('')
  const [malLimits, setMalLimits] = useState('')
  const [malEff, setMalEff] = useState('')
  const [malExp, setMalExp] = useState('')
  const [govIdB64, setGovIdB64] = useState<string>('')
  const [cvB64, setCvB64] = useState<string>('')
  const [errors, setErrors] = useState<string>('')
  const [result, setResult] = useState<any>(null)

  const deaValid = useMemo(() => dea === '' || /^[A-Za-z]{2}\d{7}$/.test(dea), [dea])
  const npiValid = useMemo(() => luhnCheck(npi), [npi])

  const ensureLicensesForStates = (nextStates: string[]) => {
    setLicenses((prev) => {
      const next: License[] = []
      for (const s of nextStates) {
        const found = prev.find(l => l.state === s)
        next.push(found ?? { state: s, number: '', expiration: '' })
      }
      return next
    })
  }

  const toggleState = (stateCode: string) => {
    setStates(prev => {
      const exists = prev.includes(stateCode)
      const next = exists ? prev.filter(s => s !== stateCode) : [...prev, stateCode]
      ensureLicensesForStates(next)
      return next
    })
  }

  const setLicense = (state: string, field: keyof License, value: string) => {
    setLicenses(prev => prev.map(l => l.state === state ? { ...l, [field]: value } : l))
  }

  const addBoard = () => setBoards(prev => [...prev, { name: '', board: '', expiration: '' }])
  const setBoard = (idx: number, field: keyof BoardCert, value: string) => {
    setBoards(prev => prev.map((b,i) => i === idx ? { ...b, [field]: value } : b))
  }
  const removeBoard = (idx: number) => setBoards(prev => prev.filter((_,i)=>i!==idx))

  const toB64 = (file: File) => new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onerror = () => reject(new Error('read error'))
    r.onload = () => resolve(String(r.result).split(',')[1] || '')
    r.readAsDataURL(file)
  })

  const validate = (): string | null => {
    if (!id) return 'Onboarding ID is required'
    if (!npiValid) return 'NPI must be 10 digits with a valid check digit'
    if (!deaValid) return 'DEA format invalid (expected AA1234567)'
    if (pecos === '') return 'Please indicate PECOS active yes/no'
    if (states.length === 0) return 'Select at least one licensed state'
    for (const lic of licenses) {
      if (!lic.number) return `License number required for ${lic.state}`
      if (!isFuture(lic.expiration)) return `License expiration for ${lic.state} must be a future date`
    }
    if (!malCarrier || !malPolicy || !malEff || !malExp) return 'Malpractice: carrier, policy, effective and expiration are required'
    if (!isFuture(malExp)) return 'Malpractice expiration must be a future date'
    if (!govIdB64) return 'Government ID upload is required'
    return null
  }

  // Prefill onboarding id on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('onboarding_id')
      if (saved) setId(saved)
    }
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors('')
    const err = validate()
    if (err) { setErrors(err); return }
    const payload: any = {
      id,
      npi,
      dea,
      pecosActive: pecos === 'yes',
      licenses: licenses.map(l => ({ state: l.state, number: l.number, expiration: l.expiration })),
      boards,
      malpractice: { carrier: malCarrier, policy: malPolicy, limits: malLimits, effective: malEff, expiration: malExp },
      uploads: { gov_id_b64: govIdB64 },
    }
    if (cvB64) payload.uploads.cv_b64 = cvB64
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://telehealth-alb-prod-422934810.us-east-1.elb.amazonaws.com'}/onboarding/physician/step2`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    })
    setResult(res.ok ? await res.json() : { error: await res.text() })
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Physician Onboarding — Step 2 (Licensing & Credentials)</h1>
      <form onSubmit={submit} className="bg-white p-4 rounded shadow space-y-4">
        {errors && <div className="p-2 bg-red-50 text-red-700 text-sm rounded">{errors}</div>}
        <label className="text-sm">Onboarding ID
          <input className="mt-1 w-full border rounded px-2 py-1" value={id} onChange={(e)=>setId(e.target.value)} />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-sm md:col-span-1">NPI (10-digit)
            <input className={`mt-1 w-full border rounded px-2 py-1 ${npi && !npiValid ? 'border-red-400' : ''}`} value={npi} onChange={(e)=>setNpi(e.target.value)} />
          </label>
          <label className="text-sm md:col-span-1">DEA (optional)
            <input className={`mt-1 w-full border rounded px-2 py-1 ${dea && !deaValid ? 'border-red-400' : ''}`} value={dea} onChange={(e)=>setDea(e.target.value)} />
          </label>
          <label className="text-sm md:col-span-1">PECOS active?
            <select className="mt-1 w-full border rounded px-2 py-1" value={pecos} onChange={(e)=>setPecos(e.target.value as any)}>
              <option value="">Select...</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
        </div>

        <fieldset className="border rounded p-3">
          <legend className="text-sm font-medium">States licensed</legend>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {STATES.map((s) => (
              <label key={s} className="text-sm inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={states.includes(s)}
                  onChange={() => toggleState(s)}
                />
                {s}
              </label>
            ))}
          </div>
          {licenses.length > 0 && (
            <div className="mt-3 space-y-2">
              {licenses.map(lic => (
                <div key={lic.state} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                  <div className="text-sm"><strong>{lic.state}</strong></div>
                  <label className="text-sm md:col-span-2">License number
                    <input className="mt-1 w-full border rounded px-2 py-1" value={lic.number} onChange={(e)=>setLicense(lic.state, 'number', e.target.value)} />
                  </label>
                  <label className="text-sm">Expiration
                    <input type="date" className="mt-1 w-full border rounded px-2 py-1" value={lic.expiration} onChange={(e)=>setLicense(lic.state, 'expiration', e.target.value)} />
                  </label>
                  {lic.expiration && isFuture(lic.expiration) && daysUntil(lic.expiration) < 60 && (
                    <div className="text-xs text-amber-600 md:col-span-4">Warning: expires in {daysUntil(lic.expiration)} days</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </fieldset>

        <fieldset className="border rounded p-3">
          <legend className="text-sm font-medium">Board certifications</legend>
          <div className="space-y-2">
            {boards.map((b, idx) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <label className="text-sm">Name
                  <input className="mt-1 w-full border rounded px-2 py-1" value={b.name} onChange={(e)=>setBoard(idx,'name',e.target.value)} />
                </label>
                <label className="text-sm">Board
                  <input className="mt-1 w-full border rounded px-2 py-1" value={b.board} onChange={(e)=>setBoard(idx,'board',e.target.value)} />
                </label>
                <label className="text-sm">Expiration
                  <input type="date" className="mt-1 w-full border rounded px-2 py-1" value={b.expiration} onChange={(e)=>setBoard(idx,'expiration',e.target.value)} />
                </label>
                <button type="button" onClick={()=>removeBoard(idx)} className="px-3 py-2 border rounded text-sm">Remove</button>
              </div>
            ))}
            <button type="button" onClick={addBoard} className="px-3 py-2 border rounded text-sm">Add certification</button>
          </div>
        </fieldset>

        <fieldset className="border rounded p-3">
          <legend className="text-sm font-medium">Malpractice insurance</legend>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="text-sm">Carrier
              <input className="mt-1 w-full border rounded px-2 py-1" value={malCarrier} onChange={(e)=>setMalCarrier(e.target.value)} />
            </label>
            <label className="text-sm">Policy #
              <input className="mt-1 w-full border rounded px-2 py-1" value={malPolicy} onChange={(e)=>setMalPolicy(e.target.value)} />
            </label>
            <label className="text-sm">Limits
              <input className="mt-1 w-full border rounded px-2 py-1" value={malLimits} onChange={(e)=>setMalLimits(e.target.value)} placeholder="$1M/$3M" />
            </label>
            <label className="text-sm">Effective date
              <input type="date" className="mt-1 w-full border rounded px-2 py-1" value={malEff} onChange={(e)=>setMalEff(e.target.value)} />
            </label>
            <label className="text-sm">Expiration
              <input type="date" className="mt-1 w-full border rounded px-2 py-1" value={malExp} onChange={(e)=>setMalExp(e.target.value)} />
            </label>
          </div>
        </fieldset>

        <fieldset className="border rounded p-3">
          <legend className="text-sm font-medium">Required uploads</legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-sm">Government ID (PDF/JPG/PNG)
              <input type="file" accept="application/pdf,image/*" className="mt-1 w-full" onChange={async (e)=>{ const f=e.target.files?.[0]; if (f) setGovIdB64(await toB64(f)) }} />
            </label>
            <label className="text-sm">CV / Resume (PDF/JPG/PNG)
              <input type="file" accept="application/pdf,image/*" className="mt-1 w-full" onChange={async (e)=>{ const f=e.target.files?.[0]; if (f) setCvB64(await toB64(f)) }} />
            </label>
          </div>
        </fieldset>

        <div className="flex justify-end">
          <button className="px-4 py-2 rounded bg-brand-600 text-white">Save credentials</button>
        </div>
      </form>
      {result && <pre className="text-xs bg-slate-50 p-3 rounded overflow-auto">{JSON.stringify(result, null, 2)}</pre>}
    </div>
  )
}


