import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { createHash } from 'crypto'
import { logger } from '../../utils/logger'

@Injectable()
export class S3EvidenceService {
  private readonly s3Client: S3Client | null
  private readonly evidenceBucket: string
  private readonly demoMode: boolean

  constructor(private readonly config: ConfigService) {
    this.demoMode = this.config.get<string>('API_DEMO_MODE') === 'true'
    this.evidenceBucket = this.config.get<string>('S3_EVIDENCE_BUCKET') || 'demo-evidence-bucket'
    
    if (!this.demoMode) {
      this.s3Client = new S3Client({
        region: this.config.get<string>('AWS_REGION', 'us-east-1'),
      })
    } else {
      this.s3Client = null
    }
  }

  /**
   * Append SignatureEvent to WORM JSONL evidence store
   */
  async appendSignatureEvent(signatureEvent: any): Promise<void> {
    try {
      const date = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
      const s3Key = `signature-events/${date}/events.jsonl`
      
      // Convert SignatureEvent to JSONL record
      const jsonlRecord = JSON.stringify({
        ...signatureEvent,
        // Convert Bytes to base64 for JSON serialization
        tsaToken: signatureEvent.tsaToken ? signatureEvent.tsaToken.toString('base64') : null,
        kmsSignature: signatureEvent.kmsSignature.toString('base64'),
        createdAtUtc: signatureEvent.createdAtUtc.toISOString(),
        _evidenceType: 'SignatureEvent',
        _version: '1.0',
      }) + '\n'

      if (!this.demoMode) {
        // Append to S3 JSONL file with Object Lock
        const putCommand = new PutObjectCommand({
          Bucket: this.evidenceBucket,
          Key: s3Key,
          Body: jsonlRecord,
          ContentType: 'application/x-ndjson',
          ServerSideEncryption: 'aws:kms',
          SSEKMSKeyId: this.config.get<string>('KMS_EVIDENCE_KEY_ID'),
          Metadata: {
            'event-id': signatureEvent.id,
            'actor-org-id': signatureEvent.actorOrgId,
            'entity': signatureEvent.entity,
            'signature-type': signatureEvent.signatureType,
          },
          ObjectLockMode: 'GOVERNANCE',
          ObjectLockRetainUntilDate: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000), // 7 years
        })

        await this.s3Client!.send(putCommand)
      }

      logger.info({
        action: 'SIGNATURE_EVENT_ARCHIVED',
        signature_event_id: signatureEvent.id,
        s3_key: s3Key,
        evidence_bucket: this.evidenceBucket,
      })
    } catch (error) {
      logger.error({
        action: 'SIGNATURE_EVENT_ARCHIVE_FAILED',
        signature_event_id: signatureEvent.id,
        error: (error as Error).message,
      })
      // Don't throw - evidence archival failure shouldn't block signing
    }
  }

  /**
   * Append audit event to WORM evidence store
   */
  async appendAuditEvent(auditEvent: any): Promise<void> {
    try {
      const date = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
      const s3Key = `audit-events/${date}/events.jsonl`
      
      const jsonlRecord = JSON.stringify({
        ...auditEvent,
        _evidenceType: 'AuditEvent',
        _version: '1.0',
        _archivedAt: new Date().toISOString(),
      }) + '\n'

      if (!this.demoMode) {
        const putCommand = new PutObjectCommand({
          Bucket: this.evidenceBucket,
          Key: s3Key,
          Body: jsonlRecord,
          ContentType: 'application/x-ndjson',
          ServerSideEncryption: 'aws:kms',
          SSEKMSKeyId: this.config.get<string>('KMS_EVIDENCE_KEY_ID'),
          ObjectLockMode: 'GOVERNANCE',
          ObjectLockRetainUntilDate: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000), // 7 years
        })

        await this.s3Client!.send(putCommand)
      }

      logger.debug({
        action: 'AUDIT_EVENT_ARCHIVED',
        audit_event_id: auditEvent.id,
        s3_key: s3Key,
      })
    } catch (error) {
      logger.error({
        action: 'AUDIT_EVENT_ARCHIVE_FAILED',
        audit_event_id: auditEvent.id,
        error: (error as Error).message,
      })
    }
  }

  /**
   * Create tamper-evident evidence bundle
   */
  async createEvidenceBundle(
    signatureEventId: string,
    signatureEvent: any,
    documentBuffer: Buffer,
    verificationResult: any
  ): Promise<Buffer> {
    try {
      const bundle = {
        signatureEvent,
        verificationResult,
        metadata: {
          bundleId: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          bundleVersion: '1.0',
          bundleType: 'SignatureEvidence',
        },
        // Document included as base64 for JSON serialization
        document: {
          content: documentBuffer.toString('base64'),
          sha256: createHash('sha256').update(documentBuffer).digest('hex'),
          sizeBytes: documentBuffer.length,
        },
      }

      const bundleJson = JSON.stringify(bundle, null, 2)
      const bundleBuffer = Buffer.from(bundleJson, 'utf8')

      logger.info({
        action: 'EVIDENCE_BUNDLE_CREATED',
        signature_event_id: signatureEventId,
        bundle_size_bytes: bundleBuffer.length,
      })

      return bundleBuffer
    } catch (error) {
      logger.error({
        action: 'EVIDENCE_BUNDLE_CREATION_FAILED',
        signature_event_id: signatureEventId,
        error: (error as Error).message,
      })
      throw error
    }
  }
}
