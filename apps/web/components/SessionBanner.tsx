"use client"
import { useAuth } from '../lib/auth'

export default function SessionBanner() {
  const { email, role } = useAuth()
  if (!email || !role) return null
  return (
    <div className="w-full bg-slate-50 border-b text-sm px-4 py-2">
      Signed in as <span className="font-medium">{email}</span> ({role})
    </div>
  )
}
