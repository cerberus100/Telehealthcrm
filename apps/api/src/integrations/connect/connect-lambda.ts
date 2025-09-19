import { PrismaClient } from '@prisma/client'

// Amazon Connect Lambda Handler Types
export interface ConnectContactFlowEvent {
  Details: {
    ContactData: {
      CustomerEndpoint: { Address: string } // ANI (caller number)
      SystemEndpoint: { Address: string }   // DNIS (our number)
      ContactId: string
      InitialContactId: string
      PreviousContactId?: string
    }
    Parameters?: Record<string, string>
  }
}

export interface ConnectContactFlowResult {
  consultId?: string
  patientId?: string
  serviceMode?: string
  clientId?: string
  marketerOrgId?: string
  action?: string
  error?: string
}

const prisma = new PrismaClient()

// Phone normalization utility
export function normalizePhone(phone: string): string | null {
  if (!phone) return null
  // Strip all non-digits, then add +1 if US number
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

export function getPhoneDigits(e164: string): { digits10: string; digits7: string } {
  const digits = e164.replace(/\D/g, '')
  return {
    digits10: digits.slice(-10),
    digits7: digits.slice(-7)
  }
}

// Find recent consult by ANI and intake link
export async function findRecentConsult(params: {
  ani: string
  intakeLink?: any
  windowHrs: number
}): Promise<any | null> {
  const { ani, windowHrs } = params
  const since = new Date(Date.now() - windowHrs * 60 * 60 * 1000)
  
  // Look for recent consult where patient has this phone number
  const consult = await prisma.consult.findFirst({
    where: {
      createdAt: { gte: since },
      status: { in: ['PENDING', 'PASSED', 'APPROVED'] },
      patient: {
        phones: { hasSome: [ani] }
      }
    },
    include: { patient: true },
    orderBy: { createdAt: 'desc' }
  })
  
  return consult
}

// Find recent intake submission by ANI
export async function findRecentIntake(params: {
  ani: string
  intakeLink?: any
  windowHrs: number
}): Promise<any | null> {
  const { ani, intakeLink, windowHrs } = params
  const since = new Date(Date.now() - windowHrs * 60 * 60 * 1000)
  
  if (!intakeLink) return null
  
  const submission = await (prisma as any).intakeSubmission?.findFirst({
    where: {
      intakeLinkId: intakeLink.id,
      createdAt: { gte: since },
      patientStub: {
        path: ['phone'],
        equals: ani
      }
    },
    orderBy: { createdAt: 'desc' }
  })
  
  return submission
}

// Create or update patient and consult from intake
export async function upsertPatientConsult(params: {
  ani: string
  intake?: any
  intakeLink?: any
}): Promise<any> {
  const { ani, intake, intakeLink } = params
  
  // Create minimal patient stub
  const patientData = intake?.patientStub || {
    name: 'Unknown Caller',
    phone: ani,
    state: 'UNKNOWN'
  }
  
  const patient = await (prisma as any).patient?.create({
    data: {
      orgId: intakeLink?.marketerOrgId || 'unknown-org',
      tenantUid: `phone_${ani}`,
      legalName: patientData.name,
      dob: new Date('1990-01-01'), // Default DOB for phone-only patients
      phones: [ani],
      address: patientData.address || {},
      org: { connect: { id: intakeLink?.marketerOrgId || 'unknown-org' } }
    }
  })
  
  const consult = await (prisma as any).consult?.create({
    data: {
      patientId: patient.id,
      orgId: patient.orgId,
      marketerOrgId: intakeLink?.marketerOrgId,
      status: 'PENDING',
      reasonCodes: [],
      createdFrom: 'CALL'
    }
  })
  
  // Update call lookup cache
  await (prisma as any).callLookupIndex?.upsert({
    where: { e164: ani },
    create: {
      e164: ani,
      lastSeenAt: new Date(),
      orgId: patient.orgId,
      patientId: patient.id,
      lastConsultId: consult.id
    },
    update: {
      lastSeenAt: new Date(),
      lastConsultId: consult.id
    }
  })
  
  return {
    consultId: consult.id,
    patientId: patient.id,
    serviceMode: intakeLink?.services || 'BOTH',
    clientId: intakeLink?.clientIds?.[0] || null,
    marketerOrgId: intakeLink?.marketerOrgId || null
  }
}

// Find intake link by DID number
export async function findIntakeLinkByDid(dnis: string): Promise<any | null> {
  if (!dnis) return null
  
  const link = await (prisma as any).intakeLink?.findFirst({
    where: {
      didNumber: dnis,
      active: true
    }
  })
  
  return link
}

// Main Lambda handler for Amazon Connect
export const handler = async (event: ConnectContactFlowEvent): Promise<ConnectContactFlowResult> => {
  try {
    const ani = normalizePhone(event.Details?.ContactData?.CustomerEndpoint?.Address)
    const dnis = event.Details?.ContactData?.SystemEndpoint?.Address
    const contactId = event.Details?.ContactData?.ContactId
    
    if (!ani) {
      return { action: 'no_ani', error: 'No caller ID available' }
    }
    
    // Find intake link by DID
    const intakeLink = await findIntakeLinkByDid(dnis)
    
    // Look for recent consult
    const consult = await findRecentConsult({ ani, intakeLink, windowHrs: 24 })
    
    let target: any
    if (consult) {
      target = {
        consultId: consult.id,
        patientId: consult.patientId,
        serviceMode: intakeLink?.services || 'BOTH',
        clientId: intakeLink?.clientIds?.[0] || null,
        marketerOrgId: intakeLink?.marketerOrgId || null
      }
    } else {
      // Look for recent intake submission
      const intake = await findRecentIntake({ ani, intakeLink, windowHrs: 24 })
      target = await upsertPatientConsult({ ani, intake, intakeLink })
    }
    
    // Log the inbound call
    await (prisma as any).inboundCall?.create({
      data: {
        contactId,
        dnis: dnis || '',
        ani,
        marketerOrgId: target.marketerOrgId,
        clientId: target.clientId,
        consultId: target.consultId,
        startedAt: new Date()
      }
    })
    
    return target
  } catch (error) {
    console.error('Connect Lambda error:', error)
    return { action: 'error', error: (error as Error).message }
  } finally {
    await prisma.$disconnect()
  }
}
