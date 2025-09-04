import { Controller, Get, Query, Param, Patch, Body, UseGuards, Req } from '@nestjs/common'
import { ConsultsService } from '../services/consults.service'
import { ConsultsQueryDto, UpdateConsultStatusDto } from '../types/dto'
import { RequestClaims } from '../types/claims'
import { AbacGuard } from '../abac/abac.guard'
import { Abac } from '../abac/abac.guard'
import { ZodValidationPipe } from '../pipes/zod-validation.pipe'

@Controller('consults')
@UseGuards(AbacGuard)
export class ConsultsController {
  constructor(private consultsService: ConsultsService) {}

  @Get()
  @Abac({ resource: 'Consult', action: 'read' })
  async getConsults(@Query(new ZodValidationPipe(ConsultsQueryDto)) query: ConsultsQueryDto, @Req() req: any) {
    const claims: RequestClaims = req.claims
    return this.consultsService.getConsults(query, claims)
  }

  @Get(':id')
  @Abac({ resource: 'Consult', action: 'read' })
  async getConsult(@Param('id') id: string, @Req() req: any) {
    const claims: RequestClaims = req.claims
    return this.consultsService.getConsult(id, claims)
  }

  @Patch(':id/status')
  @Abac({ resource: 'Consult', action: 'update' })
  async updateConsultStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateConsultStatusDto)) updateDto: UpdateConsultStatusDto,
    @Req() req: any
  ) {
    const claims: RequestClaims = req.claims
    return this.consultsService.updateConsultStatus(id, updateDto, claims)
  }
}
