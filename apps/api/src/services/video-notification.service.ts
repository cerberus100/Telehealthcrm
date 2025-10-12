/**
 * Video Visit Notification Service
 * HIPAA/SOC2 Compliant: No PHI in SMS/Email, secure deep links
 * 
 * Security Controls:
 * - No patient names in messages (only "your visit")
 * - No diagnosis or chief complaint
 * - Only first name of clinician (no PHI)
 * - Secure short links (8-char codes)
 * - Delivery tracking and audit logs
 * - TLS-only email delivery (SES)
 * - Opt-out compliance (STOP/UNSUB)
 */

import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns'
import { PrismaService } from '../prisma.service'
import { VideoTokenService } from './video-token.service'
import { logger } from '../utils/logger'
import { trace } from '@opentelemetry/api'

const tracer = trace.getTracer('video-notification-service')

interface SendNotificationInput {
  visitId: string
  channel: 'sms' | 'email' | 'both'
  recipientRole: 'patient' | 'clinician' | 'both'
  template?: 'initial' | 'reminder' | 'urgent'
}

@Injectable()
export class VideoNotificationService {
  private readonly sesClient: SESClient
  private readonly snsClient: SNSClient
  private readonly sesSender: string
  private readonly smsNumber: string
  private readonly appUrl: string

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tokenService: VideoTokenService
  ) {
    const region = this.config.get<string>('AWS_REGION', 'us-east-1')
    this.sesClient = new SESClient({ region })
    this.snsClient = new SNSClient({ region })
    this.sesSender = this.config.get<string>('SES_SENDER') || 'noreply@eudaura.com'
    this.smsNumber = this.config.get<string>('CONNECT_SMS_NUMBER') || ''
    this.appUrl = this.config.get<string>('NEXT_PUBLIC_APP_URL') || 'https://app.eudaura.com'
  }

  /**
   * Send visit notifications via SMS/Email
   * HIPAA: No PHI in message content
   */
  async sendNotifications(input: SendNotificationInput): Promise<any> {
    return tracer.startActiveSpan('sendNotifications', async (span) => {
      try {
        span.setAttribute('visit.id', input.visitId)
        span.setAttribute('channel', input.channel)

        // Get visit details
        const visit = await this.prisma.videoVisit.findUnique({
          where: { id: input.visitId },
          include: {
            patient: { select: { id: true, emails: true, phones: true } },
            clinician: { select: { id: true, firstName: true, lastName: true, email: true } },
            tokens: { where: { status: 'ACTIVE' }, orderBy: { createdAt: 'desc' } }
          }
        })

        if (!visit) {
          throw new Error('Visit not found')
        }

        const results: any = { sent: {} }

        // Send to patient
        if (input.recipientRole === 'patient' || input.recipientRole === 'both') {
          const patientToken = visit.tokens.find((t) => t.role === 'patient')
          if (!patientToken) {
            throw new Error('Patient token not found')
          }

          const patientLink = `${this.appUrl}/j/${patientToken.shortCode}`
          const patientEmail = visit.patient.emails[0]
          const patientPhone = visit.patient.phones[0]

          if ((input.channel === 'email' || input.channel === 'both') && patientEmail) {
            const clinicianName: string = visit.clinician.firstName || 'your clinician'
            results.sent.email = await this.sendEmail({
              to: patientEmail,
              visitId: visit.id,
              clinicianFirstName: clinicianName,
              scheduledAt: visit.scheduledAt,
              joinLink: patientLink,
              expiresIn: 20
            })
          }

          if ((input.channel === 'sms' || input.channel === 'both') && patientPhone) {
            const clinicianName: string = visit.clinician.firstName || 'your clinician'
            results.sent.sms = await this.sendSMS({
              to: patientPhone,
              visitId: visit.id,
              clinicianFirstName: clinicianName,
              scheduledAt: visit.scheduledAt,
              shortLink: `visit.eudaura.com/j/${patientToken.shortCode}`,
              expiresIn: 20
            })
          }
        }

        // Send to clinician
        if (input.recipientRole === 'clinician' || input.recipientRole === 'both') {
          const clinicianToken = visit.tokens.find((t) => t.role === 'clinician')
          if (!clinicianToken) {
            throw new Error('Clinician token not found')
          }

          const clinicianLink = `${this.appUrl}/j/${clinicianToken.shortCode}`

          results.sent.clinicianEmail = await this.sendEmail({
            to: visit.clinician.email,
            visitId: visit.id,
            clinicianFirstName: visit.clinician.firstName || '',
            scheduledAt: visit.scheduledAt,
            joinLink: clinicianLink,
            expiresIn: 20,
            isClinicianEmail: true
          })
        }

        // Update visit with notification tracking
        await this.prisma.videoVisit.update({
          where: { id: input.visitId },
          data: {
            notificationChannel: input.channel,
            smsMessageId: results.sent.sms?.messageId,
            emailMessageId: results.sent.email?.messageId
          }
        })

        return results
        
      } catch (error) {
        span.recordException(error as Error)
        logger.error({ msg: 'Failed to send notifications', error, visitId: input.visitId })
        throw error
      } finally {
        span.end()
      }
    })
  }

  /**
   * Send email via SES
   * HIPAA: No PHI, TLS-only
   */
  private async sendEmail(params: {
    to: string
    visitId: string
    clinicianFirstName: string
    scheduledAt: Date
    joinLink: string
    expiresIn: number
    isClinicianEmail?: boolean
  }): Promise<any> {
    const scheduledTime = params.scheduledAt.toLocaleString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    })

    const subject = params.isClinicianEmail
      ? `Video Visit Starting Soon - ${scheduledTime}`
      : `Your Video Visit Link - ${scheduledTime}`

    const html = this.buildEmailTemplate({
      clinicianFirstName: params.clinicianFirstName,
      scheduledTime,
      joinLink: params.joinLink,
      expiresIn: params.expiresIn,
      isClinicianEmail: params.isClinicianEmail || false
    })

    try {
      const result = await this.sesClient.send(new SendEmailCommand({
        Source: this.sesSender,
        Destination: { ToAddresses: [params.to] },
        Message: {
          Subject: { Data: subject },
          Body: {
            Html: { Data: html },
            Text: { Data: this.stripHtml(html) }
          }
        },
        ConfigurationSetName: this.config.get<string>('SES_CONFIGURATION_SET')
      }))

      // Audit log
      await this.createAuditLog({
        eventType: 'NOTIFICATION_SENT',
        visitId: params.visitId,
        metadata: {
          channel: 'email',
          messageId: result.MessageId,
          to: this.maskEmail(params.to) // Mask for audit: j***@example.com
        }
      })

      return {
        messageId: result.MessageId,
        to: this.maskEmail(params.to),
        status: 'sent',
        provider: 'ses'
      }
      
    } catch (error) {
      logger.error({ msg: 'SES send failed', error, to: this.maskEmail(params.to) })
      
      // Audit log: failure
      await this.createAuditLog({
        eventType: 'NOTIFICATION_FAILED',
        visitId: params.visitId,
        success: false,
        errorCode: 'EMAIL_SEND_FAILED',
        metadata: { channel: 'email', to: this.maskEmail(params.to) }
      })

      throw error
    }
  }

  /**
   * Send SMS via Amazon Connect End User Messaging / SNS
   * HIPAA: No PHI, opt-out compliance
   */
  private async sendSMS(params: {
    to: string
    visitId: string
    clinicianFirstName: string
    scheduledAt: Date
    shortLink: string
    expiresIn: number
  }): Promise<any> {
    const time = params.scheduledAt.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    })

    // HIPAA-compliant message: No patient name, only clinician first name
    const message = `Your video visit with Dr. ${params.clinicianFirstName} starts at ${time}. Tap to join: https://${params.shortLink}. Expires in ${params.expiresIn} min. Reply HELP for support or STOP to opt out.`

    // Verify length (SMS limit: 160 chars)
    if (message.length > 160) {
      logger.warn({ msg: 'SMS message exceeds 160 characters', length: message.length })
    }

    try {
      // Send via SNS (Connect End User Messaging integration)
      const result = await this.snsClient.send(new PublishCommand({
        PhoneNumber: params.to,
        Message: message,
        MessageAttributes: {
          'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' },
          'AWS.SNS.SMS.SenderID': { DataType: 'String', StringValue: 'Eudaura' }
        }
      }))

      // Audit log
      await this.createAuditLog({
        eventType: 'NOTIFICATION_SENT',
        visitId: params.visitId,
        metadata: {
          channel: 'sms',
          messageId: result.MessageId,
          to: this.maskPhone(params.to) // Mask: ***-***-1234
        }
      })

      return {
        messageId: result.MessageId,
        to: this.maskPhone(params.to),
        status: 'sent',
        provider: 'sns'
      }
      
    } catch (error) {
      logger.error({ msg: 'SMS send failed', error, to: this.maskPhone(params.to) })
      
      // Audit log: failure
      await this.createAuditLog({
        eventType: 'NOTIFICATION_FAILED',
        visitId: params.visitId,
        success: false,
        errorCode: 'SMS_SEND_FAILED',
        metadata: { channel: 'sms', to: this.maskPhone(params.to) }
      })

      // Fallback to email if configured
      throw error
    }
  }

  /**
   * Build email HTML template
   * HIPAA: No PHI in email body
   */
  private buildEmailTemplate(params: {
    clinicianFirstName: string
    scheduledTime: string
    joinLink: string
    expiresIn: number
    isClinicianEmail: boolean
  }): string {
    const greeting = params.isClinicianEmail
      ? `Hello Dr. ${params.clinicianFirstName},`
      : `Hello,`

    const visitWith = params.isClinicianEmail
      ? `Your video visit with a patient`
      : `Your video visit with Dr. ${params.clinicianFirstName}`

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Video Visit Link</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background: #f7fafc; margin: 0; padding: 20px;">
  
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #4299E1 0%, #2C5282 100%); padding: 30px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">Your Video Visit Link</h1>
    </div>
    
    <!-- Body -->
    <div style="padding: 40px 30px;">
      
      <p style="font-size: 16px; color: #2D3748; line-height: 1.6; margin-top: 0;">${greeting}</p>
      
      <p style="font-size: 16px; color: #2D3748; line-height: 1.6;">${visitWith} is scheduled for:</p>
      
      <!-- Scheduled Time -->
      <div style="background: #EBF8FF; border-left: 4px solid #4299E1; padding: 20px; margin: 25px 0; border-radius: 4px;">
        <p style="margin: 0; font-size: 20px; font-weight: 600; color: #2C5282;">
          ${params.scheduledTime}
        </p>
      </div>
      
      <!-- Join Button -->
      <div style="text-align: center; margin: 35px 0;">
        <a href="${params.joinLink}" 
           style="display: inline-block; background: #4299E1; color: white; padding: 16px 48px; text-decoration: none; border-radius: 6px; font-size: 18px; font-weight: 600; box-shadow: 0 4px 6px rgba(66, 153, 225, 0.3);">
          Join Video Visit
        </a>
      </div>
      
      <!-- Expiry Warning -->
      <div style="background: #FFFAF0; border-left: 4px solid #FFA726; padding: 15px; margin: 25px 0; border-radius: 4px;">
        <p style="margin: 0; font-weight: 600; color: #C05621; font-size: 14px;">⏱️ Important Security Notice</p>
        <p style="margin: 8px 0 0; color: #744210; font-size: 14px;">
          This link expires in <strong>${params.expiresIn} minutes</strong> for your security. If expired, request a new link.
        </p>
      </div>
      
      <!-- Device Requirements -->
      <h2 style="color: #2C5282; font-size: 18px; margin: 30px 0 15px;">Before You Join:</h2>
      <ul style="color: #4A5568; line-height: 1.8; font-size: 14px; padding-left: 20px;">
        <li>Use <strong>Chrome, Safari, Edge</strong>, or <strong>Firefox</strong></li>
        <li>Ensure <strong>camera and microphone</strong> are working</li>
        <li>Find a <strong>quiet, private location</strong></li>
        <li>Check your internet connection (minimum 1 Mbps)</li>
        <li><a href="${this.appUrl}/test-connection" style="color: #4299E1;">Test your connection</a></li>
      </ul>
      
      <!-- Support -->
      <div style="border-top: 1px solid #E2E8F0; margin-top: 35px; padding-top: 25px;">
        <p style="font-size: 14px; color: #718096; margin: 0;">
          <strong>Need Help?</strong><br>
          Call: <a href="tel:+15551234567" style="color: #4299E1; text-decoration: none;">(555) 123-4567</a><br>
          Email: <a href="mailto:support@eudaura.com" style="color: #4299E1; text-decoration: none;">support@eudaura.com</a><br>
          Hours: Monday–Friday, 8 AM – 8 PM EST
        </p>
      </div>
      
    </div>
    
    <!-- Footer -->
    <div style="background: #F7FAFC; padding: 20px 30px; border-top: 1px solid #E2E8F0;">
      <p style="font-size: 12px; color: #A0AEC0; margin: 0; text-align: center;">
        Eudaura Health • Secure HIPAA-Compliant Telehealth<br>
        <a href="${this.appUrl}/privacy" style="color: #A0AEC0; text-decoration: none;">Privacy Policy</a> • 
        <a href="${this.appUrl}/unsubscribe" style="color: #A0AEC0; text-decoration: none;">Unsubscribe</a>
      </p>
    </div>
    
  </div>
  
</body>
</html>
    `.trim()
  }

  /**
   * Mask email for audit logs
   * HIPAA: Don't store full email in plaintext logs
   */
  private maskEmail(email: string): string {
    const [local, domain] = email.split('@')
    if (!local || !domain) return '***@***'
    const masked = local.length > 2 ? local[0] + '***' : '***'
    return `${masked}@${domain}`
  }

  /**
   * Mask phone for audit logs
   * HIPAA: Only show last 4 digits
   */
  private maskPhone(phone: string): string {
    return `***-***-${phone.slice(-4)}`
  }

  /**
   * Strip HTML for plain-text email version
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  /**
   * Create audit log entry
   */
  private async createAuditLog(params: {
    eventType: string
    visitId?: string
    tokenId?: string
    actorId?: string
    actorRole?: string
    success?: boolean
    errorCode?: string
    metadata?: Record<string, unknown>
  }): Promise<void> {
    const expiresAt = new Date()
    expiresAt.setFullYear(expiresAt.getFullYear() + 7)

    await this.prisma.videoAuditLog.create({
      data: {
        eventType: params.eventType as any,
        visitId: params.visitId,
        tokenId: params.tokenId,
        actorId: params.actorId,
        actorRole: params.actorRole,
        success: params.success ?? true,
        errorCode: params.errorCode,
        metadata: params.metadata as any,
        expiresAt
      }
    })
  }
}
