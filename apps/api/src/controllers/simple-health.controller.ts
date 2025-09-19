import { Controller, Get, Req } from '@nestjs/common'

@Controller('health')
export class SimpleHealthController {
  @Get()
  get(@Req() req: any) {
    const correlationId = req.headers['correlation-id'] || req.id
    return { 
      status: 'ok',
      correlation_id: correlationId
    }
  }
}


