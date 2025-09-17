"use client"
import Link from 'next/link'
import { ReactNode } from 'react'

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-10 border-b bg-white">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <Link href="/portal" className="text-base font-semibold" style={{ color: '#007DB8' }}>Teleplatform Patient Portal</Link>
          <nav className="text-sm flex items-center gap-4">
            <Link href="/portal" className="hover:underline">Dashboard</Link>
            <Link href="/portal/appointments" className="hover:underline">Appointments</Link>
            <Link href="/portal/results" className="hover:underline">Results</Link>
            <Link href="/portal/messages" className="hover:underline">Messages</Link>
            <Link href="/portal/meds" className="hover:underline">Meds</Link>
            <Link href="/portal/wellness" className="hover:underline">Wellness</Link>
            <Link href="/portal/health-data" className="hover:underline">Health Data</Link>
            <Link href="/portal/care-plans" className="hover:underline">Care Plans</Link>
            <Link href="/portal/profile" className="hover:underline">Profile</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-4">
        {children}
      </main>
    </div>
  )
}


