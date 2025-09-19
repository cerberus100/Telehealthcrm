import { Injectable, Inject, forwardRef } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { logger } from '../utils/logger'
import { normalizePhone, getPhoneDigits, findRecentConsult, findRecentIntake, upsertPatientConsult, findIntakeLinkByDid } from '../integrations/connect/connect-lambda'
import { NotificationGateway } from '../websocket/notification.gateway'

@Injectable()
export class ConnectService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => NotificationGateway))
    private readonly gateway: NotificationGateway
  ) {}

  async identifyConsult(params: { ani: string; dnis: string; contactId: string }) {
    try {
      const { ani, dnis, contactId } = params
      const normalizedAni = normalizePhone(ani)
      
      if (!normalizedAni) {
        return { action: 'no_ani', error: 'Invalid caller ID format' }
      }

      // Find intake link by DID
      const intakeLink = await findIntakeLinkByDid(dnis)
      
      // Look for recent consult (24hr window)
      const consult = await findRecentConsult({ 
        ani: normalizedAni, 
        intakeLink, 
        windowHrs: 24 
      })
      
      let target: any
      if (consult) {
        target = {
          consultId: consult.id,
          patientId: consult.patientId,
          serviceMode: intakeLink?.services || 'BOTH',
          clientId: intakeLink?.clientIds?.[0] || null,
          marketerOrgId: intakeLink?.marketerOrgId || null
        }
      } else {
        // Look for recent intake submission
        const intake = await findRecentIntake({ 
          ani: normalizedAni, 
          intakeLink, 
          windowHrs: 24 
        })
        target = await upsertPatientConsult({ 
          ani: normalizedAni, 
          intake, 
          intakeLink 
        })
      }

      // Log the inbound call
      await (this.prisma as any).inboundCall?.create({
        data: {
          contactId,
          dnis: dnis || '',
          ani: normalizedAni,
          marketerOrgId: target.marketerOrgId,
          clientId: target.clientId,
          consultId: target.consultId,
          startedAt: new Date()
        }
      })

      // Find available provider based on patient state and provider licensing
      const availableProvider = await this.findAvailableProvider(target.patientId, target.clientId)
      
      // Trigger real-time screen-pop for available providers
      if (availableProvider && target.clientId) {
        this.gateway.emitScreenPop(target.clientId, {
          consultId: target.consultId,
          contactId,
          callerName: target.patientName || 'Unknown Caller',
          callerPhone: normalizedAni,
          serviceMode: target.serviceMode
        })
      }
      
      logger.info({
        action: 'CONNECT_IDENTIFY_SUCCESS',
        ani: normalizedAni,
        dnis,
        consultId: target.consultId,
        availableProvider: availableProvider?.id,
        screenPopSent: !!availableProvider
      })

      return {
        ...target,
        assignedProviderId: availableProvider?.id,
        queueName: availableProvider ? `provider_${availableProvider.id}` : 'general_queue'
      }
    } catch (error) {
      logger.error({
        action: 'CONNECT_IDENTIFY_FAILED',
        error: (error as Error).message,
        ani: params.ani,
        dnis: params.dnis
      })
      return { action: 'error', error: (error as Error).message }
    }
  }

  async attachCallNotes(params: { contactId: string; consultId: string; transcriptS3Key: string; recordingS3Key?: string }) {
    try {
      // Update the inbound call record with transcript/recording
      await (this.prisma as any).inboundCall?.updateMany({
        where: { contactId: params.contactId },
        data: {
          transcriptS3Key: params.transcriptS3Key,
          recordingS3Key: params.recordingS3Key,
          endedAt: new Date()
        }
      })

      // Attach redacted notes to the consult
      await (this.prisma as any).consult?.update({
        where: { id: params.consultId },
        data: {
          callNotes: `Transcript: ${params.transcriptS3Key}`,
          updatedAt: new Date()
        }
      })

      logger.info({
        action: 'CALL_NOTES_ATTACHED',
        consultId: params.consultId,
        contactId: params.contactId
      })

      return { success: true }
    } catch (error) {
      logger.error({
        action: 'ATTACH_CALL_NOTES_FAILED',
        error: (error as Error).message,
        consultId: params.consultId
      })
      throw error
    }
  }

  // Find available provider based on patient state and licensing
  private async findAvailableProvider(patientId: string, clientId?: string): Promise<any | null> {
    try {
      // Get patient state from consult/intake
      const patient = await (this.prisma as any).patient?.findUnique({
        where: { id: patientId },
        select: { address: true, orgId: true }
      })
      
      const patientState = patient?.address?.state || 'UNKNOWN'
      
      // Find available providers licensed in patient's state
      const providers = await (this.prisma as any).user?.findMany({
        where: {
          role: 'DOCTOR',
          isActive: true,
          isAvailable: true,
          statesLicensed: {
            path: '$',
            array_contains: [patientState]
          },
          ...(clientId && { orgId: clientId })
        },
        orderBy: { lastLoginAt: 'desc' }
      })

      return providers?.[0] || null
    } catch (error) {
      logger.error({
        action: 'FIND_PROVIDER_FAILED',
        error: (error as Error).message,
        patientId
      })
      return null
    }
  }

  // Provider availability management
  async setProviderAvailability(userId: string, available: boolean) {
    try {
      const updated = await (this.prisma as any).user?.update({
        where: { id: userId },
        data: { isAvailable: available, updatedAt: new Date() }
      })

      // Broadcast availability change to org
      const user = await (this.prisma as any).user?.findUnique({
        where: { id: userId },
        select: { orgId: true, firstName: true, lastName: true }
      })
      
      if (user) {
        this.gateway.emitProviderAvailability(
          user.orgId, 
          userId, 
          available, 
          `${user.firstName} ${user.lastName}`
        )
      }

      logger.info({
        action: 'PROVIDER_AVAILABILITY_CHANGED',
        userId,
        available,
        audit: true
      })

      return updated
    } catch (error) {
      logger.error({
        action: 'SET_AVAILABILITY_FAILED',
        error: (error as Error).message,
        userId
      })
      throw error
    }
  }
}
