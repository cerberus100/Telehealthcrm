"use client"
import { useMemo, useState } from 'react'

type Service = 'RX'|'LABS'|'BOTH'

export default function PublicIntake({ params }: { params: { linkId: string } }) {
  const [service, setService] = useState<Service>('BOTH')
  const [category, setCategory] = useState<string>('NEURO')
  const [testType, setTestType] = useState<string>('COGNITIVE')
  const [consentHipaa, setConsentHipaa] = useState(false)
  const [consentTcpa, setConsentTcpa] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState<string>('')

  // Patient required fields
  const [patientName, setPatientName] = useState('')
  const [patientDob, setPatientDob] = useState('')
  const [medicareId, setMedicareId] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [dupeCheck, setDupeCheck] = useState<any>(null)
  const [checkingDupe, setCheckingDupe] = useState(false)
  const [insuranceType, setInsuranceType] = useState<'commercial' | 'medicare' | ''>('')
  const [labConfig, setLabConfig] = useState<any>(null)
  const [addr1, setAddr1] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  // Generic triage form values (for large field sets)
  const [f, setF] = useState<Record<string, string>>({})
  const upd = (name: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF(prev => ({ ...prev, [name]: e.target.value }))

  const showRx = service === 'RX' || service === 'BOTH'
  const showLabs = service === 'LABS' || service === 'BOTH'

  // Check for duplicates when Medicare ID and test category are entered
  const checkDuplicate = async () => {
    if (!medicareId || !showLabs || !category) return
    setCheckingDupe(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://telehealth-alb-prod-422934810.us-east-1.elb.amazonaws.com'}/duplicate-check/medicare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medicareId,
          testCategory: category,
          testType,
          patientName,
          dob: patientDob
        })
      })
      const result = await res.json()
      setDupeCheck(result)
    } catch (error) {
      console.error('Duplicate check failed:', error)
      setDupeCheck(null)
    } finally {
      setCheckingDupe(false)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors('')
    if (!(consentHipaa && consentTcpa)) { setErrors('Please accept HIPAA and TCPA consents'); return }
    if (!patientName || !patientDob || !phone) { setErrors('Name, DOB, and Phone are required'); return }
    if (showLabs && (!addr1 || !city || !state || !zip)) { setErrors('Shipping address is required for lab kits'); return }

    // Demo only: create a local consult object with triage JSON
    const triage: any = {
      category,
      testType,
      service,
      answers: f,
      ts: new Date().toISOString()
    }
    const patientId = `p_${Date.now()}`
    const consult = {
      id: `c_${Date.now()}`,
      status: 'PENDING',
      patient: { id: patientId, name: patientName, dob: patientDob, medicareId, phone, email, address: { addr1, city, state, zip } },
      triage,
      created_at: new Date().toISOString()
    }
    if (typeof window !== 'undefined') {
      const existing = JSON.parse(window.localStorage.getItem('consults_demo') || '[]')
      existing.unshift(consult)
      window.localStorage.setItem('consults_demo', JSON.stringify(existing))
      // If marketer provided email, auto-create a Patient Portal invite (magic link)
      if (email && /.+@.+\..+/.test(email)) {
        const invites = JSON.parse(window.localStorage.getItem('portal_invites_demo') || '[]')
        const token = `pt_${Math.random().toString(36).slice(2)}${Date.now()}`
        const base = `${window.location.protocol}//${window.location.host}`
        const link = `${base}/portal/login?token=${encodeURIComponent(token)}`
        invites.unshift({ token, patientId, patientName, email, link, createdAt: new Date().toISOString() })
        window.localStorage.setItem('portal_invites_demo', JSON.stringify(invites))
        // Simulate sending email by logging; in production we'd call API to send secure email
        console.log('Portal invite created for', email, 'link:', link)
      }
    }
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <h1 className="text-xl font-semibold mb-2">Thank you</h1>
        <p className="text-sm text-slate-600">Your request has been submitted. A clinician will review shortly.</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Eudaura Intake</h1>
      <form onSubmit={submit} className="space-y-4 bg-white p-4 rounded shadow">
        {errors && <div className="p-2 bg-red-50 text-red-700 text-sm rounded">{errors}</div>}
        
        {dupeCheck && dupeCheck.isDuplicate && (
          <div className={`p-3 rounded border ${
            dupeCheck.recommendation === 'BLOCK_DUPLICATE' 
              ? 'bg-red-50 border-red-200 text-red-800' 
              : 'bg-yellow-50 border-yellow-200 text-yellow-800'
          }`}>
            <div className="font-medium mb-1">
              {dupeCheck.recommendation === 'BLOCK_DUPLICATE' ? '⚠️ Duplicate Test Found' : '⚠️ Previous Test Found'}
            </div>
            <div className="text-sm">
              <p>{dupeCheck.message}</p>
              <p className="mt-1">
                <strong>Previous:</strong> {dupeCheck.existing.patientName} • {dupeCheck.existing.testCategory} • 
                {new Date(dupeCheck.existing.completedAt).toLocaleDateString()} ({dupeCheck.existing.daysSince} days ago)
              </p>
              {dupeCheck.recommendation === 'BLOCK_DUPLICATE' && (
                <p className="mt-2 font-medium">Please verify with patient before proceeding.</p>
              )}
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm">Full name
            <input className="mt-1 w-full border rounded px-2 py-1" value={patientName} onChange={(e)=>setPatientName(e.target.value)} />
          </label>
          <label className="text-sm">Phone
            <input className="mt-1 w-full border rounded px-2 py-1" placeholder="(555) 123-4567" value={phone} onChange={(e)=>setPhone(e.target.value)} />
          </label>
          <label className="text-sm">Email (optional)
            <input type="email" className="mt-1 w-full border rounded px-2 py-1" placeholder="name@example.com" value={email} onChange={(e)=>setEmail(e.target.value)} />
          </label>
          <label className="text-sm">Date of birth
            <input type="date" className="mt-1 w-full border rounded px-2 py-1" value={patientDob} onChange={(e)=>setPatientDob(e.target.value)} />
          </label>
          <label className="text-sm">State
            <input className="mt-1 w-full border rounded px-2 py-1" value={state} onChange={(e)=>setState(e.target.value)} />
          </label>
        </div>

        {showLabs && (
          <label className="text-sm">Insurance type
            <select className="mt-1 w-full border rounded px-2 py-1" value={insuranceType} onChange={(e)=>setInsuranceType(e.target.value as any)}>
              <option value="">Select insurance type...</option>
              <option value="commercial">Commercial Insurance</option>
              <option value="medicare">Medicare</option>
            </select>
          </label>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {insuranceType === 'medicare' && (
            <label className="text-sm">Medicare ID
              <div className="flex gap-2">
                <input className="mt-1 flex-1 border rounded px-2 py-1" value={medicareId} onChange={(e)=>setMedicareId(e.target.value)} />
                {medicareId && showLabs && (
                  <button type="button" onClick={checkDuplicate} disabled={checkingDupe} className="mt-1 px-3 py-1 border rounded text-sm bg-blue-50 hover:bg-blue-100 disabled:opacity-50">
                    {checkingDupe ? 'Checking...' : 'Check'}
                  </button>
                )}
              </div>
            </label>
          )}
          {insuranceType === 'commercial' && (
            <label className="text-sm">Insurance Company
              <input className="mt-1 w-full border rounded px-2 py-1" placeholder="e.g., Blue Cross Blue Shield" />
            </label>
          )}
        </div>

        <label className="text-sm">Service request
          <select className="mt-1 w-full border rounded px-2 py-1" value={service} onChange={(e)=>setService(e.target.value as Service)}>
            <option value="RX">Prescription (Rx)</option>
            <option value="LABS">Lab kit</option>
            <option value="BOTH">Both</option>
          </select>
        </label>

        {showLabs && (
          <label className="text-sm">Lab category
            <select className="mt-1 w-full border rounded px-2 py-1" value={category} onChange={(e)=>setCategory(e.target.value)}>
              <option value="NEURO">NEURO</option>
              <option value="IMMUNE">IMMUNE</option>
            </select>
          </label>
        )}

        {showLabs && category === 'NEURO' && (
          <label className="text-sm">Neuro test type
            <select className="mt-1 w-full border rounded px-2 py-1" value={testType} onChange={(e)=>setTestType(e.target.value)}>
              <option value="COGNITIVE">Cognitive</option>
              <option value="NEUROIMMUNE">Neuro-Immune</option>
            </select>
          </label>
        )}

        <label className="text-sm">Symptoms / reason
          <textarea className="mt-1 w-full border rounded px-2 py-1" rows={3} />
        </label>

        {showLabs && (
          <fieldset className="border rounded p-3">
            <legend className="text-sm font-medium">Lab kit shipping address</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className="border rounded px-2 py-1" placeholder="Address line 1" value={addr1} onChange={(e)=>setAddr1(e.target.value)} />
              <input className="border rounded px-2 py-1" placeholder="Address line 2" />
              <input className="border rounded px-2 py-1" placeholder="City" value={city} onChange={(e)=>setCity(e.target.value)} />
              <input className="border rounded px-2 py-1" placeholder="State" value={state} onChange={(e)=>setState(e.target.value)} />
              <input className="border rounded px-2 py-1" placeholder="Postal code" value={zip} onChange={(e)=>setZip(e.target.value)} />
            </div>
          </fieldset>
        )}

        {showLabs && (
          <fieldset className="border rounded p-3">
            <legend className="text-sm font-medium">Triage questions</legend>
            {category === 'NEURO' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className="border rounded px-2 py-1" placeholder="Timestamp" value={f.ts || ''} onChange={upd('ts')} />
                <input className="border rounded px-2 py-1" placeholder="Agent Name" value={f.agentName || ''} onChange={upd('agentName')} />
                <input className="border rounded px-2 py-1" placeholder="Lab" value={f.lab || ''} onChange={upd('lab')} />
                <input className="border rounded px-2 py-1" placeholder="First Name" value={f.firstName || ''} onChange={upd('firstName')} />
                <input className="border rounded px-2 py-1" placeholder="Middle Initial" value={f.middleInitial || ''} onChange={upd('middleInitial')} />
                <input className="border rounded px-2 py-1" placeholder="Last Name" value={f.lastName || ''} onChange={upd('lastName')} />
                <input className="border rounded px-2 py-1" placeholder="DOB (MM/DD/YYYY)" value={f.dobText || ''} onChange={upd('dobText')} />
                <select className="border rounded px-2 py-1" value={f.gender || ''} onChange={upd('gender')}>
                  <option value="">Gender</option>
                  <option value="F">Female</option>
                  <option value="M">Male</option>
                  <option value="O">Other</option>
                </select>
                <input className="border rounded px-2 py-1" placeholder="Ethnicity" value={f.ethnicity || ''} onChange={upd('ethnicity')} />
                <input className="border rounded px-2 py-1" placeholder="Other Ethnicity Name" value={f.otherEthnicity || ''} onChange={upd('otherEthnicity')} />
                <input className="border rounded px-2 py-1" placeholder="Marital Status" value={f.maritalStatus || ''} onChange={upd('maritalStatus')} />
                <input className="border rounded px-2 py-1" placeholder="Height" value={f.height || ''} onChange={upd('height')} />
                <input className="border rounded px-2 py-1" placeholder="Weight (lbs)" value={f.weight || ''} onChange={upd('weight')} />
                <input className="border rounded px-2 py-1" placeholder="Street Address" value={f.street || ''} onChange={upd('street')} />
                <input className="border rounded px-2 py-1" placeholder="City" value={f.city || ''} onChange={upd('city')} />
                <input className="border rounded px-2 py-1" placeholder="State" value={f.state || ''} onChange={upd('state')} />
                <input className="border rounded px-2 py-1" placeholder="Zip Code" value={f.zip || ''} onChange={upd('zip')} />
                <input className="border rounded px-2 py-1" placeholder="Phone Number" value={f.phone || ''} onChange={upd('phone')} />
                <input className="border rounded px-2 py-1" placeholder="Primary Insurance Company" value={f.primaryIns || ''} onChange={upd('primaryIns')} />
                <input className="border rounded px-2 py-1" placeholder="Primary Policy #" value={f.primaryPolicy || ''} onChange={upd('primaryPolicy')} />
                <input className="border rounded px-2 py-1" placeholder="Primary Group #" value={f.primaryGroup || ''} onChange={upd('primaryGroup')} />
                <input className="border rounded px-2 py-1" placeholder="Secondary Insurance Company" value={f.secondaryIns || ''} onChange={upd('secondaryIns')} />
                <input className="border rounded px-2 py-1" placeholder="Secondary Policy #" value={f.secondaryPolicy || ''} onChange={upd('secondaryPolicy')} />
                <input className="border rounded px-2 py-1" placeholder="Secondary Group #" value={f.secondaryGroup || ''} onChange={upd('secondaryGroup')} />
                <input className="border rounded px-2 py-1" placeholder="Primary Care Provider Name" value={f.pcpName || ''} onChange={upd('pcpName')} />
                <input className="border rounded px-2 py-1" placeholder="Primary Care Provider Phone #" value={f.pcpPhone || ''} onChange={upd('pcpPhone')} />
                <input className="border rounded px-2 py-1" placeholder="Primary Care Address" value={f.pcpAddress || ''} onChange={upd('pcpAddress')} />
                <input className="border rounded px-2 py-1" placeholder="General health" value={f.generalHealth || ''} onChange={upd('generalHealth')} />
                <input className="border rounded px-2 py-1" placeholder="Hours of sleep per night" value={f.sleepHours || ''} onChange={upd('sleepHours')} />
                <input className="border rounded px-2 py-1" placeholder="Exercise ≥3 days/week?" value={f.exercise || ''} onChange={upd('exercise')} />
                <input className="border rounded px-2 py-1" placeholder="Stress frequency" value={f.stressFreq || ''} onChange={upd('stressFreq')} />
                <input className="border rounded px-2 py-1" placeholder="Special diet" value={f.specialDiet || ''} onChange={upd('specialDiet')} />
                <input className="border rounded px-2 py-1" placeholder="Handle stress rating" value={f.handleStress || ''} onChange={upd('handleStress')} />
                <input className="border rounded px-2 py-1" placeholder="Social/emotional support" value={f.support || ''} onChange={upd('support')} />
                <input className="border rounded px-2 py-1" placeholder="Life satisfaction" value={f.lifeSatisfaction || ''} onChange={upd('lifeSatisfaction')} />
                <input className="border rounded px-2 py-1" placeholder="Prostate screening" value={f.prostate || ''} onChange={upd('prostate')} />
                <input className="border rounded px-2 py-1" placeholder="Colonoscopy" value={f.colonoscopy || ''} onChange={upd('colonoscopy')} />
                <input className="border rounded px-2 py-1" placeholder="Dexa Scan" value={f.dexa || ''} onChange={upd('dexa')} />
                <input className="border rounded px-2 py-1" placeholder="Colorectal (Fecal Bld)" value={f.fecal || ''} onChange={upd('fecal')} />
                <input className="border rounded px-2 py-1" placeholder="Mammogram" value={f.mammogram || ''} onChange={upd('mammogram')} />
                <input className="border rounded px-2 py-1" placeholder="HIV screen" value={f.hiv || ''} onChange={upd('hiv')} />
                <input className="border rounded px-2 py-1" placeholder="Paps Smear" value={f.paps || ''} onChange={upd('paps')} />
                <input className="border rounded px-2 py-1" placeholder="Flu vaccination" value={f.flu || ''} onChange={upd('flu')} />
                <input className="border rounded px-2 py-1" placeholder="Pneumococcal vaccination" value={f.pneumococcal || ''} onChange={upd('pneumococcal')} />
                <input className="border rounded px-2 py-1" placeholder="Covid vaccination" value={f.covid || ''} onChange={upd('covid')} />
                <input className="border rounded px-2 py-1" placeholder="Shingles vaccination" value={f.shingles || ''} onChange={upd('shingles')} />
                <input className="border rounded px-2 py-1" placeholder="Hep B vaccination" value={f.hepb || ''} onChange={upd('hepb')} />
                <textarea className="border rounded px-2 py-1 md:col-span-2" placeholder="Patient Medical History (diagnoses)" value={f.medHistory || ''} onChange={upd('medHistory')} />
                <textarea className="border rounded px-2 py-1 md:col-span-2" placeholder="Past Surgical History" value={f.surgHistory || ''} onChange={upd('surgHistory')} />
                <textarea className="border rounded px-2 py-1 md:col-span-2" placeholder="Current Medications (be specific)" value={f.meds || ''} onChange={upd('meds')} />
                <textarea className="border rounded px-2 py-1 md:col-span-2" placeholder="Medication Side Effects" value={f.medSideEffects || ''} onChange={upd('medSideEffects')} />
                <textarea className="border rounded px-2 py-1 md:col-span-2" placeholder="Allergies" value={f.allergies || ''} onChange={upd('allergies')} />
                <input className="border rounded px-2 py-1" placeholder="Immunodeficiency Conditions" value={f.immunodef || ''} onChange={upd('immunodef')} />
                <textarea className="border rounded px-2 py-1 md:col-span-2" placeholder="Tobacco Usage History" value={f.tobacco || ''} onChange={upd('tobacco')} />
                <textarea className="border rounded px-2 py-1 md:col-span-2" placeholder="Alcohol Usage History" value={f.alcohol || ''} onChange={upd('alcohol')} />
                <textarea className="border rounded px-2 py-1 md:col-span-2" placeholder="Recreational Drug Usage History" value={f.drugs || ''} onChange={upd('drugs')} />
                <input className="border rounded px-2 py-1" placeholder="Family Member Relation to Patient" value={f.familyRelation || ''} onChange={upd('familyRelation')} />
                <input className="border rounded px-2 py-1" placeholder="Family Member Immunodeficiency Conditions" value={f.familyImmunodef || ''} onChange={upd('familyImmunodef')} />
                <input className="border rounded px-2 py-1" placeholder="Family Member Age of Diagnosis" value={f.familyAgeDx || ''} onChange={upd('familyAgeDx')} />
              </div>
            )}
            {category === 'CGX' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className="border rounded px-2 py-1" placeholder="Cancer Personal History" />
                <input className="border rounded px-2 py-1" placeholder="Relative with cancer (relationship)" />
                <input className="border rounded px-2 py-1" placeholder="Relative condition" />
              </div>
            )}
            {category === 'PGX' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className="border rounded px-2 py-1" placeholder="Current Medications" />
                <input className="border rounded px-2 py-1" placeholder="Adverse reactions" />
              </div>
            )}
            {category === 'IMMUNE' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className="border rounded px-2 py-1" placeholder="Autoimmune history" />
                <input className="border rounded px-2 py-1" placeholder="Recent infections" />
              </div>
            )}
          </fieldset>
        )}

        {showRx && (
          <fieldset className="border rounded p-3">
            <legend className="text-sm font-medium">Medication safety checklist</legend>
            <label className="text-sm flex items-center gap-2"><input type="checkbox" /> No known allergies to requested medication</label>
            <label className="text-sm flex items-center gap-2"><input type="checkbox" /> Not pregnant/breastfeeding, or provider aware</label>
          </fieldset>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={consentHipaa} onChange={(e)=>setConsentHipaa(e.target.checked)} /> I consent to HIPAA disclosures for care.</label>
          <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={consentTcpa} onChange={(e)=>setConsentTcpa(e.target.checked)} /> I consent to TCPA communications.</label>
        </div>

        <div className="flex justify-end">
          <button className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-md text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50 transition-colors">
            Submit Intake
          </button>
        </div>
      </form>
    </div>
  )
}


