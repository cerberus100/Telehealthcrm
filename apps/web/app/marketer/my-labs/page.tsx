"use client"
import { useEffect, useRef, useState } from 'react'
import { Api } from '../../../lib/api'

type Item = { id: string; labName: string; title: string; filename: string; mimeType: string; sizeBytes: number; createdAt: string }

export default function MyLabs() {
  const [items, setItems] = useState<Item[]>([])
  const [labName, setLabName] = useState('')
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [acceptsCommercial, setAcceptsCommercial] = useState(true)
  const [acceptsMedicare, setAcceptsMedicare] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    const res = await Api.get('/requisitions/templates')
    setItems(res.items || [])
  }

  useEffect(() => { load() }, [])

  const onUpload = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file || !labName || !title) return
    setLoading(true)
    try {
      const buf = await file.arrayBuffer()
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
      await Api.postJson('/requisitions/templates', {
        labName,
        title,
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        fileB64: b64,
        insurancesAccepted: {
          commercial: acceptsCommercial,
          medicare: acceptsMedicare
        }
      })
      await load()
      setTitle('')
      setLabName('')
      if (fileRef.current) fileRef.current.value = ''
    } finally {
      setLoading(false)
    }
  }

  const download = async (id: string) => {
    const res = await fetch(`${location.origin.replace(/:\d+$/, ':3001')}/requisitions/templates/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'requisition'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">My Labs — Requisition Templates</h1>
      <div className="bg-white p-4 rounded shadow space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-sm">Lab name
            <input className="mt-1 w-full border rounded px-2 py-1" value={labName} onChange={(e)=>setLabName(e.target.value)} placeholder="e.g., NeuroLabs Inc." />
          </label>
          <label className="text-sm">Template title
            <input className="mt-1 w-full border rounded px-2 py-1" value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="e.g., Cognitive Panel Requisition" />
          </label>
          <label className="text-sm">Upload file (PDF/Image)
            <input ref={fileRef} type="file" accept="application/pdf,image/*" className="mt-1 w-full" />
          </label>
        </div>
        
        <fieldset className="border rounded p-3">
          <legend className="text-sm font-medium">Insurances Accepted</legend>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm flex items-center gap-2">
              <input type="checkbox" checked={acceptsCommercial} onChange={(e)=>setAcceptsCommercial(e.target.checked)} />
              Commercial Insurances
            </label>
            <label className="text-sm flex items-center gap-2">
              <input type="checkbox" checked={acceptsMedicare} onChange={(e)=>setAcceptsMedicare(e.target.checked)} />
              Medicare
            </label>
          </div>
          <p className="text-xs text-slate-600 mt-2">
            Only checked insurance types will appear as options on intake forms for this lab.
          </p>
        </fieldset>
        <div className="flex justify-end">
          <button type="button" disabled={loading} onClick={onUpload} className="px-4 py-2 rounded bg-brand-600 text-white disabled:opacity-60">{loading ? 'Uploading…' : 'Upload'}</button>
        </div>
      </div>

      <div className="bg-white p-4 rounded shadow">
        <h2 className="text-lg font-semibold mb-2">Uploaded templates</h2>
        {items.length === 0 ? (
          <p className="text-sm text-slate-600">No templates yet. Upload your lab’s requisition forms above.</p>
        ) : (
          <ul className="divide-y">
            {items.map(it => (
              <li key={it.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{it.title}</p>
                  <p className="text-xs text-slate-600 truncate">{it.labName} • {it.filename} • {(it.sizeBytes/1024).toFixed(1)} KB • {new Date(it.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={()=>download(it.id)} className="px-3 py-1 rounded border text-sm">Download</button>
                </div>
              </li>) )}
          </ul>
        )}
      </div>
    </div>
  )
}


