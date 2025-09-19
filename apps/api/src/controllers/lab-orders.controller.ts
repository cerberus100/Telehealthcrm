import { Body, Controller, Get, Post, Param, Query, UseGuards, Req } from '@nestjs/common'
import { AbacGuard } from '../abac/abac.guard'
import { Abac } from '../abac/abac.guard'
import { ZodValidationPipe } from '../pipes/zod-validation.pipe'
import { LabOrdersService } from '../services/lab-orders.service'
import { RequestClaims } from '../types/claims'
import { z } from 'zod'

const CreateLabOrderDto = z.object({
  patientId: z.string().uuid(),
  consultId: z.string().uuid().optional(),
  tests: z.array(z.string()),
  templateId: z.string().uuid().optional(),
  kitShipping: z.object({
    name: z.string(),
    address1: z.string(),
    address2: z.string().optional(),
    city: z.string(),
    state: z.string().length(2),
    zip: z.string(),
    phone: z.string()
  }).optional()
})

const LabOrderQueryDto = z.object({
  patientId: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'IN_TRANSIT', 'RECEIVED', 'RESULTS_READY']).optional(),
  limit: z.number().int().min(1).max(100).optional().default(25)
})

@Controller('lab-orders')
@UseGuards(AbacGuard)
export class LabOrdersController {
  constructor(private readonly labOrdersService: LabOrdersService) {}

  @Post()
  @Abac({ resource: 'LabOrder', action: 'create' })
  async createLabOrder(
    @Body(new ZodValidationPipe(CreateLabOrderDto)) body: z.infer<typeof CreateLabOrderDto>,
    @Req() req: any
  ) {
    const claims: RequestClaims = req.claims
    return await this.labOrdersService.createLabOrder(body, claims)
  }

  @Get()
  @Abac({ resource: 'LabOrder', action: 'read' })
  async listLabOrders(
    @Query(new ZodValidationPipe(LabOrderQueryDto)) query: z.infer<typeof LabOrderQueryDto>,
    @Req() req: any
  ) {
    const claims: RequestClaims = req.claims
    return await this.labOrdersService.listLabOrders(query, claims)
  }

  @Get(':id')
  @Abac({ resource: 'LabOrder', action: 'read' })
  async getLabOrder(@Param('id') id: string, @Req() req: any) {
    const claims: RequestClaims = req.claims
    return await this.labOrdersService.getLabOrder(id, claims)
  }
}
