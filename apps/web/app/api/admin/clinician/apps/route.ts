export const runtime = 'nodejs'

import { NextRequest } from 'next/server'
import { withCORS, handleOptions } from '@/app/api/_lib/cors'
import { json, badRequest, internalError } from '@/app/api/_lib/responses'
import { requireAuth, AuthError, Role } from '@/app/api/_lib/rbac'
import { listClinicianApplications, toListView, ClinicianAppStatus } from '@/lib/server/clinician-apps'
import { ensureBootstrap } from '@/app/api/_lib/bootstrap'
import { serverLogger } from '@/lib/server/logger'

export function OPTIONS(req: NextRequest) {
  return handleOptions(req)
}

const allowedRoles: Role[] = ['ADMIN']

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
