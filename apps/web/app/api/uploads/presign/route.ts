export const runtime = 'nodejs'

import { NextRequest } from 'next/server'
import { withCORS, handleOptions } from '@/app/api/_lib/cors'
import { json, badRequest, internalError } from '@/app/api/_lib/responses'
import { PresignUploadSchema } from '@/app/api/_lib/validation'
import { requireAuth, AuthError, Role } from '@/app/api/_lib/rbac'
import { ensureBootstrap } from '@/app/api/_lib/bootstrap'
import { getEnv } from '@/lib/server/env'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import { serverLogger } from '@/lib/server/logger'

const allowedRoles: Role[] = ['ADMIN', 'CLINICIAN']

let s3Client: S3Client | null = null

function getS3(): S3Client {
  if (!s3Client) {
    const env = getEnv()
    s3Client = new S3Client({ region: env.AWS_REGION })
  }
  return s3Client
}

export function OPTIONS(req: NextRequest) {
  return handleOptions(req)
}

export const POST = withCORS(async (req: NextRequest) => {
  await ensureBootstrap()

  try {
    const { claims } = await requireAuth(req, allowedRoles)

    const payload = await req.json()
    const parsed = PresignUploadSchema.safeParse(payload)
    if (!parsed.success) {
      return badRequest('Invalid payload', parsed.error.flatten())
    }

    const env = getEnv()
    const key = `clinician-uploads/${claims.sub}/${Date.now()}-${randomUUID()}-${parsed.data.filename}`

    const url = await getSignedUrl(getS3(), new PutObjectCommand({
      Bucket: env.AWS_S3_UPLOAD_BUCKET,
      Key: key,
      ContentType: parsed.data.contentType,
      ACL: 'private',
      ServerSideEncryption: 'aws:kms',
    }), { expiresIn: 300 })

    return json({ url, key })
  } catch (error) {
    if (error instanceof AuthError) {
      return json({ error: error.message }, { status: error.status })
    }
    serverLogger.error('Presign upload failed', { error })
    return internalError()
  }
})
