import { Body, Controller, Post } from '@nestjs/common'
import { ConnectService } from '../services/connect.service'
import { ZodValidationPipe } from '../pipes/zod-validation.pipe'
import { z } from 'zod'

// Connect Lambda endpoint DTOs
const ConnectIdentifyDto = z.object({
  ani: z.string(),
  dnis: z.string(),
  contactId: z.string()
})

const ConnectCallNotesDto = z.object({
  contactId: z.string(),
  consultId: z.string(),
  transcriptS3Key: z.string(),
  recordingS3Key: z.string().optional()
})

@Controller('connect')
export class ConnectController {
  constructor(private readonly connectService: ConnectService) {}

  @Post('identify')
  async identify(@Body(new ZodValidationPipe(ConnectIdentifyDto)) body: z.infer<typeof ConnectIdentifyDto>) {
    return await this.connectService.identifyConsult(body)
  }

  @Post('call-notes')
  async attachCallNotes(@Body(new ZodValidationPipe(ConnectCallNotesDto)) body: z.infer<typeof ConnectCallNotesDto>) {
    return await this.connectService.attachCallNotes(body)
  }
}
