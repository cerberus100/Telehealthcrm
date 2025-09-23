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
    <main className="min-h-screen bg-hero-aura relative flex items-center justify-center px-4">
      {/* FULL-VIEWPORT AURA */}
      <div aria-hidden className="aura-viewport">
        <svg
          className="aura-size aura-pulse"
          viewBox="0 0 1000 1000"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* soft golden gradient for the stroke */}
            <linearGradient id="goldStroke" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#C7A867" stopOpacity="0.95"/>
              <stop offset="60%" stopColor="#C7A867" stopOpacity="0.90"/>
              <stop offset="100%" stopColor="#C7A867" stopOpacity="0.85"/>
            </linearGradient>

            {/* outer glow: gaussian blur + blend */}
            <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur"/>
              <feMerge>
                <feMergeNode in="blur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>

            {/* faint fill halo to enrich glow without looking "neon" */}
            <radialGradient id="haloFill" cx="50%" cy="50%" r="50%">
              <stop offset="55%" stopColor="#C7A867" stopOpacity="0.12"/>
              <stop offset="75%" stopColor="#C7A867" stopOpacity="0.06"/>
              <stop offset="100%" stopColor="#C7A867" stopOpacity="0"/>
            </radialGradient>
          </defs>

          {/* subtle wide halo */}
          <circle cx="500" cy="500" r="420" fill="url(#haloFill)"/>

          {/* main ring */}
          <circle
            cx="500" cy="500" r="400"
            fill="none"
            stroke="url(#goldStroke)"
            strokeWidth="12"
            filter="url(#softGlow)"
          />

          {/* secondary inner ring for richness (very faint) */}
          <circle
            cx="500" cy="500" r="330"
            fill="none"
            stroke="#C7A867"
            strokeOpacity="0.25"
            strokeWidth="6"
            filter="url(#softGlow)"
          />
        </svg>
      </div>

      {/* CARD */}
      <div className="relative w-full max-w-md fade-up">
        <div className="card-premium p-8 rounded-2xl shadow-lg" role="main" aria-labelledby="login-heading">
          <div className="flex flex-col items-center mb-6">
            <div className="text-2xl font-semibold tracking-tight text-foreground">Eudaura</div>
            <p className="mt-1 text-xs text-muted">The future of medicine is presence.</p>
          </div>

          <h1 id="login-heading" className="text-center text-lg font-semibold text-foreground mb-1">
            Welcome to Eudaura
          </h1>
          <p className="text-center text-sm text-muted mb-5">Sign in to your account</p>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm mb-4" role="alert" aria-live="polite">
              {error}
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-4" noValidate>
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-foreground">Email Address</label>
              <input 
                id="email" 
                name="email"
                type="email" 
                autoComplete="email"
                placeholder="Enter your email" 
                className="input-premium w-full px-3 text-foreground" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                aria-describedby={error ? "error-message" : undefined}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-foreground">Password</label>
              <input 
                id="password" 
                name="password"
                type="password" 
                autoComplete="current-password"
                placeholder="Enter your password" 
                className="input-premium w-full px-3 text-foreground" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                aria-describedby={error ? "error-message" : undefined}
              />
            </div>
            <button 
              type="submit" 
              className="btn-premium w-full font-medium"
              onClick={handleLogin}
              disabled={loading || !email || !password}
              aria-describedby="login-help"
            >
              {loading ? (
                <>
                  <span className="sr-only">Signing in, please wait</span>
                  <span aria-hidden="true">Signing in...</span>
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <p id="login-help" className="mt-4 text-center text-xs text-muted">Contact your administrator for access</p>
        </div>
      </div>
    </main>
  )
}
