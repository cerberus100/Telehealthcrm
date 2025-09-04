"use client"
import { useAuth } from './auth'

export interface SessionInfo {
  email: string | null
  role: string | null
  userId: string | null
  marketerOrgId: string | null
}

export function useSession(): SessionInfo {
  const { email, role, orgId } = useAuth()
  
  // In a real app, userId would come from the JWT or /me endpoint
  // For now, derive from email
  const userId = email ? `user-${email.split('@')[0]}` : null
  
  return {
    email: email || null,
    role: role || null,
    userId,
    marketerOrgId: (role === 'MARKETER' || role === 'MARKETER_ADMIN') ? orgId : null
  }
}
