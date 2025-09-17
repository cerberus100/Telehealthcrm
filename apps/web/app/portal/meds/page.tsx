"use client"
import { useState } from 'react'

type Med = { id: string; name: string; dose: string; directions: string; status?: string }
const MEDS: Med[] = [
  { id: 'm1', name: 'Lisinopril', dose: '10 mg', directions: 'Once daily' },
  { id: 'm2', name: 'Metformin', dose: '500 mg', directions: 'BID with meals' },
]

export default function MedsPage() {
  const [refillFor, setRefillFor] = useState<Med | null>(null)
  const [submitted, setSubmitted] = useState(false)
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Medications</h1>
      <div className="rounded border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left">
              <th className="p-2">Medication</th>
              <th className="p-2">Dose</th>
              <th className="p-2">Directions</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {MEDS.map(m => (
              <tr key={m.id}>
                <td className="p-2">{m.name}</td>
                <td className="p-2">{m.dose}</td>
                <td className="p-2">{m.directions}</td>
                <td className="p-2"><button className="px-3 py-1 rounded border" onClick={()=>setRefillFor(m)}>Request refill</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {refillFor && (
        <div role="dialog" aria-modal className="fixed inset-0 bg-black/30 flex items-center justify-center p-4" onClick={()=>setRefillFor(null)}>
          <div className="bg-white rounded shadow max-w-sm w-full p-4" onClick={(e)=>e.stopPropagation()}>
            <h2 className="font-semibold mb-2">Refill request</h2>
            <p className="text-sm mb-3">{refillFor.name} {refillFor.dose}</p>
            {!submitted ? (
              <div className="flex justify-end gap-2">
                <button className="px-3 py-2 rounded border" onClick={()=>setRefillFor(null)}>Cancel</button>
                <button className="px-3 py-2 rounded text-white" style={{ backgroundColor: '#007DB8' }} onClick={()=>setSubmitted(true)}>Submit</button>
              </div>
            ) : (
              <div className="text-sm">Request submitted. You’ll see status updates here.</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


