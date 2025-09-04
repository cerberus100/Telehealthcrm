import { Controller, Get, Req } from '@nestjs/common'
import { Abac } from '../abac/abac.guard'

@Controller('health')
export class HealthController {
  @Get()
  @Abac({ resource: 'Health', action: 'read' })
  get(@Req() req: any) {
    const correlationId = req.headers['correlation-id'] || req.id
    return { 
      status: 'ok',
      correlation_id: correlationId
    }
  }
}
