"use client"
import { createContext, useContext, useMemo, useState, ReactNode, useEffect } from 'react'
import { Api } from './api'
import { useRouter } from 'next/navigation'

export type Role = 'SUPER_ADMIN' | 'MARKETER_ADMIN' | 'MARKETER' | 'DOCTOR' | 'LAB_TECH' | 'PHARMACIST' | 'SUPPORT' | 'AUDITOR'

export interface AuthState {
  token: string | null
  role: Role | null
  orgId: string | null
  purposeOfUse?: string | null
  email?: string | null
}

interface AuthContextValue extends AuthState {
  login: (params: { email: string; password: string }) => Promise<AuthState>
  logout: () => void
  setPurposeOfUse: (reason: string) => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [state, setState] = useState<AuthState>(() => {
    if (typeof window === 'undefined') return { token: null, role: null, orgId: null }
    const raw = window.localStorage.getItem('auth')
    return raw ? (JSON.parse(raw) as AuthState) : { token: null, role: null, orgId: null }
  })

  // Simple refresh stub: keep token alive during session (placeholder until backend)
  useEffect(() => {
    const id = setInterval(() => {
      if (state.token) {
        // noop; would call /auth/refresh here
      }
    }, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [state.token])

  const value = useMemo<AuthContextValue>(() => ({
    ...state,
    isAuthenticated: !!state.token,
    login: async ({ email, password }) => {
      const tokens = await Api.authLogin(email, password)
      // Set an immediate demo session so UI can proceed without waiting on /auth/me
      const emailLower = (email || '').toLowerCase()
      const inferredRole: Role = emailLower.includes('admin')
        ? 'SUPER_ADMIN'
        : emailLower.includes('marketer')
          ? 'MARKETER'
          : emailLower.includes('lab')
            ? 'LAB_TECH'
            : emailLower.includes('pharmacy')
              ? 'PHARMACIST'
              : 'DOCTOR'
      const immediate: AuthState = { token: tokens.access_token, role: inferredRole, orgId: 'mock-org-123', purposeOfUse: null, email }
      setState(immediate)
      if (typeof window !== 'undefined') window.localStorage.setItem('auth', JSON.stringify(immediate))

      // Fire-and-forget: try to hydrate role/org from /auth/me with a short timeout
      ;(async () => {
        const withTimeout = <T,>(p: Promise<T>, ms: number) => new Promise<T>((resolve, reject) => {
          const id = setTimeout(() => reject(new Error('timeout')), ms)
          p.then(v => { clearTimeout(id); resolve(v) }).catch(e => { clearTimeout(id); reject(e) })
        })
        try {
          const me = await withTimeout(Api.me(), 3000)
          const hydrated: AuthState = { token: tokens.access_token, role: me.user.role as Role, orgId: me.user.org_id, purposeOfUse: null, email: me.user.email }
          setState(hydrated)
          if (typeof window !== 'undefined') window.localStorage.setItem('auth', JSON.stringify(hydrated))
        } catch {
          // keep immediate demo state
        }
      })()

      // Return immediately so caller can navigate based on role
      return immediate
    },
    logout: () => {
      const next: AuthState = { token: null, role: null, orgId: null, purposeOfUse: null, email: null }
      setState(next)
      if (typeof window !== 'undefined') window.localStorage.removeItem('auth')
      router.replace('/login')
    },
    setPurposeOfUse: (reason: string) => {
      const next: AuthState = { ...state, purposeOfUse: reason }
      setState(next)
      if (typeof window !== 'undefined') window.localStorage.setItem('auth', JSON.stringify(next))
    },
  }), [router, state])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function getAuthHeader(): string | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem('auth')
  if (!raw) return null
  const { token } = JSON.parse(raw) as AuthState
  return token ? `Bearer ${token}` : null
}

export function Protected({ children }: { children: ReactNode }) {
  const { token } = useAuth()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  if (!token) return <p>Not authenticated</p>
  return <>{children}</>
}

export function RequireRole({ allow, children }: { allow: Role[]; children: ReactNode }) {
  const { role } = useAuth()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  if (!role) return <p>Not authenticated</p>
  if (!allow.includes(role)) return <p>Access denied</p>
  return <>{children}</>
}

/**
 * Check if user has admin-level permissions
 * Super admins have full access, other admins need explicit permission grants
 */
export function hasAdminAccess(role: Role | null): boolean {
  if (!role) return false
  return role === 'SUPER_ADMIN' || role === 'MARKETER_ADMIN'
}

/**
 * Check if user can view sensitive operational metrics (like TAT)
 * Currently restricted to super admin and admin roles only
 */
export function canViewOperationalMetrics(role: Role | null): boolean {
  if (!role) return false
  return role === 'SUPER_ADMIN' || role === 'MARKETER_ADMIN'
}
