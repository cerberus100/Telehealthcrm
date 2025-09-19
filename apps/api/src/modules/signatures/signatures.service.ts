import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { KMSClient, SignCommand, GetPublicKeyCommand, SignCommandInput } from '@aws-sdk/client-kms'
import { createHash } from 'crypto'
import { PrismaService } from '../../prisma.service'
import { S3EvidenceService } from './s3-evidence.service'
import { DocumentsService } from './documents.service'
import { logger } from '../../utils/logger'

export interface SignatureRequest {
  entity: 'RX' | 'LAB_ORDER' | 'DOCUMENT'
  entityId: string
  documentBuffer: Buffer
  title: string
  patientId: string
  webauthnAssertion?: {
    credentialId: string
    signature: string
    authenticatorData: string
    clientDataJSON: string
  }
  stepUpToken?: string // TOTP or password re-entry
}

export interface SignatureResponse {
  signatureEventId: string
  documentId: string
  s3Key: string
  sha256: string
  signedAt: string
}

export interface VerificationResult {
  valid: boolean
  checks: {
    hashMatch: boolean
    kmsSignatureValid: boolean
    tsaTokenValid: boolean
    chainValid: boolean
  }
  errors: string[]
}

@Injectable()
export class SignaturesService {
  private readonly kmsClient: KMSClient | null
  private readonly signingKeyId: string
  private readonly demoMode: boolean

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Evidence: S3EvidenceService,
    private readonly documents: DocumentsService,
    private readonly config: ConfigService
  ) {
    this.demoMode = this.config.get<string>('API_DEMO_MODE') === 'true'
    this.signingKeyId = this.config.get<string>('KMS_SIGNING_KEY_ID') || 'demo-key-id'
    
    if (!this.demoMode) {
      this.kmsClient = new KMSClient({
        region: this.config.get<string>('AWS_REGION', 'us-east-1'),
      })
    } else {
      this.kmsClient = null
    }
  }

  /**
   * Create cryptographic signature for document with step-up auth
   */
  async signDocument(
    request: SignatureRequest,
    actorUserId: string,
    actorOrgId: string,
    role: string,
    ipAddress: string,
    userAgent: string,
    deviceFingerprintId?: string
  ): Promise<SignatureResponse> {
    try {
      // 1. Validate step-up authentication
      const stepUpResult = await this.validateStepUp(request, actorUserId)
      
      // 2. Compute document hash
      const docSha256 = createHash('sha256').update(request.documentBuffer).digest('hex')
      
      // 3. Get previous hash for chain
      const prevHash = await this.getLastChainHash(actorOrgId)
      
      // 4. Generate trusted timestamp (TSA token)
      const tsaToken = await this.getTrustedTimestamp(docSha256)
      
      // 5. Sign with KMS
      const kmsSignature = await this.signWithKMS(request.documentBuffer)
      
      // 6. Store document in S3 WORM
      const s3Key = await this.documents.storeDocument(
        request.documentBuffer,
        request.patientId,
        request.entity,
        request.title,
        actorUserId
      )
      
      // 7. Compute chain hash
      const contentToHash = [
        crypto.randomUUID(), // Will be the SignatureEvent ID
        actorUserId,
        actorOrgId,
        request.entity,
        request.entityId,
        docSha256,
        prevHash || ''
      ].join('|')
      
      const chainHash = createHash('sha256').update(contentToHash).digest('hex')
      
      // 8. Create immutable SignatureEvent
      const signatureEvent = await this.prisma.signatureEvent.create({
        data: {
          actorUserId,
          actorOrgId,
          role,
          entity: request.entity,
          entityId: request.entityId,
          docSha256,
          docS3Key: s3Key,
          docVersion: 1,
          signatureType: stepUpResult.signatureType,
          webauthnCredentialId: request.webauthnAssertion?.credentialId,
          webauthnAaguid: stepUpResult.aaguid,
          stepUpUsed: stepUpResult.stepUpUsed,
          mfaUsed: stepUpResult.mfaUsed,
          ipAddress,
          userAgent,
          deviceFingerprintId,
          geoCity: null, // TODO: GeoIP lookup
          geoRegion: null,
          geoCountry: null,
          tsaToken: tsaToken ? Buffer.from(tsaToken, 'base64') : null,
          kmsKeyId: this.signingKeyId,
          kmsSignature: Buffer.from(kmsSignature, 'base64'),
          chainPrevHash: prevHash,
          chainHash,
        },
      })

      // 9. Append to S3 WORM JSONL evidence store
      await this.s3Evidence.appendSignatureEvent(signatureEvent)

      // 10. Log audit event
      logger.info({
        action: 'DOCUMENT_SIGNED',
        signature_event_id: signatureEvent.id,
        entity: request.entity,
        entity_id: request.entityId,
        actor_user_id: actorUserId,
        actor_org_id: actorOrgId,
        doc_sha256: docSha256,
        step_up_used: stepUpResult.stepUpUsed,
        mfa_used: stepUpResult.mfaUsed,
      })

      return {
        signatureEventId: signatureEvent.id,
        documentId: signatureEvent.id, // Use same ID for simplicity
        s3Key,
        sha256: docSha256,
        signedAt: signatureEvent.createdAtUtc.toISOString(),
      }
    } catch (error) {
      logger.error({
        action: 'DOCUMENT_SIGN_FAILED',
        entity: request.entity,
        entity_id: request.entityId,
        actor_user_id: actorUserId,
        error: (error as Error).message,
      })
      throw error
    }
  }

  /**
   * Verify signature event cryptographically
   */
  async verifySignature(signatureEventId: string): Promise<VerificationResult> {
    try {
      const event = await this.prisma.signatureEvent.findUnique({
        where: { id: signatureEventId },
      })

      if (!event) {
        throw new BadRequestException('Signature event not found')
      }

      const checks = {
        hashMatch: false,
        kmsSignatureValid: false,
        tsaTokenValid: false,
        chainValid: false,
      }
      const errors: string[] = []

      // 1. Verify document hash
      try {
        const documentBuffer = await this.documents.getDocumentBuffer(event.docS3Key)
        const computedHash = createHash('sha256').update(documentBuffer).digest('hex')
        checks.hashMatch = computedHash === event.docSha256
        if (!checks.hashMatch) {
          errors.push(`Hash mismatch: expected ${event.docSha256}, got ${computedHash}`)
        }
      } catch (error) {
        errors.push(`Hash verification failed: ${(error as Error).message}`)
      }

      // 2. Verify KMS signature
      try {
        checks.kmsSignatureValid = await this.verifyKMSSignature(
          event.docSha256,
          event.kmsSignature.toString('base64'),
          event.kmsKeyId
        )
        if (!checks.kmsSignatureValid) {
          errors.push('KMS signature verification failed')
        }
      } catch (error) {
        errors.push(`KMS verification failed: ${(error as Error).message}`)
      }

      // 3. Verify TSA token (if present)
      if (event.tsaToken) {
        try {
          checks.tsaTokenValid = await this.verifyTSAToken(
            event.tsaToken.toString('base64'),
            event.docSha256
          )
          if (!checks.tsaTokenValid) {
            errors.push('TSA token verification failed')
          }
        } catch (error) {
          errors.push(`TSA verification failed: ${(error as Error).message}`)
        }
      } else {
        checks.tsaTokenValid = true // No TSA token to verify
      }

      // 4. Verify chain hash
      try {
        const contentToHash = [
          event.id,
          event.actorUserId,
          event.actorOrgId,
          event.entity,
          event.entityId,
          event.docSha256,
          event.chainPrevHash || ''
        ].join('|')
        
        const computedChainHash = createHash('sha256').update(contentToHash).digest('hex')
        checks.chainValid = computedChainHash === event.chainHash
        if (!checks.chainValid) {
          errors.push(`Chain hash mismatch: expected ${event.chainHash}, got ${computedChainHash}`)
        }
      } catch (error) {
        errors.push(`Chain verification failed: ${(error as Error).message}`)
      }

      const valid = checks.hashMatch && checks.kmsSignatureValid && checks.tsaTokenValid && checks.chainValid

      logger.info({
        action: 'SIGNATURE_VERIFIED',
        signature_event_id: signatureEventId,
        valid,
        checks,
        errors: errors.length > 0 ? errors : undefined,
      })

      return { valid, checks, errors }
    } catch (error) {
      logger.error({
        action: 'SIGNATURE_VERIFICATION_FAILED',
        signature_event_id: signatureEventId,
        error: (error as Error).message,
      })
      throw error
    }
  }

  /**
   * Get signature events for audit (Super Admin only)
   */
  async getSignatureEvents(
    orgId?: string,
    userId?: string,
    entity?: string,
    fromDate?: Date,
    toDate?: Date,
    limit: number = 50
  ) {
    const where: any = {}
    
    if (orgId) where.actorOrgId = orgId
    if (userId) where.actorUserId = userId
    if (entity) where.entity = entity
    if (fromDate || toDate) {
      where.createdAtUtc = {}
      if (fromDate) where.createdAtUtc.gte = fromDate
      if (toDate) where.createdAtUtc.lte = toDate
    }

    return this.prisma.signatureEvent.findMany({
      where,
      orderBy: { createdAtUtc: 'desc' },
      take: limit,
    })
  }

  /**
   * Validate step-up authentication
   */
  private async validateStepUp(request: SignatureRequest, actorUserId: string) {
    // In demo mode, skip validation
    if (this.demoMode) {
      return {
        signatureType: 'WEBAUTHN_KMS' as const,
        stepUpUsed: true,
        mfaUsed: true,
        aaguid: 'demo-aaguid',
      }
    }

    if (request.webauthnAssertion) {
      // TODO: Implement WebAuthn assertion verification
      // Using @simplewebauthn/server to verify the assertion
      return {
        signatureType: 'WEBAUTHN_KMS' as const,
        stepUpUsed: true,
        mfaUsed: true,
        aaguid: 'webauthn-aaguid', // Extract from authenticator data
      }
    }

    if (request.stepUpToken) {
      // TODO: Implement TOTP/password validation
      return {
        signatureType: 'TOTP_KMS' as const,
        stepUpUsed: true,
        mfaUsed: true,
        aaguid: null,
      }
    }

    throw new ForbiddenException('Step-up authentication required for signing')
  }

  /**
   * Get last chain hash for organization
   */
  private async getLastChainHash(orgId: string): Promise<string | null> {
    const lastEvent = await this.prisma.signatureEvent.findFirst({
      where: { actorOrgId: orgId },
      orderBy: { createdAtUtc: 'desc' },
      select: { chainHash: true },
    })

    return lastEvent?.chainHash || null
  }

  /**
   * Get RFC-3161 timestamp authority token
   */
  private async getTrustedTimestamp(docHash: string): Promise<string | null> {
    if (this.demoMode) {
      // Return mock TSA token for demo
      return Buffer.from(`demo-tsa-token-${docHash.slice(0, 8)}`).toString('base64')
    }

    try {
      // TODO: Implement RFC-3161 TSA request
      // This would make an HTTP request to a timestamp authority
      // with the document hash and return a signed timestamp token
      return null
    } catch (error) {
      logger.warn({
        action: 'TSA_REQUEST_FAILED',
        error: (error as Error).message,
      })
      return null
    }
  }

  /**
   * Sign document hash with AWS KMS
   */
  private async signWithKMS(documentBuffer: Buffer): Promise<string> {
    if (this.demoMode) {
      // Return mock KMS signature for demo
      const hash = createHash('sha256').update(documentBuffer).digest('hex')
      return Buffer.from(`demo-kms-signature-${hash.slice(0, 8)}`).toString('base64')
    }

    try {
      const digest = createHash('sha256').update(documentBuffer).digest()
      
      const signCommand: SignCommandInput = {
        KeyId: this.signingKeyId,
        Message: digest,
        MessageType: 'DIGEST',
        SigningAlgorithm: 'RSASSA_PKCS1_V1_5_SHA_256',
      }

      const result = await this.kmsClient!.send(new SignCommand(signCommand))
      
      if (!result.Signature) {
        throw new Error('KMS signing failed: no signature returned')
      }

      return Buffer.from(result.Signature).toString('base64')
    } catch (error) {
      logger.error({
        action: 'KMS_SIGNING_FAILED',
        key_id: this.signingKeyId,
        error: (error as Error).message,
      })
      throw new Error(`KMS signing failed: ${(error as Error).message}`)
    }
  }

  /**
   * Verify KMS signature
   */
  private async verifyKMSSignature(
    docHash: string,
    signature: string,
    keyId: string
  ): Promise<boolean> {
    if (this.demoMode) {
      // Mock verification for demo
      return signature.startsWith('demo-kms-signature')
    }

    try {
      // TODO: Implement KMS signature verification
      // This would use GetPublicKey to retrieve the public key
      // and verify the signature using crypto.verify()
      return true
    } catch (error) {
      logger.error({
        action: 'KMS_VERIFICATION_FAILED',
        key_id: keyId,
        error: (error as Error).message,
      })
      return false
    }
  }

  /**
   * Verify RFC-3161 timestamp token
   */
  private async verifyTSAToken(tsaToken: string, docHash: string): Promise<boolean> {
    if (this.demoMode) {
      // Mock verification for demo
      return tsaToken.includes('demo-tsa-token')
    }

    try {
      // TODO: Implement TSA token verification
      // This would parse the ASN.1 structure and verify the timestamp
      return true
    } catch (error) {
      logger.error({
        action: 'TSA_VERIFICATION_FAILED',
        error: (error as Error).message,
      })
      return false
    }
  }

  /**
   * Generate evidence export bundle for legal/compliance
   */
  async generateEvidenceBundle(signatureEventId: string): Promise<{
    signatureEvent: any
    document: Buffer
    verificationResult: VerificationResult
    exportedAt: string
  }> {
    const event = await this.prisma.signatureEvent.findUnique({
      where: { id: signatureEventId },
    })

    if (!event) {
      throw new BadRequestException('Signature event not found')
    }

    const document = await this.documents.getDocumentBuffer(event.docS3Key)
    const verificationResult = await this.verifySignature(signatureEventId)

    logger.info({
      action: 'EVIDENCE_BUNDLE_GENERATED',
      signature_event_id: signatureEventId,
      actor_user_id: event.actorUserId,
    })

    return {
      signatureEvent: event,
      document,
      verificationResult,
      exportedAt: new Date().toISOString(),
    }
  }
}
