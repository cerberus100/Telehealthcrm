import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common'
import { AbacGuard } from '../abac/abac.guard'
import { Abac } from '../abac/abac.guard'
import { ZodValidationPipe } from '../pipes/zod-validation.pipe'
import { SearchService } from '../services/search.service'
import { RequestClaims } from '../types/claims'
import { z } from 'zod'

const PatientSearchDto = z.object({
  q: z.string().min(1).max(200),
  limit: z.number().int().min(1).max(100).optional().default(25)
})

const PhoneSearchDto = z.object({
  phone: z.string().min(4).max(20),
  limit: z.number().int().min(1).max(50).optional().default(10)
})

@Controller('search')
@UseGuards(AbacGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('patients')
  @Abac({ resource: 'Patient', action: 'read' })
  async searchPatients(
    @Query(new ZodValidationPipe(PatientSearchDto)) query: z.infer<typeof PatientSearchDto>,
    @Req() req: any
  ) {
    const claims: RequestClaims = req.claims
    return await this.searchService.searchPatients(query, claims)
  }
}

@Controller('patients')
@UseGuards(AbacGuard)
export class PatientsController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @Abac({ resource: 'Patient', action: 'read' })
  async findPatients(
    @Query(new ZodValidationPipe(PhoneSearchDto)) query: z.infer<typeof PhoneSearchDto>,
    @Req() req: any
  ) {
    const claims: RequestClaims = req.claims
    if (query.phone) {
      return await this.searchService.findPatientsByPhone(query.phone, claims)
    }
    return { items: [], next_cursor: null }
  }
}
