import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { BusinessMetricsService } from '../services/business-metrics.service';
import { RequestClaims } from '../types/claims';
import { AbacGuard } from '../abac/abac.guard';
import { Abac } from '../abac/abac.guard';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import { z } from 'zod';

const BusinessMetricsQueryDto = z.object({
  orgId: z.string().uuid().optional(),
  refresh: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
});

@Controller('metrics')
@UseGuards(AbacGuard)
export class BusinessMetricsController {
  constructor(private readonly businessMetricsService: BusinessMetricsService) {}

  @Get('business')
  @Abac({ resource: 'Health', action: 'read' })
  async getBusinessMetrics(
    @Query(new ZodValidationPipe(BusinessMetricsQueryDto)) query: z.infer<typeof BusinessMetricsQueryDto>,
    @Req() req: any,
  ) {
    const claims: RequestClaims = req.claims;
    
    // Clear cache if refresh is requested
    if (query.refresh) {
      this.businessMetricsService.clearCache();
    }

    // Use orgId from query or fall back to user's org
    const orgId = query.orgId || claims.orgId;

    return this.businessMetricsService.getBusinessMetrics(orgId);
  }

  @Get('business/cached')
  @Abac({ resource: 'Health', action: 'read' })
  async getCachedBusinessMetrics(@Req() req: any) {
    const cachedMetrics = this.businessMetricsService.getCachedMetrics();
    
    if (!cachedMetrics) {
      return { message: 'No cached metrics available' };
    }

    return cachedMetrics;
  }

  @Get('business/refresh')
  @Abac({ resource: 'Health', action: 'read' })
  async refreshBusinessMetrics(
    @Query(new ZodValidationPipe(BusinessMetricsQueryDto)) query: z.infer<typeof BusinessMetricsQueryDto>,
    @Req() req: any,
  ) {
    const claims: RequestClaims = req.claims;
    
    // Clear cache to force refresh
    this.businessMetricsService.clearCache();
    
    // Use orgId from query or fall back to user's org
    const orgId = query.orgId || claims.orgId;

    return this.businessMetricsService.getBusinessMetrics(orgId);
  }
}
