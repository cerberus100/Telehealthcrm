import { Injectable, NestMiddleware } from '@nestjs/common'
import type { FastifyRequest, FastifyReply } from 'fastify'
import type { RequestClaims } from '../types/claims'

@Injectable()
export class ClaimsMiddleware implements NestMiddleware<FastifyRequest, FastifyReply> {
  use(req: FastifyRequest, _res: FastifyReply, next: (err?: unknown) => void) {
    const auth = req.headers['authorization']
    // TODO: Replace with Cognito JWT validation. For now, accept x-org-id, x-role, x-purpose headers.
    const orgId = (req.headers['x-org-id'] as string | undefined) ?? ''
    const role = (req.headers['x-role'] as string | undefined) ?? 'SUPPORT'
    const purposeOfUse = req.headers['x-purpose'] as string | undefined

    const claims: RequestClaims = { orgId, role: role as RequestClaims['role'], purposeOfUse }
    ;(req as any).claims = claims

    // These headers can be forwarded to the DB proxy to SET Postgres settings for RLS, if applicable.
    req.headers['x-rls-org-id'] = orgId
    if (purposeOfUse) req.headers['x-rls-purpose'] = purposeOfUse
    req.headers['x-rls-role'] = role

    next()
  }
}
