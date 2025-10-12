import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { evaluatePolicy, type AccessRequest } from './policy'

export interface AbacRequirement {
  resource: 'Consult' | 'Rx' | 'LabOrder' | 'LabResult' | 'Shipment' | 'Patient' | 'User' | 'Auth' | 'Health' | 'Notification' | 'Organization' | 'VideoVisit'
  action: 'read' | 'write' | 'list' | 'update' | 'logout' | 'create'
}

export const ABAC_KEY = 'abac'
export const Abac = (req: AbacRequirement) => SetMetadata(ABAC_KEY, req)

@Injectable()
export class AbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requirement = this.reflector.get<AbacRequirement | undefined>(ABAC_KEY, context.getHandler())
    if (!requirement) return true

    const req = context.switchToHttp().getRequest()
    const claims = (req as any).claims
    const resourceOrgId: string | undefined = req.headers['x-resource-org-id'] as string | undefined

    const accessReq: AccessRequest = {
      subject: claims,
      resource: requirement.resource,
      action: requirement.action,
      resourceOrgId,
    }
    const decision = evaluatePolicy(accessReq)
    if (!decision.allow) {
      return false
    }
    if (decision.maskFields?.length) {
      ;(req as any).maskFields = decision.maskFields
    }
    return true
  }
}
