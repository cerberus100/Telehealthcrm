import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

interface TenantContext {
  orgId: string;
  orgType: string;
  orgName: string;
  isActive: boolean;
  compliance: {
    hipaaCompliant: boolean;
    baaSigned: boolean;
  };
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantMiddleware.name);
  private readonly tenantCache = new Map<string, TenantContext>();
  private readonly cacheExpiry = 5 * 60 * 1000; // 5 minutes

  constructor(private prisma: PrismaService) {}

  async use(req: FastifyRequest, res: FastifyReply, next: (err?: unknown) => void) {
    try {
      // Extract org_id from claims
      const claims = (req as any).claims;

      // In demo mode, short-circuit tenant resolution with a mock org
      if (process.env.API_DEMO_MODE === 'true') {
        const demoOrgId = (claims?.orgId as string) || 'mock-org-123'
        const tenantContext: TenantContext = {
          orgId: demoOrgId,
          orgType: 'PROVIDER',
          orgName: 'Demo Organization',
          isActive: true,
          compliance: { hipaaCompliant: false, baaSigned: false },
        }
        ;(req as any).tenant = tenantContext
        res.header('X-Tenant-ID', tenantContext.orgId)
        res.header('X-Tenant-Type', tenantContext.orgType)
        res.header('X-Tenant-Name', tenantContext.orgName)
        this.logger.debug({ action: 'TENANT_ACCESS_DEMO', orgId: tenantContext.orgId, path: req.routeOptions.url, method: req.method })
        next()
        return
      }
      
      if (!claims || !claims.orgId) {
        this.logger.warn('No organization ID found in claims');
        throw new HttpException(
          {
            error: {
              code: 'TENANT_NOT_FOUND',
              message: 'Organization not found in request',
              details: null,
            },
          },
          HttpStatus.BAD_REQUEST
        );
      }

      // Get tenant context
      const tenantContext = await this.getTenantContext(claims.orgId);
      
      if (!tenantContext) {
        this.logger.warn(`Organization not found: ${claims.orgId}`);
        throw new HttpException(
          {
            error: {
              code: 'TENANT_NOT_FOUND',
              message: 'Organization not found',
              details: { orgId: claims.orgId },
            },
          },
          HttpStatus.NOT_FOUND
        );
      }

      if (!tenantContext.isActive) {
        this.logger.warn(`Organization is inactive: ${claims.orgId}`);
        throw new HttpException(
          {
            error: {
              code: 'TENANT_INACTIVE',
              message: 'Organization is inactive',
              details: { orgId: claims.orgId },
            },
          },
          HttpStatus.FORBIDDEN
        );
      }

      // Add tenant context to request
      (req as any).tenant = tenantContext;

      // Add tenant headers for debugging
      res.header('X-Tenant-ID', tenantContext.orgId);
      res.header('X-Tenant-Type', tenantContext.orgType);
      res.header('X-Tenant-Name', tenantContext.orgName);

      // Log tenant access
      this.logger.debug({
        action: 'TENANT_ACCESS',
        orgId: tenantContext.orgId,
        orgType: tenantContext.orgType,
        userId: claims.sub,
        path: req.routeOptions.url,
        method: req.method,
      });

      next();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      this.logger.error('Tenant middleware error:', error);
      throw new HttpException(
        {
          error: {
            code: 'TENANT_ERROR',
            message: 'Tenant validation failed',
            details: null,
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private async getTenantContext(orgId: string): Promise<TenantContext | null> {
    try {
      // Check cache first
      const cached = this.tenantCache.get(orgId);
      if (cached) {
        return cached;
      }

      // Use the unified PrismaService method
      const tenantContext = await this.prisma.getTenantContext(orgId);

      if (!tenantContext) {
        return null;
      }

      // Cache the result
      this.tenantCache.set(orgId, tenantContext);

      // Set cache expiry
      setTimeout(() => {
        this.tenantCache.delete(orgId);
      }, this.cacheExpiry);

      return tenantContext;
    } catch (error) {
      this.logger.error(`Error getting tenant context for ${orgId}:`, error);
      return null;
    }
  }

  // Method to invalidate tenant cache (useful for org updates)
  invalidateTenantCache(orgId: string): void {
    this.tenantCache.delete(orgId);
    this.logger.debug(`Tenant cache invalidated for: ${orgId}`);
  }

  // Method to get all cached tenants
  getCachedTenants(): Map<string, TenantContext> {
    return new Map(this.tenantCache);
  }

  // Method to clear all tenant cache
  clearTenantCache(): void {
    this.tenantCache.clear();
    this.logger.debug('All tenant cache cleared');
  }
}
