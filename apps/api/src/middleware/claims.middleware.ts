import { Injectable, NestMiddleware, UnauthorizedException, Inject, forwardRef } from '@nestjs/common'
import type { FastifyRequest, FastifyReply } from 'fastify'
import type { RequestClaims } from '../types/claims'
import { CognitoService } from '../auth/cognito.service'
import { logger } from '../utils/logger'
import { bootstrapServiceLocator } from '../utils/service-locator'

@Injectable()
export class ClaimsMiddleware implements NestMiddleware<FastifyRequest, FastifyReply> {
  constructor(
    @Inject(forwardRef(() => CognitoService))
    private readonly cognitoService: CognitoService
  ) {}

  async use(req: FastifyRequest, _res: FastifyReply, next: (err?: unknown) => void) {
    try {
      const auth = req.headers['authorization']

      if (!auth || !auth.startsWith('Bearer ')) {
        // Only allow missing auth for specific public routes in development
        const publicRoutes = ['health', 'auth/login', 'auth/refresh', 'auth/logout', 'auth/verify-email']
        const isPublicRoute = publicRoutes.some(route => req.routeOptions.url?.includes(route))

        if (process.env.NODE_ENV === 'development' && isPublicRoute) {
          // Set default claims for public routes in development
          const claims: RequestClaims = {
            orgId: 'demo-org',
            role: 'SUPPORT',
            purposeOfUse: undefined,
            sub: 'anonymous'
          }
          ;(req as any).claims = claims
          req.headers['x-rls-org-id'] = claims.orgId
          next()
          return
        }

        logger.warn({
          action: 'MISSING_AUTH_HEADER',
          path: req.routeOptions.url,
          method: req.method,
        })
        throw new UnauthorizedException('Authorization header required')
      }

      // Validate JWT token
      const token = auth.replace('Bearer ', '')
      const user = await this.cognitoService.validateToken(token)

      // Convert to claims format
      const claims: RequestClaims = {
        orgId: user.org_id,
        role: user.role as RequestClaims['role'],
        purposeOfUse: user.purpose_of_use,
        sub: user.sub
      }

      // Attach claims to request
      ;(req as any).claims = claims
      ;(req as any).user = user

      // Set RLS headers for database
      req.headers['x-rls-org-id'] = user.org_id
      if (user.purpose_of_use) req.headers['x-rls-purpose'] = user.purpose_of_use
      req.headers['x-rls-role'] = user.role

      logger.info({
        action: 'CLAIMS_EXTRACTED',
        user_id: user.sub,
        org_id: user.org_id,
        role: user.role,
        path: req.routeOptions.url,
        method: req.method,
      })

      next()
    } catch (error) {
      logger.warn({
        action: 'CLAIMS_EXTRACTION_FAILED',
        error: (error as Error).message,
        path: req.routeOptions.url,
        method: req.method,
        headers: {
          has_auth: !!req.headers['authorization'],
        }
      })
      throw error
    }
  }
}
