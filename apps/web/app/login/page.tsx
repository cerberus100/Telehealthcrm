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
      await login({ email, password })
      // Redirect will happen via useEffect
    } catch (err) {
      setError('Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full space-y-4 p-8 border rounded-lg shadow-sm">
        <h1 className="text-2xl font-semibold text-center">Teleplatform Login</h1>
        <p className="text-sm text-slate-600 text-center">Internal users only</p>
        
        {error && (
          <div className="p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>
        )}
        
        <input 
          className="border p-3 w-full rounded" 
          placeholder="Email" 
          type="email"
          value={email} 
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
        />
        
        <input 
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
