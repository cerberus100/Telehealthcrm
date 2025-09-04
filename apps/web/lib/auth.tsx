"use client"
import { createContext, useContext, useMemo, useState, ReactNode, useEffect } from 'react'
import { Api } from './api'
import { useRouter } from 'next/navigation'

export type Role = 'MASTER_ADMIN' | 'ORG_ADMIN' | 'DOCTOR' | 'LAB_TECH' | 'PHARMACIST' | 'MARKETER' | 'SUPPORT' | 'AUDITOR'

export interface AuthState {
  token: string | null
  role: Role | null
  orgId: string | null
  purposeOfUse?: string | null
  email?: string | null
}

interface AuthContextValue extends AuthState {
  login: (params: { email: string; password: string }) => Promise<void>
  logout: () => void
  setPurposeOfUse: (reason: string) => void
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
    login: async ({ email, password }) => {
      const tokens = await Api.authLogin(email, password)
      const next: AuthState = { token: tokens.access_token, role: null, orgId: null, purposeOfUse: null, email }
      setState(next)
      if (typeof window !== 'undefined') window.localStorage.setItem('auth', JSON.stringify(next))
      router.replace('/')
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
  if (!token) return <p>Not authenticated</p>
  return <>{children}</>
}

export function RequireRole({ allow, children }: { allow: Role[]; children: ReactNode }) {
  const { role } = useAuth()
  if (!role) return <p>Not authenticated</p>
  if (!allow.includes(role)) return <p>Access denied</p>
  return <>{children}</>
}
