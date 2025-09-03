"use client"
import { createContext, useContext, useMemo, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'

export type Role = 'ADMIN' | 'DOCTOR' | 'LAB_TECH' | 'PHARMACIST' | 'MARKETER' | 'SUPPORT'

export interface AuthState {
  token: string | null
  role: Role | null
  orgId: string | null
  purposeOfUse?: string | null
  email?: string | null
}

interface AuthContextValue extends AuthState {
  login: (params: { email: string; role: Role; orgId?: string }) => void
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

  const value = useMemo<AuthContextValue>(() => ({
    ...state,
    login: ({ email, role, orgId }) => {
      const next: AuthState = { token: 'mock-token', role, orgId: orgId ?? 'org_1', purposeOfUse: null, email }
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

export function RequireRole({ allow, children }: { allow: Role[]; children: ReactNode }) {
  const { role } = useAuth()
  if (!role) return <p>Not authenticated</p>
  if (!allow.includes(role)) return <p>Access denied</p>
  return <>{children}</>
}
