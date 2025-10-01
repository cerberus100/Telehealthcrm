import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { randomUUID } from 'crypto'
import { getDynamoClient } from './dynamo'
import { getEnv } from './env'

export type TeleUserRole = 'PATIENT' | 'CLINICIAN' | 'ADMIN'

type BaseUserRecord = {
  pk: string
  sk: string
  role: TeleUserRole
  contact?: {
    email?: string
    phone?: string
  }
  profile?: Record<string, unknown>
  requestId?: string
  createdAt: string
  updatedAt: string
}

export interface PatientUserRecord extends BaseUserRecord {
  role: 'PATIENT'
  patientState: 'PENDING_CONTACT_VERIFICATION' | 'PROVISIONED' | 'ACTIVE'
  allowedStates?: string[]
}

export interface ClinicianUserRecord extends BaseUserRecord {
  role: 'CLINICIAN'
  clinicianState: 'INVITED' | 'ACTIVE'
  allowedStates?: string[]
}

export type TeleUserRecord = PatientUserRecord | ClinicianUserRecord | (BaseUserRecord & { role: 'ADMIN' })

const indexKey = (id: string) => `USER#${id}`

export function userIdFromContact(contact: string): string {
  return Buffer.from(contact.trim().toLowerCase()).toString('base64url')
}

export async function getUser(id: string): Promise<TeleUserRecord | null> {
  const env = getEnv()
  const client = getDynamoClient()
  const res = await client.send(new GetCommand({
    TableName: env.DYNAMO_TABLE_NAME,
    Key: {
      pk: indexKey(id),
      sk: 'PROFILE',
    },
  }))
  return (res.Item as TeleUserRecord | undefined) ?? null
}

export async function putUser(id: string, record: Omit<TeleUserRecord, 'pk' | 'sk' | 'createdAt' | 'updatedAt'>): Promise<TeleUserRecord> {
  const env = getEnv()
  const client = getDynamoClient()
  const now = new Date().toISOString()
  const item = {
    pk: indexKey(id),
    sk: 'PROFILE',
    ...record,
    createdAt: now,
    updatedAt: now,
  } as TeleUserRecord

  await client.send(new PutCommand({
    TableName: env.DYNAMO_TABLE_NAME,
    Item: item,
    ConditionExpression: 'attribute_not_exists(pk)',
  }))

  return item
}

export async function updateUserState(id: string, state: Partial<Pick<PatientUserRecord, 'patientState' | 'allowedStates'>>): Promise<void> {
  const env = getEnv()
  const client = getDynamoClient()
  const updates: string[] = []
  const names: Record<string, string> = {}
  const values: Record<string, unknown> = {
    ':updatedAt': new Date().toISOString(),
  }

  if (state.patientState) {
    updates.push('#patientState = :patientState')
    names['#patientState'] = 'patientState'
    values[':patientState'] = state.patientState
  }
  if (state.allowedStates) {
    updates.push('#allowedStates = :allowedStates')
    names['#allowedStates'] = 'allowedStates'
    values[':allowedStates'] = state.allowedStates
  }

  if (!updates.length) return

  updates.push('#updatedAt = :updatedAt')
  names['#updatedAt'] = 'updatedAt'

  await client.send(new UpdateCommand({
    TableName: env.DYNAMO_TABLE_NAME,
    Key: { pk: indexKey(id), sk: 'PROFILE' },
    UpdateExpression: `SET ${updates.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }))
}

export interface ClinicianUserUpsertInput {
  id: string
  allowedStates: string[]
  contact: { email: string; phone?: string }
  profile?: Record<string, unknown>
  clinicianState: ClinicianUserRecord['clinicianState']
}

export async function upsertClinicianUser(input: ClinicianUserUpsertInput): Promise<void> {
  const env = getEnv()
  const client = getDynamoClient()
  const now = new Date().toISOString()

  await client.send(new UpdateCommand({
    TableName: env.DYNAMO_TABLE_NAME,
    Key: { pk: indexKey(input.id), sk: 'PROFILE' },
    UpdateExpression: 'SET #role = :role, #clinicianState = :clinicianState, #allowedStates = :allowedStates, #contact = :contact, #profile = :profile, #updatedAt = :updatedAt, #createdAt = if_not_exists(#createdAt, :createdAt)',
    ExpressionAttributeNames: {
      '#role': 'role',
      '#clinicianState': 'clinicianState',
      '#allowedStates': 'allowedStates',
      '#contact': 'contact',
      '#profile': 'profile',
      '#updatedAt': 'updatedAt',
      '#createdAt': 'createdAt',
    },
    ExpressionAttributeValues: {
      ':role': 'CLINICIAN',
      ':clinicianState': input.clinicianState,
      ':allowedStates': input.allowedStates,
      ':contact': input.contact,
      ':profile': input.profile ?? {},
      ':updatedAt': now,
      ':createdAt': now,
    },
  }))
}

export async function ensureSeedAdmin(email: string): Promise<void> {
  const env = getEnv()
  const client = getDynamoClient()

  const adminId = `admin-${email}`
  const pk = indexKey(adminId)
  const existing = await client.send(new GetCommand({
    TableName: env.DYNAMO_TABLE_NAME,
    Key: { pk, sk: 'PROFILE' },
  }))

  if (existing.Item) return

  const now = new Date().toISOString()
  await client.send(new PutCommand({
    TableName: env.DYNAMO_TABLE_NAME,
    Item: {
      pk,
      sk: 'PROFILE',
      role: 'ADMIN',
      contact: { email },
      createdAt: now,
      updatedAt: now,
    },
    ConditionExpression: 'attribute_not_exists(pk)',
  }))
}

export function createPatientId(): string {
  return randomUUID()
}

export function createClinicianAppId(): string {
  return randomUUID()
}
