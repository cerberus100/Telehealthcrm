export const runtime = 'nodejs'

import { NextRequest } from 'next/server'
import { withCORS, handleOptions } from '@/app/api/_lib/cors'
import { json, badRequest, internalError, audit } from '@/app/api/_lib/responses'
import { ClinicianStatusUpdateSchema } from '@/app/api/_lib/validation'
import { requireAuth, AuthError, Role } from '@/app/api/_lib/rbac'
import { getClinicianApplication, updateClinicianApplicationStatus } from '@/lib/server/clinician-apps'
import { upsertClinicianUser, userIdFromContact, ClinicianUserUpsertInput } from '@/lib/server/users'
import { sendEmail } from '@/lib/server/ses'
import { ensureBootstrap } from '@/app/api/_lib/bootstrap'
import { serverLogger } from '@/lib/server/logger'

export function OPTIONS(req: NextRequest) {
  return handleOptions(req)
}

const allowedRoles: Role[] = ['ADMIN']

export const POST = withCORS(async (req: NextRequest, context: Record<string, unknown>) => {
  const { params } = context as { params: { appId: string } }
  await ensureBootstrap()

  try {
    const { claims } = await requireAuth(req, allowedRoles)

    const payload = await req.json()
    const parsed = ClinicianStatusUpdateSchema.safeParse(payload)
    if (!parsed.success) {
      return badRequest('Invalid payload', parsed.error.flatten())
    }

    const application = await getClinicianApplication(params.appId)
    if (!application) {
      return badRequest('Application not found')
    }

    await updateClinicianApplicationStatus(params.appId, parsed.data.action, claims.sub, parsed.data.notes)

    if (parsed.data.action === 'APPROVED') {
      const clinicianId = userIdFromContact(application.identity.email)
      const upsertPayload: ClinicianUserUpsertInput = {
        id: clinicianId,
        allowedStates: application.derived.allowedStates,
        contact: { email: application.identity.email, phone: application.identity.phone },
        profile: {
          fullName: application.identity.fullName,
          npi: application.identity.npi,
          licenses: application.licenses,
          flags: application.flags,
        },
        clinicianState: 'ACTIVE',
      }
      await upsertClinicianUser(upsertPayload)
      await sendEmail({
        to: application.identity.email,
        subject: 'Your clinician application has been approved',
        html: `<p>Hello ${application.identity.fullName},</p><p>Your application has been approved. You may now sign in to the clinician portal.</p>`,
      })

      await audit(claims, {
        action: 'INVITE_SENT',
        target: clinicianId,
        metadata: {
          appId: params.appId,
          email: application.identity.email,
        },
      })
    }

    await audit(claims, {
      action: 'CLINICIAN_STATUS_CHANGED',
      target: params.appId,
      metadata: {
        status: parsed.data.action,
        notes: parsed.data.notes,
      },
    })

    return json({ ok: true })
  } catch (error) {
    if (error instanceof AuthError) {
      return json({ error: error.message }, { status: error.status })
    }
    serverLogger.error('Admin clinician status update failed', { error })
    return internalError()
  }
})
