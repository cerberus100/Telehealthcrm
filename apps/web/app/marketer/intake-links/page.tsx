"use client"
import { useState } from 'react'
import { useAuth } from '../../../lib/auth'

type LinkItem = {
  id: string
  url: string
  did: string
  services: 'RX' | 'LABS' | 'BOTH'
  clients: string[]
  campaign?: string
  triageCategories: string[]
}

export default function IntakeLinksPage() {
  const { role } = useAuth()
  if (!(role === 'MARKETER' || role === 'MARKETER_ADMIN' || role === 'SUPER_ADMIN')) return <p>Access denied</p>

  const [items, setItems] = useState<LinkItem[]>([
    { id: 'lnk_1', url: 'http://localhost:3000/intake/lnk_1', did: '+18005550111', services: 'BOTH', clients: ['Acme Provider'], campaign: 'Fall-24', triageCategories: ['NEURO','IMMUNE','CGX','PGX'] }
  ])
  const [services, setServices] = useState<'RX'|'LABS'|'BOTH'>('BOTH')
  const [clients, setClients] = useState<string>('Acme Provider')
  const [campaign, setCampaign] = useState<string>('')
  const [triage, setTriage] = useState<string[]>(['NEURO','IMMUNE','CGX','PGX'])

  const create = () => {
    const id = `lnk_${items.length + 1}`
    const did = `+18005550${100 + items.length}`
    const url = `${window.location.origin}/intake/${id}`
    const next = [{ id, url, did, services, clients: clients.split(',').map(s=>s.trim()), campaign, triageCategories: triage }, ...items]
    setItems(next)
    // persist to localStorage for the public form to read in demo mode
    if (typeof window !== 'undefined') window.localStorage.setItem('intake_links', JSON.stringify(next))
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Intake Links</h1>
      <div className="bg-white p-4 rounded shadow space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <label className="text-sm">Service Mode
            <select className="mt-1 w-full border rounded px-2 py-1" value={services} onChange={(e)=>setServices(e.target.value as any)}>
              <option value="RX">RX</option>
              <option value="LABS">LABS</option>
              <option value="BOTH">BOTH</option>
            </select>
          </label>
          <label className="text-sm">Clients (comma‑sep)
            <input className="mt-1 w-full border rounded px-2 py-1" value={clients} onChange={(e)=>setClients(e.target.value)} />
          </label>
          <label className="text-sm">Campaign (optional)
            <input className="mt-1 w-full border rounded px-2 py-1" value={campaign} onChange={(e)=>setCampaign(e.target.value)} />
          </label>
          <label className="text-sm">Triage Categories
            <div className="mt-1 flex flex-wrap gap-2">
              {['NEURO','IMMUNE','CGX','PGX'].map(opt => (
                <label key={opt} className="text-xs inline-flex items-center gap-1 border rounded px-2 py-1">
                  <input type="checkbox" checked={triage.includes(opt)} onChange={(e)=> setTriage(prev => e.target.checked ? [...new Set([...prev,opt])] : prev.filter(x=>x!==opt))} /> {opt}
                </label>
              ))}
            </div>
          </label>
          <div className="flex items-end">
            <button className="w-full px-3 py-2 rounded bg-brand-600 text-white hover:bg-brand-700" onClick={create}>Create Link</button>
          </div>
        </div>
        <p className="text-xs text-slate-500">Creating a link assigns a mock DID and URL for demo.</p>
      </div>

      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="p-2 text-left">Link</th>
            <th className="p-2 text-left">DID</th>
            <th className="p-2 text-left">Services</th>
            <th className="p-2 text-left">Clients</th>
            <th className="p-2 text-left">Campaign</th>
            <th className="p-2 text-left">Triage</th>
            <th className="p-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id} className="border-t">
              <td className="p-2"><a className="text-brand-700 underline" href={i.url} target="_blank" rel="noreferrer">{i.url}</a></td>
              <td className="p-2">{i.did}</td>
              <td className="p-2">{i.services}</td>
              <td className="p-2">{i.clients.join(', ')}</td>
              <td className="p-2">{i.campaign || '-'}</td>
              <td className="p-2 text-xs">{i.triageCategories.join(', ')}</td>
              <td className="p-2"><button className="text-slate-700 underline" onClick={()=>navigator.clipboard.writeText(i.url)}>Copy URL</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}


