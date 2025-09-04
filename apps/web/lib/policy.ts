export type OrgType = 'PROVIDER' | 'LAB' | 'PHARMACY' | 'MARKETER'
export type Role = 'SUPER_ADMIN' | 'MARKETER_ADMIN' | 'MARKETER' | 'DOCTOR' | 'PHARMACIST' | 'LAB_TECH' | 'SUPPORT' | 'AUDITOR'

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
    case 'MARKETER_ADMIN': {
      // Admin ≠ PHI unless also clinical purpose-of-use
      if (['Patient', 'Consult', 'Rx', 'LabOrder', 'LabResult'].includes(resource)) return p || isBreakGlassActive(claims)
      return true
    }
    case 'SUPER_ADMIN': {
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

export function breakGlassUntil(minutes: number): number {
  return Date.now() + minutes * 60 * 1000
}

// Utility to check if a user needs to enter purpose-of-use for PHI
export function requiresPurposeOfUse(role: string, resource: string): boolean {
  return ['DOCTOR', 'PHARMACIST', 'LAB_TECH'].includes(role) && 
         ['patient_details', 'rx_script', 'lab_result_details'].includes(resource)
}

// PHI masking utilities
export function maskSSN(ssn: string): string {
  if (!ssn || ssn.length < 4) return '***-**-****'
  return `***-**-${ssn.slice(-4)}`
}

export function maskDOB(dob: string, role: string): string {
  if (role === 'MARKETER') return 'XX/XX/XXXX'
  if (!dob) return ''
  const date = new Date(dob)
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`
}

export function maskPhone(phone: string, role: string): string {
  if (role === 'MARKETER') return '(XXX) XXX-XXXX'
  if (!phone || phone.length < 4) return phone
  return phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) ***-$3')
}

export function maskEmail(email: string, role: string): string {
  if (role === 'MARKETER') return 'xxxxx@xxxxx.xxx'
  if (!email || !email.includes('@')) return email
  const [local, domain] = email.split('@')
  if (!local || !domain) return email
  return `${local[0]}${'*'.repeat(Math.max(0, local.length - 1))}@${domain}`
}

export function maskAddress(address: any, role: string): any {
  if (!address) return {}
  if (role === 'MARKETER') {
    return {
      ...address,
      street: 'XXXXX',
      city: address.city, // City/State/Zip visible for shipping
      state: address.state,
      zip: address.zip
    }
  }
  return address
}

// Master PHI masking function
export function maskPHI(data: any, role: string, context?: string): any {
  if (!data) return data

  // Clone to avoid mutations
  const masked = JSON.parse(JSON.stringify(data))

  // Apply masking based on role and context
  if (masked.ssn) masked.ssn = maskSSN(masked.ssn)
  if (masked.dob) masked.dob = maskDOB(masked.dob, role)
  if (masked.phone) masked.phone = maskPhone(masked.phone, role)
  if (masked.email) masked.email = maskEmail(masked.email, role)
  if (masked.address) masked.address = maskAddress(masked.address, role)

  // Role-specific masking
  if (role === 'MARKETER') {
    // Remove all clinical data
    delete masked.script_blob_encrypted
    delete masked.result_blob_encrypted
    delete masked.diagnosis
    delete masked.medications
    delete masked.allergies
    delete masked.medical_history
  }

  if (role === 'PHARMACIST' && context !== 'rx') {
    // Pharmacists can't see lab results
    delete masked.result_blob_encrypted
    delete masked.lab_values
  }

  if (role === 'LAB_TECH' && context !== 'lab') {
    // Lab techs can't see Rx data
    delete masked.script_blob_encrypted
    delete masked.medications
    delete masked.refills
  }

  return masked
}