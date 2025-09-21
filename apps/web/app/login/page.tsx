"use client"
import { useState, useEffect } from 'react'
import { useAuth } from '../../lib/auth'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const { login, role, isAuthenticated } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Role-based redirects
  useEffect(() => {
    if (isAuthenticated && role) {
      // Redirect based on role
      if (role === 'SUPER_ADMIN') {
        router.replace('/admin')
      } else if (role === 'MARKETER_ADMIN' || role === 'MARKETER') {
        router.replace('/shipments')
      } else if (role === 'DOCTOR' || role === 'PHARMACIST' || role === 'LAB_TECH') {
        router.replace('/')
      } else {
        router.replace('/')
      }
    }
  }, [isAuthenticated, role, router])

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    try {
      const next = await login({ email, password })
      // Redirect immediately based on returned state to avoid hydration timing issues
      const r = next.role || role
      if (r === 'SUPER_ADMIN') {
        router.replace('/admin')
      } else if (r === 'MARKETER_ADMIN' || r === 'MARKETER') {
        router.replace('/shipments')
      } else if (r === 'DOCTOR') {
        router.replace('/dashboard')
      } else if (r === 'PHARMACIST' || r === 'LAB_TECH') {
        router.replace('/')
      } else {
        router.replace('/')
      }
    } catch (err) {
      console.error('Login error:', err)
      setError(err instanceof Error ? err.message : 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full space-y-4 p-8 border rounded-lg shadow-sm">
        <h1 className="text-2xl font-semibold text-center">Eudaura Login</h1>
        <p className="text-sm text-slate-600 text-center">Internal users only</p>
        
        {error && (
          <div className="p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>
        )}
        
        <label htmlFor="email" className="sr-only">Email</label>
        <input 
          id="email"
          name="email"
          autoComplete="email"
          className="border p-3 w-full rounded" 
          placeholder="Email" 
          type="email"
          value={email} 
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
        />
        
        <label htmlFor="password" className="sr-only">Password</label>
        <input 
          id="password"
          name="password"
          autoComplete="current-password"
          className="border p-3 w-full rounded" 
          placeholder="Password" 
          type="password" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
        />
        
        <button 
          className="w-full bg-brand-600 text-white py-3 rounded hover:bg-brand-700 disabled:opacity-50"
          onClick={handleLogin}
          disabled={loading || !email || !password}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <p className="text-xs text-slate-500 text-center">
          Contact your administrator for access
        </p>
      </div>
    </div>
  )
}
