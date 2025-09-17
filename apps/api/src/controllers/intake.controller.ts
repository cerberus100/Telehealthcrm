import { Body, Controller, Get, Post, Param } from '@nestjs/common'
import { ZodValidationPipe } from '../pipes/zod-validation.pipe'
import { IntakeService } from '../services/intake.service'
import { z } from 'zod'

const IntakeSubmissionDto = z.object({
  patientName: z.string().min(1).max(200),
  phone: z.string().regex(/^\+?[\d\s\-\(\)]{10,15}$/),
  email: z.string().email().optional(),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  state: z.string().length(2),
  medicareId: z.string().optional(),
  serviceRequested: z.enum(['RX', 'LABS', 'BOTH']),
  triageJson: z.record(z.any()),
  consent: z.object({
    tcpa: z.boolean(),
    hipaa: z.boolean()
  }),
  address: z.object({
    addr1: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional()
  }).optional()
})

@Controller('intake')
export class IntakeController {
  constructor(private readonly intakeService: IntakeService) {}

  @Get(':linkId/form')
  async getFormConfig(@Param('linkId') linkId: string) {
    return await this.intakeService.getFormConfig(linkId)
  }

  @Post(':linkId')
  async submitIntake(
    @Param('linkId') linkId: string,
    @Body(new ZodValidationPipe(IntakeSubmissionDto)) body: z.infer<typeof IntakeSubmissionDto>
  ) {
    return await this.intakeService.submitIntake(linkId, body)
  }
}
