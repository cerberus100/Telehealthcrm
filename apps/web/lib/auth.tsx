"use client"
import { createContext, useContext, useMemo, useState, ReactNode, useEffect } from 'react'
import { Api } from './api'
import { useRouter } from 'next/navigation'

import type { Role } from './policy'

export interface AuthState {
  token: string | null
  role: Role | null
  orgId: string | null
  purposeOfUse?: string | null
  email?: string | null
  orgType?: string | null
  userId?: string | null
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
      try {
        // Authenticate with backend
        const tokens = await Api.authLogin(email || '', password || '')

        // Get full user profile and claims from server
        const me = await Api.me()

        // Build complete auth state from server response
        const authState: AuthState = {
          token: tokens.access_token,
          role: me.user.role as Role,
          orgId: me.user.org_id,
          purposeOfUse: null,
          email: me.user.email,
          orgType: me.org.type,
          userId: me.user.id
        }

        setState(authState)
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('auth', JSON.stringify(authState))
        }

        return authState
      } catch (error) {
        // Clear any existing auth state on login failure
        setState({ token: null, role: null, orgId: null, purposeOfUse: null, email: null })
        throw error
      }
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
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'ORG_ADMIN' || role === 'MARKETER_ADMIN'
}

/**
 * Check if user can view sensitive operational metrics (like TAT)
 * Currently restricted to super admin and admin roles only
 */
export function canViewOperationalMetrics(role: Role | null): boolean {
  if (!role) return false
  return role === 'SUPER_ADMIN' || role === 'ADMIN'
}

/**
 * Check if user can access PHI data
 * Requires clinical roles with proper purpose of use
 */
export function canAccessPHI(role: Role | null, purposeOfUse?: string | null): boolean {
  if (!role) return false
  const clinicalRoles = ['DOCTOR', 'PHARMACIST', 'LAB_TECH', 'ADMIN', 'ORG_ADMIN', 'MARKETER_ADMIN']
  return clinicalRoles.includes(role) && !!purposeOfUse
}

/**
 * Get role hierarchy level for comparison
 * Higher numbers = more permissions
 */
export function getRoleLevel(role: Role | null): number {
  if (!role) return 0

  const hierarchy: Record<Role, number> = {
    'SUPER_ADMIN': 10,
    'ADMIN': 8,
    'ORG_ADMIN': 7,
    'MARKETER_ADMIN': 6,
    'DOCTOR': 5,
    'PHARMACIST': 4,
    'LAB_TECH': 3,
    'MARKETER': 2,
    'SUPPORT': 1,
    'AUDITOR': 1,
  }

  return hierarchy[role] || 0
}
