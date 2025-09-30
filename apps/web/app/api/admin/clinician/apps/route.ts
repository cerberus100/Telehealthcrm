import { NextRequest } from 'next/server'
import { withCORS, handleOptions } from '../../../_lib/cors'
import { json, badRequest, internalError } from '../../../_lib/responses'
import { requireAuth, AuthError } from '../../../_lib/rbac'
import { listClinicianApplications, toListView, ClinicianAppStatus } from '../../../../lib/server/clinician-apps'
import { ensureBootstrap } from '../../../_lib/bootstrap'
import { serverLogger } from '../../../../lib/server/logger'

export const runtime = 'edge'

export function OPTIONS(req: NextRequest) {
  return handleOptions(req)
}

const allowedRoles = ['ADMIN']

export const GET = withCORS(async (req: NextRequest) => {
  await ensureBootstrap()

  try {
    const statusParam = req.nextUrl.searchParams.get('status') as ClinicianAppStatus | null
    const status = statusParam ?? 'SUBMITTED'
    if (!['SUBMITTED', 'UNDER_REVIEW'].includes(status)) {
      return badRequest('Invalid status filter')
    }

    const { claims } = await requireAuth(req, allowedRoles)

    const items = await listClinicianApplications(status)
    const view = items.map(toListView)

    return json({ items: view })
  } catch (error) {
    if (error instanceof AuthError) {
      return json({ error: error.message }, { status: error.status })
    }
    serverLogger.error('Admin clinician list failed', { error })
    return internalError()
  }
})
