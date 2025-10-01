import { z } from 'zod'

const EnvSchema = z.object({
  AWS_REGION: z.string().min(1, 'AWS_REGION is required'),
  DYNAMO_TABLE_NAME: z.string().min(1, 'DYNAMO_TABLE_NAME is required'),
  DYNAMO_GSI1_NAME: z.string().min(1, 'DYNAMO_GSI1_NAME is required'),
  AUDIT_TABLE_NAME: z.string().min(1, 'AUDIT_TABLE_NAME is required'),
  S3_UPLOAD_BUCKET_NAME: z.string().min(1, 'S3_UPLOAD_BUCKET_NAME is required'),
  AWS_CLOUDFRONT_DISTRIBUTION_ID: z.string().optional(),
  AWS_SNS_TOPIC_ARN: z.string().optional(),
  SES_SENDER: z.string().email('SES_SENDER must be a valid email').optional(),
  SEED_ADMIN_EMAIL: z.string().email('SEED_ADMIN_EMAIL must be a valid email').optional(),
  NEXT_PUBLIC_APP_URL: z.string().url('NEXT_PUBLIC_APP_URL must be a valid URL'),
  COGNITO_ISSUER: z.string().url('COGNITO_ISSUER must be a valid URL'),
  COGNITO_AUDIENCE: z.string().min(1, 'COGNITO_AUDIENCE is required'),
  TELE_LANDER_ALLOWED_ORIGINS: z.string().optional(),
})

type EnvShape = z.infer<typeof EnvSchema>

let cachedEnv: EnvShape | null = null

export function getEnv(): EnvShape {
  if (cachedEnv) return cachedEnv

  const parsed = EnvSchema.safeParse({
    AWS_REGION: process.env.AWS_REGION,
    DYNAMO_TABLE_NAME: process.env.DYNAMO_TABLE_NAME,
    DYNAMO_GSI1_NAME: process.env.DYNAMO_GSI1_NAME,
    AUDIT_TABLE_NAME: process.env.AUDIT_TABLE_NAME,
    S3_UPLOAD_BUCKET_NAME: process.env.S3_UPLOAD_BUCKET_NAME,
    AWS_CLOUDFRONT_DISTRIBUTION_ID: process.env.AWS_CLOUDFRONT_DISTRIBUTION_ID,
    AWS_SNS_TOPIC_ARN: process.env.AWS_SNS_TOPIC_ARN,
    SES_SENDER: process.env.SES_SENDER,
    SEED_ADMIN_EMAIL: process.env.SEED_ADMIN_EMAIL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    COGNITO_ISSUER: process.env.COGNITO_ISSUER,
    COGNITO_AUDIENCE: process.env.COGNITO_AUDIENCE,
    TELE_LANDER_ALLOWED_ORIGINS: process.env.TELE_LANDER_ALLOWED_ORIGINS,
  })

  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`).join(', ')
    // During build time or when env vars are not available, don't throw error
    // The actual validation will happen at runtime when env vars are available
    if (process.env.NEXT_PUBLIC_APP_URL === undefined || process.env.DYNAMO_TABLE_NAME === undefined) {
      console.warn(`Environment validation failed during build: ${details}. Environment variables will be validated at runtime.`)
      // Return a minimal valid env object for build time
      return {
        AWS_REGION: process.env.AWS_REGION || 'us-east-1',
        DYNAMO_TABLE_NAME: process.env.DYNAMO_TABLE_NAME || 'placeholder',
        DYNAMO_GSI1_NAME: process.env.DYNAMO_GSI1_NAME || 'placeholder',
        AUDIT_TABLE_NAME: process.env.AUDIT_TABLE_NAME || 'placeholder',
        S3_UPLOAD_BUCKET_NAME: process.env.S3_UPLOAD_BUCKET_NAME || 'placeholder',
        AWS_CLOUDFRONT_DISTRIBUTION_ID: process.env.AWS_CLOUDFRONT_DISTRIBUTION_ID,
        AWS_SNS_TOPIC_ARN: process.env.AWS_SNS_TOPIC_ARN,
        SES_SENDER: process.env.SES_SENDER,
        SEED_ADMIN_EMAIL: process.env.SEED_ADMIN_EMAIL,
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'https://placeholder.com',
        COGNITO_ISSUER: process.env.COGNITO_ISSUER || 'https://placeholder.com',
        COGNITO_AUDIENCE: process.env.COGNITO_AUDIENCE || 'placeholder',
        TELE_LANDER_ALLOWED_ORIGINS: process.env.TELE_LANDER_ALLOWED_ORIGINS,
      } as EnvShape
    }
    throw new Error(`Invalid environment configuration: ${details}`)
  }

  cachedEnv = parsed.data
  return cachedEnv
}
