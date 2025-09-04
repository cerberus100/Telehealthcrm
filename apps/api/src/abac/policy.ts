import type { RequestClaims } from '../types/claims'

type Resource = 'Consult' | 'Rx' | 'LabOrder' | 'LabResult' | 'Shipment' | 'Patient' | 'User' | 'Auth' | 'Health' | 'Notification'

type Action = 'read' | 'write' | 'list' | 'update' | 'logout'

export interface AccessRequest {
  subject: RequestClaims
  resource: Resource
  action: Action
  fields?: string[]
  resourceOrgId?: string
}

export interface AccessDecision {
  allow: boolean
  maskFields?: string[]
  reason?: string
}

export function evaluatePolicy(req: AccessRequest): AccessDecision {
  const { subject, resource, action, resourceOrgId } = req
  const sameOrg = !resourceOrgId || resourceOrgId === subject.orgId

  // Deny cross-org by default
  if (!sameOrg) return { allow: false, reason: 'cross-tenant access denied' }

  // Treat org/master admin as admin-equivalent
  const role = subject.role === 'ORG_ADMIN' || subject.role === 'MASTER_ADMIN' ? 'ADMIN' : subject.role

  switch (role) {
    case 'MARKETER': {
      if (resource === 'Consult' && (action === 'read' || action === 'list')) {
        // Marketer minimal access: only status/approved flags; mask PHI and reason codes
        return { allow: true, maskFields: ['reason_codes', 'patient', 'created_from'] }
      }
      if (resource === 'Shipment' && (action === 'read' || action === 'list')) {
        // Mask PII in shipping details
        return { allow: true, maskFields: ['ship_to.name', 'ship_to.street', 'ship_to.address'] }
      }
      if (resource === 'Health' && action === 'read') return { allow: true }
      if (resource === 'Notification' && action === 'read') return { allow: true }
      return { allow: false, reason: 'marketer not permitted' }
    }
    case 'PHARMACIST': {
      if (resource === 'Rx') return { allow: true }
      if (resource === 'LabResult') return { allow: false, reason: 'pharmacy cannot view lab results' }
      return { allow: true }
    }
    case 'LAB_TECH': {
      if (resource === 'LabOrder' || resource === 'LabResult' || resource === 'Shipment') return { allow: true }
      if (resource === 'Rx') return { allow: false, reason: 'lab cannot view Rx' }
      return { allow: true }
    }
    case 'DOCTOR':
    case 'ADMIN':
    case 'SUPPORT':
    case 'AUDITOR': {
      if (role === 'AUDITOR' && action !== 'read' && action !== 'list') return { allow: false, reason: 'auditor read-only' }
      return { allow: true }
    }
    default:
      return { allow: false, reason: 'role not recognized' }
  }
}
