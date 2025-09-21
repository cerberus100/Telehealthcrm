"use client"
import { useState, useEffect } from 'react'
import { useAuth } from '../../lib/auth'
import { useRouter } from 'next/navigation'
import { EudauraLogo } from '../../components/EudauraLogo'

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
    <div className="relative min-h-screen flex items-center justify-center bg-slate-900">
      {/* Background Eudaura Logo */}
      <div className="absolute inset-0 flex items-center justify-center">
        <EudauraLogo size="bg" className="opacity-20 scale-150" />
      </div>

      {/* Login Form */}
      <div className="relative z-10 max-w-md w-full mx-4">
        <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl border border-white/20 p-8 space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Welcome to Eudaura</h1>
            <p className="text-sm text-slate-600">Sign in to your account</p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                autoComplete="email"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                placeholder="Enter your email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                Password
              </label>
              <input
                id="password"
                name="password"
                autoComplete="current-password"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                placeholder="Enter your password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              className="w-full bg-brand-600 text-white py-3 px-4 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              onClick={handleLogin}
              disabled={loading || !email || !password}
              type="submit"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="text-center">
            <p className="text-xs text-slate-500">
              Contact your administrator for access
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
