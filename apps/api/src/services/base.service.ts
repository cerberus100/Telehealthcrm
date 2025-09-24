import { Injectable, Inject } from '@nestjs/common'
import { PrismaService, TenantContext } from '../prisma.service'
import { logger } from '../utils/logger'

export interface TenantAwareOperation<T> {
  (tenantContext: TenantContext): Promise<T>
}

/**
 * Base service class that provides tenant-aware operations
 * All services should extend this to ensure consistent tenant handling
 */
@Injectable()
export abstract class BaseService {
  constructor(@Inject(PrismaService) protected readonly prisma: PrismaService) {}

  /**
   * Execute an operation with tenant context
   * Ensures the user has access to the specified organization
   */
  protected async withTenant<T>(
    orgId: string,
    operation: TenantAwareOperation<T>
  ): Promise<T> {
    try {
      return await this.prisma.executeWithTenant(orgId, operation)
    } catch (error) {
      logger.error({
        msg: `Error executing tenant-aware operation for org ${orgId}`,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  /**
   * Validate that an organization exists and is accessible
   */
  protected async validateOrganizationAccess(orgId: string): Promise<boolean> {
    try {
      return await this.prisma.validateOrganization(orgId)
    } catch (error) {
      logger.error({
        msg: `Error validating organization access for ${orgId}`,
        error: error instanceof Error ? error.message : String(error)
      })
      return false
    }
  }

  /**
   * Get user with organization validation
   */
  protected async getUserWithOrgContext(userId: string, orgId?: string) {
    try {
      return await this.prisma.getUserWithOrg(userId, orgId)
    } catch (error) {
      logger.error({
        msg: `Error getting user ${userId} with org context`,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  /**
   * Get organization-scoped Prisma query
   * Use this for direct database operations that need tenant isolation
   */
  protected getOrgScopedQuery(orgId: string, entityName: string) {
    return this.prisma.getOrgScopedQuery(orgId, entityName)
  }

  /**
   * Log service operation with tenant context
   */
  protected logOperation(
    action: string,
    orgId: string,
    details?: any,
    level: 'info' | 'warn' | 'error' = 'info'
  ) {
    const logData = {
      service: this.constructor.name,
      action,
      orgId,
      ...details,
    }

    switch (level) {
      case 'warn':
        logger.warn(logData)
        break
      case 'error':
        logger.error(logData)
        break
      default:
        logger.info(logData)
    }
  }

  /**
   * Create cursor-based paginated response
   * @param items - Array of items to return
   * @param limit - Maximum number of items per page
   * @param getCursor - Function to extract cursor from an item
   * @returns Standardized paginated response
   */
  protected createPaginatedResponse<T>(
    items: T[],
    limit: number,
    getCursor: (item: T) => string
  ): { items: T[]; next_cursor?: string } {
    const hasNext = items.length > limit
    const returnItems = items.slice(0, limit)
    const lastItem = returnItems[returnItems.length - 1]
    const nextCursor = hasNext && lastItem !== undefined
      ? getCursor(lastItem)
      : undefined

    return {
      items: returnItems,
      next_cursor: nextCursor,
    }
  }

  /**
   * Create empty paginated response
   * @returns Standardized empty paginated response
   */
  protected createEmptyPaginatedResponse<T>(): { items: T[]; next_cursor?: string } {
    return {
      items: [],
      next_cursor: undefined,
    }
  }
}
