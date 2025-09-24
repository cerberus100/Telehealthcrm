import { Injectable, Inject, Logger, NotFoundException, BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { v4 as uuidv4 } from 'uuid'
import { BaseService } from './base.service'

export interface RxPadTemplate {
  id: string
  providerId: string
  orgId: string
  name: string
  description?: string
  s3Key: string
  s3Url: string
  cloudfrontUrl: string
  fileSize: number
  mimeType: string
  isActive: boolean
  isDefault: boolean
  createdAt: string
  updatedAt: string
  createdBy: string
}

export interface RxPadUpload {
  providerId: string
  orgId: string
  name: string
  description?: string
  file: Buffer
  mimeType: string
  fileSize: number
  isDefault?: boolean
  uploadedBy: string
}

@Injectable()
export class RxPadService extends BaseService {
  private readonly logger = new Logger(RxPadService.name)
  private readonly s3: S3Client
  private readonly cloudfront: CloudFrontClient
  private readonly bucketName: string
  private readonly cloudfrontDistributionId: string
  private readonly region: string

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService
  ) {
    super({} as any) // We'll implement proper Prisma injection later

    this.region = this.configService.get<string>('AWS_REGION', 'us-east-1')
    this.bucketName = this.configService.get<string>('S3_RX_PAD_BUCKET', 'telehealth-rx-pads')
    this.cloudfrontDistributionId = this.configService.get<string>('CLOUDFRONT_DISTRIBUTION_ID', '')

    // Initialize AWS clients
    this.s3 = new S3Client({
      region: this.region
    })

    this.cloudfront = new CloudFrontClient({
      region: this.region
    })

    this.logger.log({
      action: 'RX_PAD_SERVICE_INITIALIZED',
      region: this.region,
      bucketName: this.bucketName,
      cloudfrontDistributionId: this.cloudfrontDistributionId || 'not configured'
    })
  }

  /**
   * Upload an Rx pad template
   */
  async uploadRxPadTemplate(upload: RxPadUpload): Promise<RxPadTemplate> {
    try {
      const templateId = uuidv4()
      const now = new Date().toISOString()

      // Generate S3 key
      const s3Key = `templates/${upload.orgId}/${upload.providerId}/${templateId}-${upload.name.replace(/[^a-zA-Z0-9]/g, '_')}`
      const cloudfrontUrl = this.cloudfrontDistributionId
        ? `https://${this.cloudfrontDistributionId}.cloudfront.net/${s3Key}`
        : `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${s3Key}`

      // Upload to S3
      const uploadCommand = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        Body: upload.file,
        ContentType: upload.mimeType,
        Metadata: {
          'provider-id': upload.providerId,
          'org-id': upload.orgId,
          'template-name': upload.name,
          'uploaded-by': upload.uploadedBy,
          'is-default': String(upload.isDefault || false),
        },
        Tagging: `Environment=${this.configService.get('NODE_ENV', 'development')}&Type=RxPadTemplate`
      })

      const uploadResult = await this.s3.send(uploadCommand)

      // If this is set as default, unset any existing default for this provider
      if (upload.isDefault) {
        await this.unsetDefaultTemplate(upload.providerId, upload.orgId)
      }

      const template: RxPadTemplate = {
        id: templateId,
        providerId: upload.providerId,
        orgId: upload.orgId,
        name: upload.name,
        description: upload.description,
        s3Key,
        s3Url: `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${s3Key}`,
        cloudfrontUrl,
        fileSize: upload.fileSize,
        mimeType: upload.mimeType,
        isActive: true,
        isDefault: upload.isDefault || false,
        createdAt: now,
        updatedAt: now,
        createdBy: upload.uploadedBy
      }

      this.logger.log({
        action: 'RX_PAD_TEMPLATE_UPLOADED',
        templateId,
        providerId: upload.providerId,
        orgId: upload.orgId,
        name: upload.name,
        fileSize: upload.fileSize,
        mimeType: upload.mimeType,
        s3Key
      })

      return template
    } catch (error) {
      this.logger.error({
        action: 'RX_PAD_UPLOAD_ERROR',
        providerId: upload.providerId,
        orgId: upload.orgId,
        error: (error as Error).message
      })
      throw new BadRequestException('Failed to upload Rx pad template')
    }
  }

  /**
   * Get Rx pad templates for a provider
   */
  async getProviderTemplates(providerId: string, orgId: string): Promise<RxPadTemplate[]> {
    try {
      const prefix = `templates/${orgId}/${providerId}/`

      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix
      })

      const response = await this.s3.send(listCommand)

      if (!response.Contents) {
        return []
      }

      const templates: RxPadTemplate[] = []

      for (const object of response.Contents) {
        if (!object.Key) continue

        // Get object metadata
        const headCommand = new GetObjectCommand({
          Bucket: this.bucketName,
          Key: object.Key
        })

        try {
          const headResponse = await this.s3.send(headCommand)

          // Parse metadata
          const metadata = headResponse.Metadata || {}
          const isDefault = metadata['is-default'] === 'true'

          const cloudfrontUrl = this.cloudfrontDistributionId
            ? `https://${this.cloudfrontDistributionId}.cloudfront.net/${object.Key}`
            : `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${object.Key}`

          const template: RxPadTemplate = {
            id: object.Key.split('/').pop()?.split('-')[0] || 'unknown',
            providerId,
            orgId,
            name: metadata['template-name'] || 'Unnamed Template',
            description: metadata['description'],
            s3Key: object.Key,
            s3Url: `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${object.Key}`,
            cloudfrontUrl,
            fileSize: object.Size || 0,
            mimeType: headResponse.ContentType || 'application/octet-stream',
            isActive: true,
            isDefault,
            createdAt: object.LastModified?.toISOString() || new Date().toISOString(),
            updatedAt: object.LastModified?.toISOString() || new Date().toISOString(),
            createdBy: metadata['uploaded-by'] || 'system'
          }

          templates.push(template)
        } catch (error) {
          this.logger.warn({
            action: 'RX_PAD_TEMPLATE_METADATA_ERROR',
            s3Key: object.Key,
            error: (error as Error).message
          })
          continue
        }
      }

      // Sort by default first, then by name
      templates.sort((a, b) => {
        if (a.isDefault && !b.isDefault) return -1
        if (!a.isDefault && b.isDefault) return 1
        return a.name.localeCompare(b.name)
      })

      this.logger.log({
        action: 'RX_PAD_TEMPLATES_RETRIEVED',
        providerId,
        orgId,
        templatesCount: templates.length
      })

      return templates
    } catch (error) {
      this.logger.error({
        action: 'GET_PROVIDER_TEMPLATES_ERROR',
        providerId,
        orgId,
        error: (error as Error).message
      })
      throw new BadRequestException('Failed to get Rx pad templates')
    }
  }

  /**
   * Get a specific Rx pad template
   */
  async getRxPadTemplate(providerId: string, templateId: string): Promise<RxPadTemplate | null> {
    try {
      const templates = await this.getProviderTemplates(providerId, '') // We'll filter by templateId
      return templates.find(t => t.id === templateId) || null
    } catch (error) {
      this.logger.error({
        action: 'GET_RX_PAD_TEMPLATE_ERROR',
        providerId,
        templateId,
        error: (error as Error).message
      })
      throw error
    }
  }

  /**
   * Set a template as default for a provider
   */
  async setDefaultTemplate(providerId: string, orgId: string, templateId: string): Promise<void> {
    try {
      // First, get all templates for the provider
      const templates = await this.getProviderTemplates(providerId, orgId)

      // Find the template to set as default
      const template = templates.find(t => t.id === templateId)
      if (!template) {
        throw new NotFoundException('Rx pad template not found')
      }

      // Unset all defaults for this provider
      await this.unsetDefaultTemplate(providerId, orgId)

      // Set the new default
      const updateCommand = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: template.s3Key,
        Metadata: {
          ...Object.fromEntries(Object.entries(template).map(([k, v]) => [k, String(v)])),
          'is-default': 'true'
        },
        Tagging: `Environment=${this.configService.get('NODE_ENV', 'development')}&Type=RxPadTemplate&IsDefault=true`
      })

      await this.s3.send(updateCommand)

      // Invalidate CloudFront cache if configured
      if (this.cloudfrontDistributionId) {
        await this.invalidateCloudFrontCache([template.s3Key])
      }

      this.logger.log({
        action: 'RX_PAD_DEFAULT_SET',
        providerId,
        orgId,
        templateId,
        templateName: template.name
      })
    } catch (error) {
      this.logger.error({
        action: 'SET_DEFAULT_TEMPLATE_ERROR',
        providerId,
        orgId,
        templateId,
        error: (error as Error).message
      })
      throw error
    }
  }

  /**
   * Unset default template for a provider
   */
  private async unsetDefaultTemplate(providerId: string, orgId: string): Promise<void> {
    try {
      const templates = await this.getProviderTemplates(providerId, orgId)
      const defaultTemplate = templates.find(t => t.isDefault)

      if (defaultTemplate) {
        const updateCommand = new PutObjectCommand({
          Bucket: this.bucketName,
          Key: defaultTemplate.s3Key,
          Metadata: {
            ...Object.fromEntries(Object.entries(defaultTemplate).map(([k, v]) => [k, String(v)])),
            'is-default': 'false'
          },
          Tagging: `Environment=${this.configService.get('NODE_ENV', 'development')}&Type=RxPadTemplate&IsDefault=false`
        })

        await this.s3.send(updateCommand)
      }
    } catch (error) {
      this.logger.warn({
        action: 'UNSET_DEFAULT_TEMPLATE_WARNING',
        providerId,
        orgId,
        error: (error as Error).message
      })
      // Don't throw error for unset default - it's not critical
    }
  }

  /**
   * Delete an Rx pad template
   */
  async deleteRxPadTemplate(providerId: string, orgId: string, templateId: string): Promise<void> {
    try {
      const templates = await this.getProviderTemplates(providerId, orgId)
      const template = templates.find(t => t.id === templateId)

      if (!template) {
        throw new NotFoundException('Rx pad template not found')
      }

      // Delete from S3
      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: template.s3Key
      })

      await this.s3.send(deleteCommand)

      // If it was the default template, clear the default flag
      if (template.isDefault) {
        // We don't need to update metadata since the object is deleted
        this.logger.log({
          action: 'RX_PAD_DEFAULT_DELETED',
          providerId,
          orgId,
          templateId,
          templateName: template.name
        })
      }

      // Invalidate CloudFront cache if configured
      if (this.cloudfrontDistributionId) {
        await this.invalidateCloudFrontCache([template.s3Key])
      }

      this.logger.log({
        action: 'RX_PAD_TEMPLATE_DELETED',
        providerId,
        orgId,
        templateId,
        templateName: template.name,
        s3Key: template.s3Key
      })
    } catch (error) {
      this.logger.error({
        action: 'DELETE_RX_PAD_TEMPLATE_ERROR',
        providerId,
        orgId,
        templateId,
        error: (error as Error).message
      })
      throw error
    }
  }

  /**
   * Generate a signed URL for accessing an Rx pad template
   */
  async generateTemplateSignedUrl(providerId: string, orgId: string, templateId: string): Promise<string> {
    try {
      const templates = await this.getProviderTemplates(providerId, orgId)
      const template = templates.find(t => t.id === templateId)

      if (!template) {
        throw new NotFoundException('Rx pad template not found')
      }

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: template.s3Key
      })

      const signedUrl = await getSignedUrl(this.s3, command, { expiresIn: 3600 }) // 1 hour

      this.logger.debug({
        action: 'RX_PAD_SIGNED_URL_GENERATED',
        providerId,
        orgId,
        templateId,
        s3Key: template.s3Key
      })

      return signedUrl
    } catch (error) {
      this.logger.error({
        action: 'GENERATE_TEMPLATE_SIGNED_URL_ERROR',
        providerId,
        orgId,
        templateId,
        error: (error as Error).message
      })
      throw new BadRequestException('Failed to generate template signed URL')
    }
  }

  /**
   * Invalidate CloudFront cache for specific paths
   */
  private async invalidateCloudFrontCache(paths: string[]): Promise<void> {
    if (!this.cloudfrontDistributionId) {
      this.logger.debug({
        action: 'CLOUDFRONT_INVALIDATION_SKIPPED',
        reason: 'CloudFront distribution ID not configured',
        paths
      })
      return
    }

    try {
      const command = new CreateInvalidationCommand({
        DistributionId: this.cloudfrontDistributionId,
        InvalidationBatch: {
          CallerReference: `rx-pad-invalidation-${Date.now()}`,
          Paths: {
            Quantity: paths.length,
            Items: paths.map(path => `/${path}`)
          }
        }
      })

      await this.cloudfront.send(command)

      this.logger.log({
        action: 'CLOUDFRONT_INVALIDATION_CREATED',
        distributionId: this.cloudfrontDistributionId,
        paths,
        invalidationCount: paths.length
      })
    } catch (error) {
      this.logger.error({
        action: 'CLOUDFRONT_INVALIDATION_ERROR',
        distributionId: this.cloudfrontDistributionId,
        paths,
        error: (error as Error).message
      })
      // Don't throw error - cache invalidation failure shouldn't break the main operation
    }
  }

  /**
   * Get storage statistics for monitoring
   */
  async getStorageStats(): Promise<{
    totalTemplates: number
    totalSize: number
    templatesByOrg: Record<string, number>
    templatesByProvider: Record<string, number>
  }> {
    try {
      const stats = {
        totalTemplates: 0,
        totalSize: 0,
        templatesByOrg: {} as Record<string, number>,
        templatesByProvider: {} as Record<string, number>
      }

      let continuationToken: string | undefined

      do {
        const listCommand = new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: 'templates/',
          ContinuationToken: continuationToken
        })

        const response = await this.s3.send(listCommand)

        if (response.Contents) {
          for (const object of response.Contents) {
            if (!object.Key) continue

            stats.totalTemplates++
            stats.totalSize += object.Size || 0

            // Parse key to extract org and provider info
            const keyParts = object.Key.split('/')
            if (keyParts.length >= 3) {
              const orgId = keyParts[1]
              const providerId = keyParts[2]

              stats.templatesByOrg[orgId] = (stats.templatesByOrg[orgId] || 0) + 1
              stats.templatesByProvider[providerId] = (stats.templatesByProvider[providerId] || 0) + 1
            }
          }
        }

        continuationToken = response.NextContinuationToken
      } while (continuationToken)

      this.logger.log({
        action: 'RX_PAD_STORAGE_STATS_RETRIEVED',
        ...stats
      })

      return stats
    } catch (error) {
      this.logger.error({
        action: 'GET_STORAGE_STATS_ERROR',
        error: (error as Error).message
      })
      throw new BadRequestException('Failed to get storage statistics')
    }
  }
}
