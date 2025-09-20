"use client"
import { useState } from 'react'

const SLOTS = ['2025-09-18T10:00:00Z','2025-09-18T11:00:00Z','2025-09-19T15:30:00Z']

export default function AppointmentsPage() {
  const [selected, setSelected] = useState<string>('')
  const [confirmed, setConfirmed] = useState<string | null>(null)
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Appointments</h1>
      {!confirmed ? (
        <div className="rounded border bg-white p-4 space-y-3">
          <h2 className="font-medium">Schedule a telehealth visit</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {SLOTS.map(s => (
              <button 
                key={s} 
                onClick={()=>setSelected(s)} 
                className={`px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                  selected===s 
                    ? 'border-brand-600 bg-brand-50 text-brand-700 ring-2 ring-brand-500 ring-offset-2' 
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {new Date(s).toLocaleString()}
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <button 
              disabled={!selected} 
              onClick={()=>setConfirmed(selected)} 
              className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2 rounded-md text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Confirm Appointment
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded border bg-white p-4">
          <p className="text-sm">Your visit is scheduled for <strong>{new Date(confirmed).toLocaleString()}</strong>.</p>
          <div className="text-sm mt-2">An email/SMS reminder and ICS file have been sent (demo).</div>
        </div>
      )}
    </div>
  )
}


