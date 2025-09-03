"use client"
import Link from 'next/link'
import { useAuth } from '../lib/auth'

export default function AppNav() {
  const { role } = useAuth()
  return (
    <nav className="flex items-center gap-3 text-sm">
      <Link href="/consults" className="underline">Consults</Link>
      <Link href="/shipments" className="underline">Shipments</Link>
      {(role === 'DOCTOR' || role === 'PHARMACIST') && (
        <Link href="/rx" className="underline">Rx</Link>
      )}
    </nav>
  )
}
