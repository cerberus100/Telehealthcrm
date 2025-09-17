import { Controller, Get, Query, Param, Post, Body, UseGuards, Req, Res } from '@nestjs/common'
import { FastifyReply } from 'fastify'
import { AbacGuard } from '../abac/abac.guard'
import { Abac } from '../abac/abac.guard'
import { ZodValidationPipe } from '../pipes/zod-validation.pipe'
import { MarketerService } from '../services/marketer.service'
import { RequestClaims } from '../types/claims'
import { z } from 'zod'

const ApprovalsQueryDto = z.object({
  service: z.enum(['RX', 'LABS']).optional(),
  status: z.enum(['APPROVED', 'DECLINED', 'PENDING']).optional(),
  clientId: z.string().uuid().optional(),
  campaign: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(100).optional().default(25)
})

const ExportUpsDto = z.object({
  ids: z.array(z.string().uuid()),
  mappingProfileId: z.string().uuid().optional()
})

@Controller('marketer')
@UseGuards(AbacGuard)
export class MarketerController {
  constructor(private readonly marketerService: MarketerService) {}

  @Get('approvals')
  @Abac({ resource: 'Consult', action: 'read' })
  async getApprovals(
    @Query(new ZodValidationPipe(ApprovalsQueryDto)) query: z.infer<typeof ApprovalsQueryDto>,
    @Req() req: any
  ) {
    const claims: RequestClaims = req.claims
    return await this.marketerService.getApprovals(query, claims)
  }

  @Get('approvals/:id/pack.pdf')
  @Abac({ resource: 'LabOrder', action: 'read' })
  async downloadApprovalPack(@Param('id') id: string, @Req() req: any) {
    const claims: RequestClaims = req.claims
    return await this.marketerService.getApprovalPackUrl(id, claims)
  }

  @Post('approvals/export/ups')
  @Abac({ resource: 'Shipment', action: 'create' })
  async exportUpsCSV(
    @Body(new ZodValidationPipe(ExportUpsDto)) body: z.infer<typeof ExportUpsDto>,
    @Req() req: any,
    @Res({ passthrough: true }) res: FastifyReply
  ) {
    const claims: RequestClaims = req.claims
    const csvData = await this.marketerService.exportUpsCSV(body, claims)
    
    res.header('Content-Type', 'text/csv')
    res.header('Content-Disposition', `attachment; filename="ups-export-${Date.now()}.csv"`)
    
    return csvData
  }
}
