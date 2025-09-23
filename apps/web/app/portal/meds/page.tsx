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
                <td className="p-2">
                  <button 
                    onClick={()=>setRefillFor(m)}
                    className="bg-brand-600 hover:bg-brand-700 text-white px-3 py-1 rounded-md text-xs font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-colors"
                  >
                    Request Refill
                  </button>
                </td>
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
                <button 
                  onClick={()=>setRefillFor(null)}
                  className="bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded-md text-sm font-medium hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500"
                >
                  Cancel
                </button>
                <button 
                  onClick={()=>setSubmitted(true)}
                  className="bg-brand-600 hover:bg-brand-700 text-white px-3 py-2 rounded-md text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500"
                >
                  Submit Request
                </button>
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


