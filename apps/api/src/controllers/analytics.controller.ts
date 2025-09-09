import { Controller, Get, UseGuards, Req } from '@nestjs/common'
import { AnalyticsService } from '../services/analytics.service'
import { RequestClaims } from '../types/claims'
import { AbacGuard } from '../abac/abac.guard'
import { Abac } from '../abac/abac.guard'

@Controller('operational-analytics')
@UseGuards(AbacGuard)
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('metrics')
  @Abac({ resource: 'Analytics', action: 'read' })
  async getMetrics(@Req() req: any) {
    const claims: RequestClaims = req.claims
    return this.analyticsService.getMetrics(claims)
  }

  @Get('operational-metrics')
  @Abac({ resource: 'OperationalMetrics', action: 'read' })
  async getOperationalMetrics(@Req() req: any) {
    const claims: RequestClaims = req.claims
    return this.analyticsService.getOperationalMetrics(claims)
  }
}

