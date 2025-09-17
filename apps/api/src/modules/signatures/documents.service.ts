import { Injectable, BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { createHash } from 'crypto'
import { PrismaService } from '../../prisma.service'
import { logger } from '../../utils/logger'

@Injectable()
export class DocumentsService {
  private readonly s3Client: S3Client | null
  private readonly bucketName: string
  private readonly demoMode: boolean

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {
    this.demoMode = this.config.get<string>('API_DEMO_MODE') === 'true'
    this.bucketName = this.config.get<string>('S3_DOCUMENTS_BUCKET') || 'demo-documents-bucket'
    
    if (!this.demoMode) {
      this.s3Client = new S3Client({
        region: this.config.get<string>('AWS_REGION', 'us-east-1'),
      })
    } else {
      this.s3Client = null
    }
  }

  /**
   * Store document in S3 WORM bucket and create index entry
   */
  async storeDocument(
    documentBuffer: Buffer,
    patientId: string,
    category: 'RX' | 'LAB_ORDER' | 'DOCUMENT',
    title: string,
    createdBy: string
  ): Promise<string> {
    try {
      const sha256 = createHash('sha256').update(documentBuffer).digest('hex')
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const s3Key = `patients/${patientId}/docs/${category.toLowerCase()}/${timestamp}-${sha256.slice(0, 8)}.pdf`

      if (!this.demoMode) {
        // Store in S3 with Object Lock (WORM)
        const putCommand = new PutObjectCommand({
          Bucket: this.bucketName,
          Key: s3Key,
          Body: documentBuffer,
          ContentType: 'application/pdf',
          ServerSideEncryption: 'aws:kms',
          SSEKMSKeyId: this.config.get<string>('KMS_DOCUMENTS_KEY_ID'),
          Metadata: {
            'patient-id': patientId,
            'category': category,
            'created-by': createdBy,
            'sha256': sha256,
          },
          ObjectLockMode: 'GOVERNANCE', // WORM protection
          ObjectLockRetainUntilDate: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000), // 7 years
        })

        await this.s3Client!.send(putCommand)
      }

      // Create document index entry
      const document = await this.prisma.document.create({
        data: {
          patientId,
          category: category as any,
          title,
          createdBy,
          s3Key,
          sha256,
          sizeBytes: documentBuffer.length,
          mimeType: 'application/pdf',
        },
      })

      logger.info({
        action: 'DOCUMENT_STORED',
        document_id: document.id,
        patient_id: patientId,
        category,
        s3_key: s3Key,
        sha256,
        size_bytes: documentBuffer.length,
      })

      return s3Key
    } catch (error) {
      logger.error({
        action: 'DOCUMENT_STORE_FAILED',
        patient_id: patientId,
        category,
        error: (error as Error).message,
      })
      throw error
    }
  }

  /**
   * Retrieve document buffer from S3
   */
  async getDocumentBuffer(s3Key: string): Promise<Buffer> {
    if (this.demoMode) {
      // Return mock PDF buffer for demo
      return Buffer.from(`Mock PDF content for ${s3Key}`)
    }

    try {
      const getCommand = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      })

      const result = await this.s3Client!.send(getCommand)
      
      if (!result.Body) {
        throw new Error('Document not found or empty')
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = []
      const reader = result.Body as any
      
      for await (const chunk of reader) {
        chunks.push(chunk)
      }

      return Buffer.concat(chunks)
    } catch (error) {
      logger.error({
        action: 'DOCUMENT_RETRIEVE_FAILED',
        s3_key: s3Key,
        error: (error as Error).message,
      })
      throw error
    }
  }

  /**
   * Get patient documents with category filter
   */
  async getPatientDocuments(
    patientId: string,
    category?: string,
    limit: number = 50
  ) {
    const where: any = { patientId }
    if (category) where.category = category

    return this.prisma.document.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }

  /**
   * Generate signed URL for document access (audit trail)
   */
  async getDocumentSignedUrl(
    documentId: string,
    userId: string,
    purposeOfUse: string
  ): Promise<string> {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
    })

    if (!document) {
      throw new BadRequestException('Document not found')
    }

    // Log document access for audit
    logger.info({
      action: 'DOCUMENT_ACCESSED',
      document_id: documentId,
      user_id: userId,
      purpose_of_use: purposeOfUse,
      s3_key: document.s3Key,
    })

    if (this.demoMode) {
      return `https://demo-bucket.s3.amazonaws.com/${document.s3Key}?expires=3600`
    }

    // TODO: Generate presigned URL with expiration
    // const getObjectParams = {
    //   Bucket: this.bucketName,
    //   Key: document.s3Key,
    //   Expires: 3600, // 1 hour
    // }
    // return getSignedUrl(this.s3Client, new GetObjectCommand(getObjectParams))
    
    return `https://${this.bucketName}.s3.amazonaws.com/${document.s3Key}`
  }
}
