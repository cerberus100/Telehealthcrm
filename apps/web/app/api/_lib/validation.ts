import { z } from 'zod'

export const PatientProvisionalSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dob: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().min(10).optional(),
  address: z.object({
    address1: z.string().min(1),
    address2: z.string().optional(),
    city: z.string().min(1),
    state: z.string().length(2),
    postalCode: z.string().min(5),
  }),
  insurance: z.object({
    hasInsurance: z.boolean(),
    type: z.enum(['Medicare', 'Medicaid', 'Commercial']).optional(),
    medicare: z.object({
      type: z.enum(['A/B', 'Advantage']).optional(),
      id: z.string().optional(),
      advantageCarrier: z.string().optional(),
      advantagePlanName: z.string().optional(),
    }).optional(),
    medicaid: z.object({
      state: z.string().optional(),
      id: z.string().optional(),
    }).optional(),
    commercial: z.object({
      carrier: z.string().optional(),
      planName: z.string().optional(),
      memberId: z.string().optional(),
      groupId: z.string().optional(),
    }).optional(),
  }),
  preferredContact: z.enum(['Email', 'SMS']),
  consent: z.literal(true),
})

export const PatientVerifySchema = z.object({
  contact: z.string().min(1),
  code: z.string().min(4),
})

export const ClinicianApplySchema = z.object({
  identity: z.object({
    fullName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().min(10),
    npi: z.string().min(1),
  }),
  licenses: z.array(z.object({
    state: z.string().length(2),
    licenseNumber: z.string().min(1),
    expirationDate: z.string().min(1),
    docKey: z.string().optional(),
  })).min(1),
  documents: z.object({
    malpracticeKey: z.string().optional(),
    deaKey: z.string().optional(),
    extras: z.array(z.string()).optional(),
  }).optional(),
  flags: z.object({
    pecosEnrolled: z.boolean(),
    modalities: z.array(z.string()).min(1),
    specialties: z.array(z.string()).min(1),
    dea: z.object({
      number: z.string().min(1),
      state: z.string().length(2),
    }).optional(),
  }),
})

export const ClinicianStatusUpdateSchema = z.object({
  action: z.enum(['UNDER_REVIEW', 'APPROVED', 'DENIED']),
  notes: z.string().optional(),
})

export const PresignUploadSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
})


