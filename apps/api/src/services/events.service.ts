import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { RequestClaims } from '../types/claims'
import { logger } from '../utils/logger'

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async triggerScreenPop(body: any, claims: RequestClaims) {
    try {
      // In production, this would emit to WebSocket/EventBridge
      // For demo, we just log the screen-pop event
      
      logger.info({
        action: 'SCREEN_POP_TRIGGERED',
        consultId: body.consultId,
        contactId: body.contactId,
        callerPhone: body.callerInfo.phone.replace(/\d(?=\d{4})/g, '*'), // Mask phone
        serviceMode: body.callerInfo.serviceMode,
        targetOrgId: claims.orgId,
        audit: true
      })

      // Demo: simulate WebSocket emission
      const screenPopEvent = {
        type: 'INCOMING_CALL',
        consultId: body.consultId,
        contactId: body.contactId,
        caller: {
          name: body.callerInfo.name || 'Unknown Caller',
          phone: body.callerInfo.phone.replace(/\d(?=\d{4})/g, '*'),
          serviceMode: body.callerInfo.serviceMode
        },
        timestamp: new Date().toISOString()
      }

      // In production: emit to WebSocket gateway
      // await this.websocketGateway.emitToOrg(claims.orgId, 'screen-pop', screenPopEvent)

      return {
        success: true,
        event: screenPopEvent,
        message: 'Screen-pop triggered for available providers'
      }
    } catch (error) {
      logger.error({
        action: 'SCREEN_POP_FAILED',
        error: (error as Error).message,
        consultId: body.consultId,
        orgId: claims.orgId
      })
      throw error
    }
  }
}
