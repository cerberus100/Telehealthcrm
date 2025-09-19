import { Body, Controller, Post } from '@nestjs/common'
import { ZodValidationPipe } from '../pipes/zod-validation.pipe'
import { DuplicateCheckService } from '../services/duplicate-check.service'
import { z } from 'zod'

const DuplicateCheckDto = z.object({
  medicareId: z.string().min(1).max(20),
  testCategory: z.enum(['NEURO', 'IMMUNE']),
  testType: z.string().optional(),
  patientName: z.string().optional(),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
})

@Controller('duplicate-check')
export class DuplicateCheckController {
  constructor(private readonly duplicateCheckService: DuplicateCheckService) {}

  @Post('medicare')
  async checkMedicareId(@Body(new ZodValidationPipe(DuplicateCheckDto)) body: z.infer<typeof DuplicateCheckDto>) {
    return await this.duplicateCheckService.checkMedicareId(body)
  }
}
