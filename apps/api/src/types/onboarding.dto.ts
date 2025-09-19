import { z } from 'zod'

// Step 1: Account Creation
export const PhysicianStep1Dto = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  mobile: z.string().regex(/^\+?[\d\s\-\(\)]{10,15}$/, 'Invalid phone format'),
  password: z.string().min(8).max(128)
})

// Step 2: Licensing & Credentials
const LicenseDto = z.object({
  state: z.string().length(2),
  number: z.string().min(1).max(50),
  expiration: z.string().datetime()
})

const BoardCertDto = z.object({
  name: z.string().min(1).max(200),
  board: z.string().min(1).max(200),
  expiration: z.string().datetime()
})

const MalpracticeDto = z.object({
  carrier: z.string().min(1).max(200),
  policy: z.string().min(1).max(100),
  limits: z.string().min(1).max(50),
  effective: z.string().datetime(),
  expiration: z.string().datetime()
})

const UploadsDto = z.object({
  gov_id_b64: z.string().min(100), // Base64 encoded file
  cv_b64: z.string().optional()
})

export const PhysicianStep2Dto = z.object({
  id: z.string().uuid(),
  npi: z.string().regex(/^\d{10}$/, 'NPI must be 10 digits'),
  dea: z.string().regex(/^[A-Za-z]{2}\d{7}$/, 'DEA format: AA1234567').optional().nullable(),
  pecosActive: z.boolean().optional(),
  licenses: z.array(LicenseDto).min(1, 'At least one license required'),
  boards: z.array(BoardCertDto),
  malpractice: MalpracticeDto,
  uploads: UploadsDto
})

// Step 3: Practice Information
const AvailabilityDto = z.object({
  days: z.array(z.enum(['MON','TUE','WED','THU','FRI','SAT','SUN'])),
  hours: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/, 'Format: HH:MM-HH:MM')
})

const PracticeDto = z.object({
  specialty: z.string().min(1).max(200),
  subspecialty: z.string().max(200).optional(),
  yearsInPractice: z.number().int().min(0).max(70),
  languages: z.array(z.string().max(50)),
  timezone: z.string().max(50),
  availability: AvailabilityDto,
  volumePreference: z.enum(['LOW','MEDIUM','HIGH']).optional()
})

export const PhysicianStep3Dto = z.object({
  id: z.string().uuid(),
  practice: PracticeDto
})

// Step 4: E-Sign
export const PhysicianStep4Dto = z.object({
  id: z.string().uuid(),
  signature: z.string().min(2).max(200),
  agreements: z.array(z.enum(['TERMS','BAA','HIPAA','PRESCRIBING']))
})

// Email Verification
export const VerifyEmailDto = z.object({
  id: z.string().uuid(),
  code: z.string().length(6)
})

// Admin Actions
export const AdminOnboardingActionDto = z.object({
  id: z.string().uuid(),
  action: z.enum(['APPROVE','REJECT','REQUEST_INFO']),
  notes: z.string().max(1000).optional(),
  requestFields: z.array(z.string()).optional()
})

export type PhysicianStep1Input = z.infer<typeof PhysicianStep1Dto>
export type PhysicianStep2Input = z.infer<typeof PhysicianStep2Dto>
export type PhysicianStep3Input = z.infer<typeof PhysicianStep3Dto>
export type PhysicianStep4Input = z.infer<typeof PhysicianStep4Dto>
export type VerifyEmailInput = z.infer<typeof VerifyEmailDto>
export type AdminOnboardingActionInput = z.infer<typeof AdminOnboardingActionDto>
