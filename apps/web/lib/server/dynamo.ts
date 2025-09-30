import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { getEnv } from './env'

let docClient: DynamoDBDocumentClient | null = null

export function getDynamoClient(): DynamoDBDocumentClient {
  if (docClient) return docClient
  const env = getEnv()
  const base = new DynamoDBClient({
    region: env.AWS_REGION,
    maxAttempts: 3,
  })
  docClient = DynamoDBDocumentClient.from(base, {
    marshallOptions: { removeUndefinedValues: true },
  })
  return docClient
}


