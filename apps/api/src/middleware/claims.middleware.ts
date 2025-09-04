import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common'
import type { FastifyRequest, FastifyReply } from 'fastify'
import type { RequestClaims } from '../types/claims'

@Injectable()
export class ClaimsMiddleware implements NestMiddleware<FastifyRequest, FastifyReply> {
  use(req: FastifyRequest, _res: FastifyReply, next: (err?: unknown) => void) {
    const auth = req.headers['authorization']
    
    if (!auth || !auth.startsWith('Bearer ')) {
      // For now, fall back to header-based auth for development
      const orgId = (req.headers['x-org-id'] as string | undefined) ?? ''
      const role = (req.headers['x-role'] as string | undefined) ?? 'SUPPORT'
      const purposeOfUse = req.headers['x-purpose'] as string | undefined
      const sub = (req.headers['x-user-id'] as string | undefined) ?? ''

      const claims: RequestClaims = { 
        orgId, 
        role: role as RequestClaims['role'], 
        purposeOfUse,
        sub
      }
      ;(req as any).claims = claims

      // These headers can be forwarded to the DB proxy to SET Postgres settings for RLS, if applicable.
      req.headers['x-rls-org-id'] = orgId
      if (purposeOfUse) req.headers['x-rls-purpose'] = purposeOfUse
      req.headers['x-rls-role'] = role

      next()
      return
    }

    // TODO: Replace with Cognito JWT validation
    // For now, parse mock tokens
    const token = auth.replace('Bearer ', '')
    
    if (token.startsWith('mock_access_')) {
      const tokenParts = token.split('_')
      if (tokenParts.length >= 3) {
        const userId = tokenParts[2]
        const orgId = (req.headers['x-org-id'] as string | undefined) ?? ''
        const role = (req.headers['x-role'] as string | undefined) ?? 'SUPPORT'
        const purposeOfUse = req.headers['x-purpose'] as string | undefined

        const claims: RequestClaims = { 
          orgId, 
          role: role as RequestClaims['role'], 
          purposeOfUse,
          sub: userId
        }
        ;(req as any).claims = claims

        // These headers can be forwarded to the DB proxy to SET Postgres settings for RLS, if applicable.
        req.headers['x-rls-org-id'] = orgId
        if (purposeOfUse) req.headers['x-rls-purpose'] = purposeOfUse
        req.headers['x-rls-role'] = role

        next()
        return
      }
    }

    throw new UnauthorizedException('Invalid authorization token')
  }
}
