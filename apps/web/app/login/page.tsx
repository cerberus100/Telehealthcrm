"use client"
import { useState } from 'react'
import { useAuth } from '../../lib/auth'

export default function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('user@example.com')
  const [password, setPassword] = useState('password12345')
  return (
    <div className="max-w-md space-y-3">
      <h1 className="text-xl font-semibold">Login</h1>
      <input className="border p-2 w-full" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className="border p-2 w-full" placeholder="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button className="border px-3 py-2" onClick={() => login({ email, password })}>Sign in</button>
    </div>
  )
}
