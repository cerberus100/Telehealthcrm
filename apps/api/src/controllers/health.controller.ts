import { Controller, Get } from '@nestjs/common'
import { Abac } from '../abac/abac.guard'

@Controller('health')
export class HealthController {
  @Get()
  @Abac({ resource: 'Patient', action: 'read' })
  get() {
    return { status: 'ok' }
  }
}
