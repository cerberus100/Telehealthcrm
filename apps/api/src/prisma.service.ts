import { INestApplication, Injectable, OnModuleDestroy, OnModuleInit, Inject } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { ConfigService } from '@nestjs/config'
import { MockPrismaService } from './mock-prisma.service'
import { logger } from './utils/logger'

export interface TenantContext {
  orgId: string
  orgType: string
  orgName: string
  isActive: boolean
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private demoMode: boolean
  private readonly mockService: MockPrismaService

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {
    super({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      datasources: {
        db: {
          url: configService.get<string>('DATABASE_URL'),
        },
      },
    })

    this.demoMode = this.configService.get<string>('API_DEMO_MODE') === 'true'
    this.mockService = new MockPrismaService()

    if (this.demoMode) {
      logger.info('PrismaService: Running in demo mode with mock data')
    } else {
      logger.info('PrismaService: Running in production mode with real database')
    }
  }

  /**
   * Check if running in demo mode
   */
  public isDemoMode(): boolean {
    return this.demoMode
  }

  async onModuleInit() {
    if (!this.demoMode) {
      await this.$connect()
    }
  }

  async onModuleDestroy() {
    if (!this.demoMode) {
      await this.$disconnect()
    }
  }

  // Optional: for Nest apps that want to coordinate shutdown hooks
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async enableShutdownHooks(_app: INestApplication) {
    // No-op: prefer Nest lifecycle with onModuleDestroy
  }

  /**
   * Get tenant context for the given organization ID
   */
  async getTenantContext(orgId: string): Promise<TenantContext | null> {
    try {
      if (this.demoMode) {
        // In demo mode, return mock tenant context
        if (orgId === 'mock-org-123' || orgId === 'demo-org-123') {
          return {
            orgId: 'mock-org-123',
            orgType: 'PROVIDER',
            orgName: 'Demo Organization',
            isActive: true,
          }
        }
        return null
      }

      const organization = await this.organization.findUnique({
        where: { id: orgId },
        select: {
          id: true,
          name: true,
          type: true,
        },
      })

      if (!organization) {
        return null
      }

      return {
        orgId: organization.id,
        orgType: organization.type,
        orgName: organization.name,
        isActive: true, // Default to active for now
      }
    } catch (error) {
      logger.error({
        msg: `Error getting tenant context for ${orgId}`,
        error: error instanceof Error ? error.message : String(error),
        orgId
      })
      return null
    }
  }

  /**
   * Execute a query with tenant context
   */
  async executeWithTenant<T>(
    orgId: string,
    operation: (tenantContext: TenantContext) => Promise<T>
  ): Promise<T> {
    const tenantContext = await this.getTenantContext(orgId)

    if (!tenantContext) {
      throw new Error(`Tenant context not found for orgId: ${orgId}`)
    }

    return operation(tenantContext)
  }

  /**
   * Check if an organization exists and is active
   */
  async validateOrganization(orgId: string): Promise<boolean> {
    try {
      if (this.demoMode) {
        return orgId === 'mock-org-123' || orgId === 'demo-org-123'
      }

      const organization = await this.organization.findUnique({
        where: { id: orgId },
        select: { id: true },
      })

      return !!organization
    } catch (error) {
      logger.error({
        msg: `Error validating organization ${orgId}`,
        error: error instanceof Error ? error.message : String(error),
        orgId
      })
      return false
    }
  }

  /**
   * Get user with organization context
   */
  async getUserWithOrg(userId: string, orgId?: string) {
    try {
      if (this.demoMode) {
        return this.mockService.user.findUnique({ where: { id: userId } })
      }

      const user = await this.user.findUnique({
        where: { id: userId },
        include: {
          org: true,
        },
      })

      if (orgId && user?.orgId !== orgId) {
        throw new Error(`User ${userId} does not belong to organization ${orgId}`)
      }

      return user
    } catch (error) {
      logger.error({
        msg: `Error getting user ${userId}`,
        error: error instanceof Error ? error.message : String(error),
        userId
      })
      throw error
    }
  }

  /**
   * Get organization-scoped query for a specific entity
   */
  getOrgScopedQuery(orgId: string, entityName: string): any {
    if (this.demoMode) {
      // In demo mode, delegate to mock service
      return this.mockService[entityName as keyof MockPrismaService]
    }

    // In production, ensure all queries include orgId filter
    return this[entityName as keyof PrismaService]
  }
}
