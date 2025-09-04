import { Controller, Get, Query, Param, UseGuards, Req } from '@nestjs/common'
import { RxService } from '../services/rx.service'
import { RxQueryDto } from '../types/dto'
import { RequestClaims } from '../types/claims'
import { AbacGuard } from '../abac/abac.guard'
import { Abac } from '../abac/abac.guard'
import { ZodValidationPipe } from '../pipes/zod-validation.pipe'

@Controller('rx')
@UseGuards(AbacGuard)
export class RxController {
  constructor(private rxService: RxService) {}

  @Get()
  @Abac({ resource: 'Rx', action: 'read' })
  async getRxList(@Query(new ZodValidationPipe(RxQueryDto)) query: RxQueryDto, @Req() req: any) {
    const claims: RequestClaims = req.claims
    return this.rxService.getRxList(query, claims)
  }

  @Get(':id')
  @Abac({ resource: 'Rx', action: 'read' })
  async getRx(@Param('id') id: string, @Req() req: any) {
    const claims: RequestClaims = req.claims
    return this.rxService.getRx(id, claims)
  }
}
