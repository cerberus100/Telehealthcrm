export type Role =
  | 'ADMIN'
  | 'DOCTOR'
  | 'LAB_TECH'
  | 'PHARMACIST'
  | 'MARKETER'
  | 'SUPPORT'

export interface RequestClaims {
  orgId: string
  role: Role
  purposeOfUse?: string
  sub?: string
}
