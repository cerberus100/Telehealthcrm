import { Body, Controller, Get, Post, Put, Delete, Param, UseGuards, Req } from '@nestjs/common'
import { AbacGuard } from '../abac/abac.guard'
import { Abac } from '../abac/abac.guard'
import { ZodValidationPipe } from '../pipes/zod-validation.pipe'
import { IntakeLinksService } from '../services/intake-links.service'
import { RequestClaims } from '../types/claims'
import { z } from 'zod'

const CreateIntakeLinkDto = z.object({
  services: z.enum(['RX', 'LABS', 'BOTH']),
  clientIds: z.array(z.string().uuid()),
  campaign: z.string().max(100).optional(),
  allowedOrigins: z.array(z.string().url()).optional(),
  rateLimit: z.number().int().min(1).max(10000).optional(),
  webhookUrl: z.string().url().optional()
})

const UpdateIntakeLinkDto = z.object({
  services: z.enum(['RX', 'LABS', 'BOTH']).optional(),
  clientIds: z.array(z.string().uuid()).optional(),
  campaign: z.string().max(100).optional(),
  active: z.boolean().optional(),
  allowedOrigins: z.array(z.string().url()).optional(),
  rateLimit: z.number().int().min(1).max(10000).optional(),
  webhookUrl: z.string().url().optional()
})

@Controller('intake-links')
@UseGuards(AbacGuard)
export class IntakeLinksController {
  constructor(private readonly intakeLinksService: IntakeLinksService) {}

  @Post()
  @Abac({ resource: 'Organization', action: 'write' })
  async createIntakeLink(
    @Body(new ZodValidationPipe(CreateIntakeLinkDto)) body: z.infer<typeof CreateIntakeLinkDto>,
    @Req() req: any
  ) {
    const claims: RequestClaims = req.claims
    return await this.intakeLinksService.createIntakeLink(body, claims)
  }

  @Get()
  @Abac({ resource: 'Organization', action: 'read' })
  async listIntakeLinks(@Req() req: any) {
    const claims: RequestClaims = req.claims
    return await this.intakeLinksService.listIntakeLinks(claims)
  }

  @Put(':id')
  @Abac({ resource: 'Organization', action: 'write' })
  async updateIntakeLink(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateIntakeLinkDto)) body: z.infer<typeof UpdateIntakeLinkDto>,
    @Req() req: any
  ) {
    const claims: RequestClaims = req.claims
    return await this.intakeLinksService.updateIntakeLink(id, body, claims)
  }

  @Delete(':id')
  @Abac({ resource: 'Organization', action: 'write' })
  async deleteIntakeLink(@Param('id') id: string, @Req() req: any) {
    const claims: RequestClaims = req.claims
    return await this.intakeLinksService.deleteIntakeLink(id, claims)
  }
}
