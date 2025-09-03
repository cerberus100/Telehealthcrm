"use client"
import { useState } from 'react'
import { useAuth, type Role } from '../../lib/auth'

const roles: Role[] = ['DOCTOR', 'LAB_TECH', 'PHARMACIST', 'MARKETER', 'ADMIN', 'SUPPORT']

export default function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('user@example.com')
  const [role, setRole] = useState<Role>('DOCTOR')
  return (
    <div className="max-w-md space-y-3">
      <h1 className="text-xl font-semibold">Login</h1>
      <input className="border p-2 w-full" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <select className="border p-2 w-full" value={role} onChange={(e) => setRole(e.target.value as Role)}>
        {roles.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
      <button className="border px-3 py-2" onClick={() => login({ email, role })}>Sign in</button>
    </div>
  )
}
