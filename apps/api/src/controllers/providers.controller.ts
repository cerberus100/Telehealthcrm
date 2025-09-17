import { Body, Controller, Get, Patch, UseGuards, Req } from '@nestjs/common'
import { AbacGuard } from '../abac/abac.guard'
import { Abac } from '../abac/abac.guard'
import { ZodValidationPipe } from '../pipes/zod-validation.pipe'
import { ConnectService } from '../services/connect.service'
import { RequestClaims } from '../types/claims'
import { z } from 'zod'

const SetAvailabilityDto = z.object({
  available: z.boolean()
})

const UpdateProviderDto = z.object({
  statesLicensed: z.array(z.string().length(2)).optional(),
  availability: z.object({
    days: z.array(z.enum(['MON','TUE','WED','THU','FRI','SAT','SUN'])),
    hours: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/)
  }).optional()
})

@Controller('providers')
@UseGuards(AbacGuard)
export class ProvidersController {
  constructor(private readonly connectService: ConnectService) {}

  @Patch('availability')
  @Abac({ resource: 'User', action: 'update' })
  async setAvailability(
    @Body(new ZodValidationPipe(SetAvailabilityDto)) body: z.infer<typeof SetAvailabilityDto>,
    @Req() req: any
  ) {
    const claims: RequestClaims = req.claims
    return await this.connectService.setProviderAvailability(claims.sub || 'unknown', body.available)
  }

  @Get('availability')
  @Abac({ resource: 'User', action: 'read' })
  async getAvailability(@Req() req: any) {
    const claims: RequestClaims = req.claims
    // Return current availability status
    return { available: true, schedule: null } // Demo response
  }

  @Patch('profile')
  @Abac({ resource: 'User', action: 'update' })
  async updateProfile(
    @Body(new ZodValidationPipe(UpdateProviderDto)) body: z.infer<typeof UpdateProviderDto>,
    @Req() req: any
  ) {
    const claims: RequestClaims = req.claims
    // Update provider licensing and schedule
    return { success: true } // Demo response
  }
}
