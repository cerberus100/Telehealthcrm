import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common'
import { ShipmentsService } from '../services/shipments.service'
import { ShipmentsQueryDto } from '../types/dto'
import { RequestClaims } from '../types/claims'
import { AbacGuard } from '../abac/abac.guard'
import { Abac } from '../abac/abac.guard'
import { ZodValidationPipe } from '../pipes/zod-validation.pipe'

@Controller('shipments')
@UseGuards(AbacGuard)
export class ShipmentsController {
  constructor(private shipmentsService: ShipmentsService) {}

  @Get()
  @Abac({ resource: 'Shipment', action: 'read' })
  async getShipments(@Query(new ZodValidationPipe(ShipmentsQueryDto)) query: ShipmentsQueryDto, @Req() req: any) {
    const claims: RequestClaims = req.claims
    return this.shipmentsService.getShipments(query, claims)
  }
}
