import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'
import { getEnv } from './env'
import { serverLogger } from './logger'

let client: SESClient | null = null

function getSES(): SESClient {
  if (client) return client
  const env = getEnv()
  client = new SESClient({ region: env.AWS_REGION })
  return client
}

interface EmailParams {
  to: string
  subject: string
  html: string
}

export async function sendEmail(params: EmailParams): Promise<void> {
  const env = getEnv()
  if (!env.SES_SENDER) {
    serverLogger.warn('SES sender not configured; skipping email send', { to: params.to, subject: params.subject })
    return
  }

  const ses = getSES()
  try {
    await ses.send(new SendEmailCommand({
      Source: env.SES_SENDER,
      Destination: { ToAddresses: [params.to] },
      Message: {
        Subject: { Data: params.subject },
        Body: { Html: { Data: params.html } },
      },
    }))
  } catch (error) {
    serverLogger.error('SES send failed', { error, to: params.to })
    throw error
  }
}


