import { Body, Controller, Post, UseGuards, Req } from '@nestjs/common'
import { AbacGuard } from '../abac/abac.guard'
import { Abac } from '../abac/abac.guard'
import { ZodValidationPipe } from '../pipes/zod-validation.pipe'
import { EventsService } from '../services/events.service'
import { RequestClaims } from '../types/claims'
import { z } from 'zod'

const ScreenPopDto = z.object({
  consultId: z.string().uuid(),
  contactId: z.string().optional(),
  callerInfo: z.object({
    name: z.string().optional(),
    phone: z.string(),
    serviceMode: z.string()
  })
})

@Controller('events')
@UseGuards(AbacGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post('screen-pop')
  @Abac({ resource: 'Consult', action: 'read' })
  async triggerScreenPop(
    @Body(new ZodValidationPipe(ScreenPopDto)) body: z.infer<typeof ScreenPopDto>,
    @Req() req: any
  ) {
    const claims: RequestClaims = req.claims
    return await this.eventsService.triggerScreenPop(body, claims)
  }
}
