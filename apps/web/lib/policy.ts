export type OrgType = 'PROVIDER' | 'LAB' | 'PHARMACY' | 'MARKETER'
export type Role = 'MASTER_ADMIN' | 'ORG_ADMIN' | 'DOCTOR' | 'PHARMACIST' | 'LAB_TECH' | 'MARKETER' | 'SUPPORT' | 'AUDITOR'

export interface Claims {
  org_id: string
  org_type?: OrgType
  role: Role
  purpose_of_use?: string | null
  scopes?: string[]
  break_glass_until?: number | null // epoch ms
}

export type Resource = 'Patient' | 'Consult' | 'Rx' | 'LabOrder' | 'LabResult' | 'Shipment' | 'Requisition' | 'Client' | 'User' | 'Webhook' | 'AuditLog'
export type Action = 'read' | 'write' | 'list'

function isBreakGlassActive(claims: Claims): boolean {
  return !!claims.break_glass_until && Date.now() < claims.break_glass_until
}

export function canAccess(resource: Resource, action: Action, claims: Claims): boolean {
  const r = claims.role
  const p = !!claims.purpose_of_use
  switch (r) {
    case 'MARKETER': {
      if (resource === 'Consult' && (action === 'read' || action === 'list')) return true // status-only in UI
      if (resource === 'Shipment' && (action === 'read' || action === 'list')) return true
      return false
    }
    case 'PHARMACIST': {
      if (resource === 'Rx') return true
      if (resource === 'Shipment' && (action === 'read' || action === 'list')) return true
      if (resource === 'LabResult') return false
      return action !== 'write'
    }
    case 'LAB_TECH': {
      if (resource === 'LabOrder' || resource === 'LabResult' || resource === 'Shipment') return true
      if (resource === 'Rx') return false
      return action !== 'write'
    }
    case 'DOCTOR': {
      // doctor must have purpose_of_use for PHI reads
      if (['Patient', 'Consult', 'Rx', 'LabOrder', 'LabResult', 'Shipment'].includes(resource)) return p || isBreakGlassActive(claims)
      return true
    }
    case 'ORG_ADMIN': {
      // Admin ≠ PHI unless also clinical purpose-of-use
      if (['Patient', 'Consult', 'Rx', 'LabOrder', 'LabResult'].includes(resource)) return p || isBreakGlassActive(claims)
      return true
    }
    case 'MASTER_ADMIN': {
      // No PHI unless break-glass
      if (['Patient', 'Consult', 'Rx', 'LabOrder', 'LabResult'].includes(resource)) return isBreakGlassActive(claims)
      return true
    }
    case 'SUPPORT':
    case 'AUDITOR': {
      // metadata-only; UI must mask
      return resource !== 'Rx' && resource !== 'LabResult' && resource !== 'Patient'
    }
    default:
      return false
  }
}

export function maskPHI<T extends Record<string, any>>(data: T, claims: Claims): T {
  const r = claims.role
  const p = !!claims.purpose_of_use
  const bg = isBreakGlassActive(claims)
  const allowPHI = p || bg || r === 'DOCTOR'
  if (allowPHI) return data
  const clone: Record<string, any> = { ...data }
  for (const k of Object.keys(clone)) {
    if (/name|email|phone|address|dob|member|policy|script|result/i.test(k)) {
      clone[k] = '•••'
    }
  }
  return clone as T
}

export function breakGlassUntil(minutes: number): number {
  return Date.now() + minutes * 60 * 1000
}
