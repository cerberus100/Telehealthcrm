import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { logger } from '../utils/logger'
import { normalizePhone, getPhoneDigits } from '../integrations/connect/connect-lambda'
import crypto from 'crypto'

@Injectable()
export class IntakeService {
  private demo: boolean
  private memory: Map<string, any>

  constructor(private readonly prisma: PrismaService) {
    this.demo = process.env.API_DEMO_MODE === 'true'
    this.memory = new Map()
  }

  async getFormConfig(linkId: string) {
    try {
      if (this.demo) {
        // Return demo config from localStorage or default
        return {
          linkId,
          services: 'BOTH',
          availableCategories: ['NEURO', 'IMMUNE'],
          branding: { logo: null, colors: { primary: '#007DB8' } }
        }
      }

      const link = await (this.prisma as any).intakeLink?.findUnique({
        where: { id: linkId, active: true }
      })

      if (!link) throw new Error('Intake link not found or inactive')

      return {
        linkId,
        services: link.services,
        availableCategories: link.services.includes('LABS') ? ['NEURO', 'IMMUNE'] : [],
        branding: { logo: null, colors: { primary: '#007DB8' } }
      }
    } catch (error) {
      logger.error({
        action: 'GET_FORM_CONFIG_FAILED',
        error: (error as Error).message,
        linkId
      })
      throw error
    }
  }

  async submitIntake(linkId: string, body: any) {
    try {
      const normalizedPhone = normalizePhone(body.phone)
      if (!normalizedPhone) throw new Error('Invalid phone number format')

      const submissionId = crypto.randomUUID()
      const consultId = crypto.randomUUID()
      const patientId = crypto.randomUUID()

      // Create intake submission
      const submission = {
        id: submissionId,
        intakeLinkId: linkId,
        marketerOrgId: 'demo-marketer-org',
        patientStub: {
          name: body.patientName,
          phone: normalizedPhone,
          email: body.email,
          dob: body.dob,
          state: body.state,
          medicareId: body.medicareId,
          address: body.address
        },
        serviceRequested: body.serviceRequested,
        triageJson: body.triageJson,
        consent: body.consent,
        ip: '127.0.0.1', // Would be from request in production
        userAgent: 'Demo Browser',
        status: 'PENDING',
        createdAt: new Date().toISOString()
      }

      // Create patient and consult
      const patient = {
        id: patientId,
        orgId: 'demo-provider-org',
        tenantUid: `intake_${submissionId}`,
        legalName: body.patientName,
        dob: new Date(body.dob),
        phones: [normalizedPhone],
        emails: body.email ? [body.email] : [],
        address: body.address || {},
        createdAt: new Date().toISOString()
      }

      const consult = {
        id: consultId,
        patientId,
        orgId: 'demo-provider-org',
        marketerOrgId: 'demo-marketer-org',
        status: 'PENDING',
        reasonCodes: [],
        createdFrom: 'WEB',
        triageData: body.triageJson,
        createdAt: new Date().toISOString()
      }

      if (this.demo) {
        this.memory.set(`submission_${submissionId}`, submission)
        this.memory.set(`patient_${patientId}`, patient)
        this.memory.set(`consult_${consultId}`, consult)
      } else {
        await (this.prisma as any).intakeSubmission?.create({ data: submission })
        await (this.prisma as any).patient?.create({ data: patient })
        await (this.prisma as any).consult?.create({ data: consult })
      }

      // Update phone index for fast lookup
      const phoneDigits = getPhoneDigits(normalizedPhone)
      if (!this.demo) {
        await (this.prisma as any).patientPhone?.create({
          data: {
            patientId,
            e164: normalizedPhone,
            digits10: phoneDigits.digits10,
            digits7: phoneDigits.digits7,
            type: 'MOBILE',
            primary: true
          }
        })
      }

      // Auto-create patient portal invite if email provided
      if (body.email) {
        const token = `pt_${crypto.randomBytes(16).toString('hex')}`
        const portalInvite = {
          token,
          patientId,
          patientName: body.patientName,
          email: body.email,
          link: `${process.env.FRONTEND_BASE_URL || 'http://127.0.0.1:3000'}/portal/login?token=${token}`,
          createdAt: new Date().toISOString()
        }
        
        if (this.demo) {
          this.memory.set(`invite_${token}`, portalInvite)
        }
        // In production: send email via SES
      }

      logger.info({
        action: 'INTAKE_SUBMITTED',
        submissionId,
        consultId,
        patientId,
        linkId,
        serviceRequested: body.serviceRequested,
        hasEmail: !!body.email,
        audit: true
      })

      return {
        consultId,
        status: 'PENDING',
        message: 'Intake submitted successfully. A clinician will review shortly.'
      }
    } catch (error) {
      logger.error({
        action: 'SUBMIT_INTAKE_FAILED',
        error: (error as Error).message,
        linkId
      })
      throw error
    }
  }
}
