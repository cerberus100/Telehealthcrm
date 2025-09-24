export type Role =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'ORG_ADMIN'
  | 'DOCTOR'
  | 'LAB_TECH'
  | 'PHARMACIST'
  | 'MARKETER'
  | 'MARKETER_ADMIN'
  | 'SUPPORT'
  | 'AUDITOR'

export interface RequestClaims {
  orgId: string
  role: Role
  purposeOfUse?: string
  sub?: string
}
