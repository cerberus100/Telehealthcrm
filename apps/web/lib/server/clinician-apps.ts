import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { randomUUID } from 'crypto'
import { getDynamoClient } from './dynamo'
import { getEnv } from './env'

export type ClinicianAppStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'DENIED'

export interface ClinicianApplication {
  pk: string
  sk: 'META'
  appId: string
  status: ClinicianAppStatus
  identity: {
    fullName: string
    email: string
    phone: string
    npi: string
  }
  licenses: Array<{
    state: string
    licenseNumber: string
    expirationDate: string
    docKey?: string
  }>
  documents?: {
    malpracticeKey?: string
    deaKey?: string
    extras?: string[]
  }
  flags: {
    pecosEnrolled: boolean
    modalities: string[]
    specialties: string[]
    dea?: {
      number: string
      state: string
    }
  }
  derived: {
    allowedStates: string[]
  }
  createdAt: string
  updatedAt: string
  adminNotes: Array<{
    actorUserId: string
    action: ClinicianAppStatus
    notes?: string
    timestamp: string
  }>
}

const keyFor = (id: string) => `APP#${id}`

function deriveAllowedStates(licenses: ClinicianApplication['licenses']): string[] {
  const states = new Set<string>()
  for (const license of licenses) {
    if (license.state) states.add(license.state)
  }
  return Array.from(states)
}

export function toListView(app: ClinicianApplication) {
  return {
    appId: app.appId,
    fullName: app.identity.fullName,
    npi: app.identity.npi,
    states: app.derived.allowedStates,
    pecos: app.flags.pecosEnrolled,
    createdAt: app.createdAt,
  }
}

export async function putClinicianApplication(payload: Omit<ClinicianApplication, 'pk' | 'sk' | 'appId' | 'status' | 'createdAt' | 'updatedAt' | 'adminNotes' | 'derived'> & { status?: ClinicianAppStatus }): Promise<ClinicianApplication> {
  const env = getEnv()
  const client = getDynamoClient()
  const now = new Date().toISOString()
  const appId = randomUUID()

  const item: ClinicianApplication = {
    pk: keyFor(appId),
    sk: 'META',
    appId,
    status: payload.status ?? 'SUBMITTED',
    identity: payload.identity,
    licenses: payload.licenses,
    documents: payload.documents,
    flags: payload.flags,
    derived: {
      allowedStates: deriveAllowedStates(payload.licenses),
    },
    createdAt: now,
    updatedAt: now,
    adminNotes: [],
  }

  await client.send(new PutCommand({
    TableName: env.DYNAMO_TABLE_NAME,
    Item: item,
    ConditionExpression: 'attribute_not_exists(pk)',
  }))

  return item
}

export async function listClinicianApplications(status: ClinicianAppStatus): Promise<ClinicianApplication[]> {
  const env = getEnv()
  const client = getDynamoClient()
  const res = await client.send(new QueryCommand({
    TableName: env.DYNAMO_TABLE_NAME,
    IndexName: env.DYNAMO_GSI1_NAME,
    KeyConditionExpression: '#status = :status',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':status': status },
  }))
  return (res.Items as ClinicianApplication[] | undefined) ?? []
}

export async function getClinicianApplication(appId: string): Promise<ClinicianApplication | null> {
  const env = getEnv()
  const client = getDynamoClient()
  const res = await client.send(new GetCommand({
    TableName: env.DYNAMO_TABLE_NAME,
    Key: { pk: keyFor(appId), sk: 'META' },
  }))
  return (res.Item as ClinicianApplication | undefined) ?? null
}

export async function updateClinicianApplicationStatus(appId: string, status: ClinicianAppStatus, actorUserId: string, notes?: string): Promise<void> {
  const env = getEnv()
  const client = getDynamoClient()
  const now = new Date().toISOString()
  await client.send(new UpdateCommand({
    TableName: env.DYNAMO_TABLE_NAME,
    Key: { pk: keyFor(appId), sk: 'META' },
    UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt, #adminNotes = list_append(if_not_exists(#adminNotes, :emptyList), :note)',
    ExpressionAttributeNames: {
      '#status': 'status',
      '#updatedAt': 'updatedAt',
      '#adminNotes': 'adminNotes',
    },
    ExpressionAttributeValues: {
      ':status': status,
      ':updatedAt': now,
      ':note': [{ actorUserId, action: status, notes, timestamp: now }],
      ':emptyList': [],
    },
  }))
}
