import { NextRequest } from 'next/server'
import { withCORS, handleOptions } from '../../_lib/cors'
import { json, badRequest, internalError, audit } from '../../_lib/responses'
import { ClinicianApplySchema } from '../../_lib/validation'
import { putClinicianApplication } from '../../../lib/server/clinician-apps'
import { ensureBootstrap } from '../../_lib/bootstrap'
import { serverLogger } from '../../../lib/server/logger'

export const runtime = 'edge'

export function OPTIONS(req: NextRequest) {
  return handleOptions(req)
}

export const POST = withCORS(async (req: NextRequest) => {
  await ensureBootstrap()

  try {
    const payload = await req.json()
    const parsed = ClinicianApplySchema.safeParse(payload)
    if (!parsed.success) {
      return badRequest('Invalid payload', parsed.error.flatten())
    }

    const application = await putClinicianApplication({
      identity: parsed.data.identity,
      licenses: parsed.data.licenses,
      documents: parsed.data.documents,
      flags: parsed.data.flags,
    })

    await audit(undefined, {
      action: 'CLINICIAN_APPLY_SUBMITTED',
      target: application.appId,
      metadata: {
        npi: application.identity.npi,
        states: application.derived.allowedStates,
      },
    })

    serverLogger.info('Clinician application submitted', { appId: application.appId })

    return json({ appId: application.appId })
  } catch (error) {
    serverLogger.error('Clinician apply failed', { error })
    return internalError()
  }
})


