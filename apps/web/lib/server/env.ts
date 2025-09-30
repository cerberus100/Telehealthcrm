import { z } from 'zod'

const EnvSchema = z.object({
  AWS_REGION: z.string().min(1, 'AWS_REGION is required'),
  AWS_DYNAMO_TABLE: z.string().min(1, 'AWS_DYNAMO_TABLE is required'),
  AWS_DYNAMO_GSI1: z.string().min(1, 'AWS_DYNAMO_GSI1 is required'),
  AWS_AUDIT_TABLE: z.string().min(1, 'AWS_AUDIT_TABLE is required'),
  AWS_S3_UPLOAD_BUCKET: z.string().min(1, 'AWS_S3_UPLOAD_BUCKET is required'),
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
    AWS_DYNAMO_TABLE: process.env.AWS_DYNAMO_TABLE,
    AWS_DYNAMO_GSI1: process.env.AWS_DYNAMO_GSI1,
    AWS_AUDIT_TABLE: process.env.AWS_AUDIT_TABLE,
    AWS_S3_UPLOAD_BUCKET: process.env.AWS_S3_UPLOAD_BUCKET,
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
    throw new Error(`Invalid environment configuration: ${details}`)
  }

  cachedEnv = parsed.data
  return cachedEnv
}
