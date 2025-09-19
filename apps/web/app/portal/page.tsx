"use client"
import Link from 'next/link'

function Kpi({ label, value, suffix }: { label: string; value: string | number; suffix?: string }) {
  return (
    <div className="rounded-lg border p-4 bg-white shadow-sm" aria-label={label}>
      <div className="text-xs text-slate-600">{label}</div>
      <div className="text-2xl font-semibold" style={{ color: '#007DB8' }}>{value}{suffix || ''}</div>
    </div>
  )
}

export default function PortalDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi label="Upcoming visits" value={1} />
        <Kpi label="New results" value={2} />
        <Kpi label="Refill status" value={"1 pending"} />
        <Kpi label="Care plan progress" value={72} suffix="%" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border p-4 bg-white">
          <h2 className="font-semibold mb-2">Quick actions</h2>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link className="px-3 py-2 rounded border" href="/portal/appointments">Schedule visit</Link>
            <Link className="px-3 py-2 rounded border" href="/portal/results">View results</Link>
            <Link className="px-3 py-2 rounded border" href="/portal/meds">Request refill</Link>
            <Link className="px-3 py-2 rounded border" href="/portal/care-plans">Care plan</Link>
          </div>
        </div>
        <div className="rounded-lg border p-4 bg-white">
          <h2 className="font-semibold mb-2">Wellness reminders</h2>
          <ul className="text-sm space-y-2">
            <li className="flex items-center justify-between"><span>Flu vaccine</span><button className="px-2 py-1 rounded border">Schedule</button></li>
            <li className="flex items-center justify-between"><span>Annual checkup</span><button className="px-2 py-1 rounded border">Schedule</button></li>
          </ul>
        </div>
      </div>
    </div>
  )
}


