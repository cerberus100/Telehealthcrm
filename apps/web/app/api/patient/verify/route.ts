import { NextRequest } from 'next/server'
import { withCORS, handleOptions } from '../../_lib/cors'
import { json, badRequest, internalError, audit } from '../../_lib/responses'
import { PatientVerifySchema } from '../../_lib/validation'
import { updateUserState, userIdFromContact } from '../../../lib/server/users'
import { serverLogger } from '../../../lib/server/logger'
import { ensureBootstrap } from '../../_lib/bootstrap'

export function OPTIONS(req: NextRequest) {
  return handleOptions(req)
}

export const POST = withCORS(async (req: NextRequest) => {
  await ensureBootstrap()

  try {
    const payload = await req.json()
    const parsed = PatientVerifySchema.safeParse(payload)
    if (!parsed.success) {
      return badRequest('Invalid payload', parsed.error.flatten())
    }

    const userId = userIdFromContact(parsed.data.contact)

    await updateUserState(userId, {
      patientState: 'ACTIVE',
    })

    await audit(undefined, {
      action: 'PATIENT_VERIFIED',
      target: userId,
      metadata: { method: 'code', code: parsed.data.code },
    })

    return json({ next: '/onboarding/patient' })
  } catch (error) {
    serverLogger.error('Patient verification failed', { error })
    return internalError()
  }
})
