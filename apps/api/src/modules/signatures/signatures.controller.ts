import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  Param, 
  Query, 
  Req, 
  UseGuards,
  BadRequestException,
  UploadedFile,
  UseInterceptors
} from '@nestjs/common'
// import { FileInterceptor } from '@nestjs/platform-express'
import { AbacGuard, Abac } from '../../abac/abac.guard'
import { SignaturesService, SignatureRequest } from './signatures.service'
import { RequestClaims } from '../../types/claims'
import { ZodValidationPipe } from '../../pipes/zod-validation.pipe'
import { z } from 'zod'

const SignDocumentDto = z.object({
  entity: z.enum(['RX', 'LAB_ORDER', 'DOCUMENT']),
  entityId: z.string().uuid(),
  title: z.string().min(1).max(255),
  patientId: z.string().uuid(),
  webauthnAssertion: z.object({
    credentialId: z.string(),
    signature: z.string(),
    authenticatorData: z.string(),
    clientDataJSON: z.string(),
  }).optional(),
  stepUpToken: z.string().optional(),
})

const GetSignatureEventsDto = z.object({
  orgId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  entity: z.enum(['RX', 'LAB_ORDER', 'DOCUMENT']).optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(100).default(50),
})

@Controller('signatures')
export class SignaturesController {
  constructor(private readonly signaturesService: SignaturesService) {}

  /**
   * Sign a document with step-up authentication
   * POST /signatures/sign
   */
  @Post('sign')
  @UseGuards(AbacGuard)
  @Abac({ resource: 'User', action: 'create' })
  async signDocument(
    @Body(new ZodValidationPipe(SignDocumentDto)) dto: z.infer<typeof SignDocumentDto>,
    @Req() req: any
  ) {
    const claims: RequestClaims = req.claims
    
    // For demo, create mock PDF buffer
    const mockPdfContent = `Mock PDF for ${dto.entity} ${dto.entityId}`
    const documentBuffer = Buffer.from(mockPdfContent)

    // Extract network context
    const ipAddress = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.ip
    const userAgent = req.headers['user-agent'] || 'unknown'
    const deviceFingerprintId = req.headers['x-device-fingerprint'] as string | undefined

    const signatureRequest: SignatureRequest = {
      entity: dto.entity,
      entityId: dto.entityId,
      documentBuffer,
      title: dto.title,
      patientId: dto.patientId,
      webauthnAssertion: dto.webauthnAssertion,
      stepUpToken: dto.stepUpToken,
    }

    return this.signaturesService.signDocument(
      signatureRequest,
      claims.sub || 'unknown-user',
      claims.orgId,
      claims.role,
      ipAddress,
      userAgent,
      deviceFingerprintId
    )
  }

  /**
   * Verify a signature event
   * GET /signatures/:id/verify
   */
  @Get(':id/verify')
  @UseGuards(AbacGuard)
  @Abac({ resource: 'User', action: 'read' })
  async verifySignature(@Param('id') signatureEventId: string) {
    return this.signaturesService.verifySignature(signatureEventId)
  }

  /**
   * Get signature events for audit (Super Admin only)
   * GET /signatures/events
   */
  @Get('events')
  @UseGuards(AbacGuard)
  @Abac({ resource: 'User', action: 'read' })
  async getSignatureEvents(
    @Query(new ZodValidationPipe(GetSignatureEventsDto)) query: z.infer<typeof GetSignatureEventsDto>
  ) {
    return this.signaturesService.getSignatureEvents(
      query.orgId,
      query.userId,
      query.entity,
      query.fromDate ? new Date(query.fromDate) : undefined,
      query.toDate ? new Date(query.toDate) : undefined,
      query.limit
    )
  }

  /**
   * Get signature event details
   * GET /signatures/:id
   */
  @Get(':id')
  @UseGuards(AbacGuard)
  @Abac({ resource: 'User', action: 'read' })
  async getSignatureEvent(@Param('id') signatureEventId: string) {
    const event = await this.signaturesService.getSignatureEvents()
    // Filter to specific ID
    return event.find(e => e.id === signatureEventId)
  }

  /**
   * Generate evidence export bundle
   * POST /signatures/:id/export
   */
  @Post(':id/export')
  @UseGuards(AbacGuard)
  @Abac({ resource: 'User', action: 'read' })
  async generateEvidenceBundle(@Param('id') signatureEventId: string) {
    return this.signaturesService.generateEvidenceBundle(signatureEventId)
  }
}
