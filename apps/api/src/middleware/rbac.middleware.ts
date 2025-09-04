import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common'
import type { FastifyRequest, FastifyReply } from 'fastify'
import { CognitoService, CognitoUser } from '../auth/cognito.service'
import { logger } from '../utils/logger'

export interface RbacRequest extends FastifyRequest {
  user: CognitoUser
  claims: {
    orgId: string
    role: string
    purposeOfUse?: string
    sub: string
  }
}

export interface AccessControl {
  resource: string
  action: string
  requiredRoles?: string[]
  requirePurposeOfUse?: boolean
  allowCrossOrg?: boolean
}

@Injectable()
export class RbacMiddleware implements NestMiddleware<FastifyRequest, FastifyReply> {
  constructor(private cognitoService: CognitoService) {}

  async use(req: RbacRequest, _res: FastifyReply, next: (err?: unknown) => void) {
    try {
      const user = req.user
      if (!user) {
        throw new ForbiddenException('User not authenticated')
      }

      // Extract resource and action from route
      const resource = this.extractResource(req.url)
      const actionType = this.extractAction(req.method)

      // Define access control rules
      const accessControl = this.getAccessControl(resource, actionType)

      // Check role-based access
      if (accessControl.requiredRoles && !this.cognitoService.hasAnyRole(user, accessControl.requiredRoles)) {
        logger.warn({
          action: 'RBAC_ACCESS_DENIED',
          user_id: user.sub,
          org_id: user.org_id,
          role: user.role,
          resource,
          action_type: actionType,
          required_roles: accessControl.requiredRoles,
        })
        throw new ForbiddenException('Insufficient permissions')
      }

      // Check purpose of use for PHI access
      if (accessControl.requirePurposeOfUse && !user.purpose_of_use) {
        logger.warn({
          action: 'PURPOSE_OF_USE_REQUIRED',
          user_id: user.sub,
          org_id: user.org_id,
          role: user.role,
          resource,
          action_type: actionType,
        })
        throw new ForbiddenException('Purpose of use required for this operation')
      }

      // Enforce org scoping (unless explicitly allowed to cross orgs)
      if (!accessControl.allowCrossOrg) {
        this.enforceOrgScoping(req, user)
      }

      // Log successful authorization
      logger.info({
        action: 'RBAC_ACCESS_GRANTED',
        user_id: user.sub,
        org_id: user.org_id,
        role: user.role,
        resource,
        action_type: actionType,
        purpose_of_use: user.purpose_of_use,
      })

      next()
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error
      }

      logger.error({
        action: 'RBAC_MIDDLEWARE_ERROR',
        error: (error as Error).message,
        user_id: req.user?.sub,
      })

      throw new ForbiddenException('Authorization failed')
    }
  }

  /**
   * Extract resource from URL path
   */
  private extractResource(url: string): string {
    const path = url.split('?')[0] || ''
    const segments = path.split('/').filter(Boolean)
    
    if (segments.length === 0) return 'root'
    
    // Map URL patterns to resources
    if (segments[0] === 'auth') return 'Auth'
    if (segments[0] === 'health') return 'Health'
    if (segments[0] === 'consults') return 'Consult'
    if (segments[0] === 'shipments') return 'Shipment'
    if (segments[0] === 'rx') return 'Rx'
    if (segments[0] === 'notifications') return 'Notification'
    if (segments[0] === 'admin') {
      if (segments[1] === 'users') return 'User'
      if (segments[1] === 'orgs') return 'Organization'
      return 'Admin'
    }
    
    return segments[0] ? segments[0].charAt(0).toUpperCase() + segments[0].slice(1) : 'root'
  }

  /**
   * Extract action from HTTP method
   */
  private extractAction(method: string): string {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'read'
      case 'POST':
        return 'create'
      case 'PUT':
      case 'PATCH':
        return 'update'
      case 'DELETE':
        return 'delete'
      default:
        return 'read'
    }
  }

  /**
   * Get access control rules for resource/action combination
   */
  private getAccessControl(resource: string, action: string): AccessControl {
    const rules: Record<string, AccessControl> = {
      // Auth endpoints
      'Auth': {
        resource: 'Auth',
        action,
        requiredRoles: ['SUPER_ADMIN', 'MARKETER_ADMIN', 'MARKETER', 'DOCTOR', 'PHARMACIST', 'LAB_TECH'],
      },

      // Health endpoints
      'Health': {
        resource: 'Health',
        action,
        requiredRoles: ['SUPER_ADMIN', 'MARKETER_ADMIN', 'MARKETER', 'DOCTOR', 'PHARMACIST', 'LAB_TECH'],
      },

      // Consult endpoints
      'Consult': {
        resource: 'Consult',
        action,
        requiredRoles: ['SUPER_ADMIN', 'MARKETER_ADMIN', 'MARKETER', 'DOCTOR'],
        requirePurposeOfUse: action === 'read' || action === 'update',
      },

      // Shipment endpoints
      'Shipment': {
        resource: 'Shipment',
        action,
        requiredRoles: ['SUPER_ADMIN', 'MARKETER_ADMIN', 'MARKETER'],
      },

      // Rx endpoints (provider/pharmacy only)
      'Rx': {
        resource: 'Rx',
        action,
        requiredRoles: ['SUPER_ADMIN', 'DOCTOR', 'PHARMACIST'],
        requirePurposeOfUse: true,
      },

      // Notification endpoints
      'Notification': {
        resource: 'Notification',
        action,
        requiredRoles: ['SUPER_ADMIN', 'MARKETER_ADMIN', 'MARKETER', 'DOCTOR', 'PHARMACIST', 'LAB_TECH'],
      },

      // Admin endpoints
      'User': {
        resource: 'User',
        action,
        requiredRoles: ['SUPER_ADMIN', 'MARKETER_ADMIN'],
        allowCrossOrg: resource === 'User' && action === 'read' && ['SUPER_ADMIN'].includes('SUPER_ADMIN'),
      },

      'Organization': {
        resource: 'Organization',
        action,
        requiredRoles: ['SUPER_ADMIN'],
        allowCrossOrg: true,
      },

      'Admin': {
        resource: 'Admin',
        action,
        requiredRoles: ['SUPER_ADMIN'],
        allowCrossOrg: true,
      },
    }

    return rules[resource] || {
      resource,
      action,
      requiredRoles: ['SUPER_ADMIN'],
    }
  }

  /**
   * Enforce organization scoping on requests
   */
  private enforceOrgScoping(req: RbacRequest, user: CognitoUser): void {
    // For GET requests, ensure org_id is set from user claims
    if (req.method === 'GET') {
      const query = req.query as any
      if (query.org_id && query.org_id !== user.org_id && !this.cognitoService.isSuperAdmin(user)) {
        logger.warn({
          action: 'CROSS_ORG_ACCESS_ATTEMPT',
          user_id: user.sub,
          user_org_id: user.org_id,
          requested_org_id: query.org_id,
          resource: this.extractResource(req.url),
        })
        throw new ForbiddenException('Cross-organization access not allowed')
      }
    }

    // For POST/PUT/PATCH requests, ensure org_id is set from user claims
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const body = req.body as any
      if (body.org_id && body.org_id !== user.org_id && !this.cognitoService.isSuperAdmin(user)) {
        logger.warn({
          action: 'CROSS_ORG_MODIFICATION_ATTEMPT',
          user_id: user.sub,
          user_org_id: user.org_id,
          requested_org_id: body.org_id,
          resource: this.extractResource(req.url),
        })
        throw new ForbiddenException('Cross-organization modification not allowed')
      }
    }
  }

  /**
   * Check if user has minimum necessary access for PHI
   */
  private checkMinimumNecessary(user: CognitoUser, resource: string, action: string): boolean {
    // MARKETER role restrictions
    if (user.role === 'MARKETER') {
      // Marketers cannot access Rx or LabResult bodies
      if (resource === 'Rx' && action === 'read') {
        return false
      }
      if (resource === 'LabResult' && action === 'read') {
        return false
      }
    }

    // PHARMACIST role restrictions
    if (user.role === 'PHARMACIST') {
      // Pharmacists cannot access LabResults
      if (resource === 'LabResult' && action === 'read') {
        return false
      }
    }

    // LAB_TECH role restrictions
    if (user.role === 'LAB_TECH') {
      // Lab techs cannot access Rx
      if (resource === 'Rx' && action === 'read') {
        return false
      }
    }

    return true
  }
}
