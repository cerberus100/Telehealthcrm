export type Role =
  | 'ADMIN'
  | 'ORG_ADMIN'
  | 'MASTER_ADMIN'
  | 'DOCTOR'
  | 'LAB_TECH'
  | 'PHARMACIST'
  | 'MARKETER'
  | 'SUPPORT'
  | 'AUDITOR'

export interface RequestClaims {
  orgId: string
  role: Role
  purposeOfUse?: string
  sub?: string
}
