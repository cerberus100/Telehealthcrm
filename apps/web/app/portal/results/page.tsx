"use client"
import { useState } from 'react'

type Result = { id: string; type: 'lab'|'imaging'|'genetic'|'pathology'; name: string; releasedAt: string; value?: string; flag?: 'H'|'L'|'CRIT'; ref?: string }
const DEMO: Result[] = [
  { id: 'r1', type: 'lab', name: 'Hemoglobin A1c', releasedAt: new Date().toISOString(), value: '6.8%', flag: 'H', ref: '4.0–5.6%' },
  { id: 'r2', type: 'imaging', name: 'Chest X-Ray', releasedAt: new Date(Date.now()-86400000).toISOString() },
]

export default function ResultsPage() {
  const [selected, setSelected] = useState<Result | null>(null)
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Results</h1>
      <div className="rounded border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left">
              <th className="p-2">Type</th>
              <th className="p-2">Name</th>
              <th className="p-2">Released</th>
              <th className="p-2">Flag</th>
            </tr>
          </thead>
          <tbody>
            {DEMO.map(r => (
              <tr key={r.id} className="hover:bg-slate-50 cursor-pointer" onClick={()=>setSelected(r)}>
                <td className="p-2 capitalize">{r.type}</td>
                <td className="p-2">{r.name}</td>
                <td className="p-2">{new Date(r.releasedAt).toLocaleString()}</td>
                <td className="p-2">{r.flag || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected && (
        <div role="dialog" aria-modal className="fixed inset-0 bg-black/30 flex items-center justify-center p-4" onClick={()=>setSelected(null)}>
          <div className="bg-white rounded shadow max-w-lg w-full p-4" onClick={(e)=>e.stopPropagation()}>
            <h2 className="font-semibold mb-2">{selected.name}</h2>
            {selected.value && (
              <div className="text-sm">Value: <span className="font-medium">{selected.value}</span> {selected.ref ? <span className="text-slate-500">(ref {selected.ref})</span> : null} {selected.flag ? <span className="ml-2 text-red-600">{selected.flag}</span> : null}</div>
            )}
            <div className="text-xs text-slate-600 mt-2">All accesses are audited. Downloads are watermarked (demo).</div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="px-3 py-2 rounded border">Download</button>
              <button className="px-3 py-2 rounded border" onClick={()=>setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


