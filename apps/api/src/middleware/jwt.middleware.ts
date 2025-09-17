import { Injectable, NestMiddleware, UnauthorizedException, ForbiddenException, Inject, forwardRef } from '@nestjs/common'
import type { FastifyRequest, FastifyReply } from 'fastify'
import { CognitoService, CognitoUser } from '../auth/cognito.service'
import { logger } from '../utils/logger'

export interface AuthenticatedRequest extends FastifyRequest {
  user: CognitoUser
  claims: {
    orgId: string
    role: string
    purposeOfUse?: string
    sub: string
  }
}

@Injectable()
export class JwtMiddleware implements NestMiddleware<FastifyRequest, FastifyReply> {
  constructor(
    @Inject(forwardRef(() => CognitoService))
    private readonly cognitoService: CognitoService
  ) {}

  async use(req: FastifyRequest, _res: FastifyReply, next: (err?: unknown) => void) {
    try {
      const auth = req.headers['authorization']
      
      if (!auth || !auth.startsWith('Bearer ')) {
        // For development, allow header-based auth as fallback
        if (process.env.NODE_ENV === 'development') {
          const orgId = (req.headers['x-org-id'] as string | undefined) ?? ''
          const role = (req.headers['x-role'] as string | undefined) ?? 'SUPPORT'
          const purposeOfUse = req.headers['x-purpose'] as string | undefined
          const sub = (req.headers['x-user-id'] as string | undefined) ?? ''

          const claims = {
            orgId,
            role: role as string,
            purposeOfUse,
            sub
          }
          
          ;(req as any).claims = claims
          ;(req as any).user = {
            sub,
            email: 'dev@example.com',
            email_verified: true,
            org_id: orgId,
            role,
            purpose_of_use: purposeOfUse,
            groups: [role],
            mfa_enabled: false,
            last_login_at: new Date().toISOString(),
          }

          // Set RLS headers for database
          req.headers['x-rls-org-id'] = orgId
          if (purposeOfUse) req.headers['x-rls-purpose'] = purposeOfUse
          req.headers['x-rls-role'] = role

          logger.info({
            action: 'DEV_AUTH_FALLBACK',
            org_id: orgId,
            role,
            user_id: sub,
          })

          next()
          return
        }

        throw new UnauthorizedException('Authorization header required')
      }

      // Extract and validate JWT token
      const token = auth.replace('Bearer ', '')
      const user = await this.cognitoService.validateToken(token)

      // Convert to claims format for backward compatibility
      const claims = {
        orgId: user.org_id,
        role: user.role,
        purposeOfUse: user.purpose_of_use,
        sub: user.sub,
      }

      // Attach user and claims to request
      ;(req as any).user = user
      ;(req as any).claims = claims

      // Set RLS headers for database
      req.headers['x-rls-org-id'] = user.org_id
      if (user.purpose_of_use) req.headers['x-rls-purpose'] = user.purpose_of_use
      req.headers['x-rls-role'] = user.role

      // Log successful authentication
      logger.info({
        action: 'JWT_AUTH_SUCCESS',
        user_id: user.sub,
        org_id: user.org_id,
        role: user.role,
        groups: user.groups,
      })

      next()
    } catch (error) {
      logger.warn({
        action: 'JWT_AUTH_FAILED',
        error: (error as Error).message,
        headers: {
          has_auth: !!req.headers['authorization'],
          has_org_id: !!req.headers['x-org-id'],
          has_role: !!req.headers['x-role'],
        },
      })

      if (error instanceof UnauthorizedException) {
        throw error
      }

      throw new UnauthorizedException('Authentication failed')
    }
  }
}
