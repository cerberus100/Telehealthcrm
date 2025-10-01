export const runtime = 'nodejs'

import { NextRequest } from 'next/server'
import { withCORS, handleOptions } from '@/app/api/_lib/cors'
import { json, badRequest, internalError, audit } from '@/app/api/_lib/responses'
import { PatientProvisionalSchema } from '@/app/api/_lib/validation'
import { putUser, userIdFromContact, PatientUserRecord } from '@/lib/server/users'
import { getEnv } from '@/lib/server/env'
import { serverLogger } from '@/lib/server/logger'
import { sendEmail } from '@/lib/server/ses'
import { ensureBootstrap } from '@/app/api/_lib/bootstrap'

export function OPTIONS(req: NextRequest) {
  return handleOptions(req)
}

export const POST = withCORS(async (req: NextRequest) => {
  await ensureBootstrap()

  try {
    const payload = await req.json()
    const parsed = PatientProvisionalSchema.safeParse(payload)
    if (!parsed.success) {
      return badRequest('Invalid payload', parsed.error.flatten())
    }

    const contact = parsed.data.email ?? parsed.data.phone
    if (!contact) {
      return badRequest('A contact email or phone is required')
    }
    const patientId = userIdFromContact(contact)
    const now = new Date().toISOString()

    await putUser(patientId, {
      role: 'PATIENT',
      patientState: 'PENDING_CONTACT_VERIFICATION',
      allowedStates: parsed.data.insurance.type ? [parsed.data.address.state] : [],
      contact: {
        email: parsed.data.email,
        phone: parsed.data.phone,
      },
      profile: {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        dob: parsed.data.dob,
        address: parsed.data.address,
        insurance: parsed.data.insurance,
        preferredContact: parsed.data.preferredContact,
        consent: parsed.data.consent,
        provisionalRequestedAt: now,
      },
    } as Omit<PatientUserRecord, 'pk' | 'sk' | 'createdAt' | 'updatedAt'>)

    await audit(undefined, {
      action: 'PATIENT_PROVISIONAL_SUBMITTED',
      target: patientId,
      metadata: { contact, preferredContact: parsed.data.preferredContact },
    })

    const env = getEnv()
    if (parsed.data.email && env.SES_SENDER) {
      await sendEmail({
        to: parsed.data.email,
        subject: 'Verify your telehealth account',
        html: `<p>Thanks for signing up! Your verification code is <strong>123456</strong>.</p>`,
      })
    }

    serverLogger.info('Patient provisional request stored', { patientId })

    return json({ requestId: patientId, contact }, 200)
  } catch (error) {
    serverLogger.error('Patient provisional failed', { error })
    return internalError()
  }
})
