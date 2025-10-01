import { PutCommand } from '@aws-sdk/lib-dynamodb'
import { randomUUID } from 'crypto'
import { getDynamoClient } from './dynamo'
import { getEnv } from './env'
import { serverLogger } from './logger'

type AuditAction =
  | 'PATIENT_PROVISIONAL_SUBMITTED'
  | 'PATIENT_VERIFIED'
  | 'CLINICIAN_APPLY_SUBMITTED'
  | 'CLINICIAN_STATUS_CHANGED'
  | 'INVITE_SENT'

interface AuditEntry {
  actorUserId?: string
  actorRole?: string
  action: AuditAction
  target?: string
  metadata?: Record<string, unknown>
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  const env = getEnv()
  const dynamo = getDynamoClient()
  const id = randomUUID()
  const ts = new Date().toISOString()

  const item = {
    pk: `AUDIT#${id}`,
    sk: `TS#${ts}`,
    actorUserId: entry.actorUserId ?? 'system',
    actorRole: entry.actorRole ?? 'SYSTEM',
    action: entry.action,
    target: entry.target ?? 'global',
    metadata: entry.metadata ?? {},
    createdAt: ts,
  }

  try {
    await dynamo.send(new PutCommand({
      TableName: env.AUDIT_TABLE_NAME,
      Item: item,
    }))
  } catch (error) {
    serverLogger.error('Failed to write audit entry', { error })
    throw error
  }
}
