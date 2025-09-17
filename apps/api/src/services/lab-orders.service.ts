import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { RequestClaims } from '../types/claims'
import { logger } from '../utils/logger'
import crypto from 'crypto'

@Injectable()
export class LabOrdersService {
  private demo: boolean
  private memory: Map<string, any>

  constructor(private readonly prisma: PrismaService) {
    this.demo = process.env.API_DEMO_MODE === 'true'
    this.memory = new Map()
  }

  async createLabOrder(body: any, claims: RequestClaims) {
    try {
      const id = crypto.randomUUID()
      
      const labOrder = {
        id,
        patientId: body.patientId,
        consultId: body.consultId,
        orgId: claims.orgId,
        labOrgId: 'demo-lab-org', // Would be selected based on tests/location
        tests: body.tests,
        status: 'DRAFT',
        kitShipping: body.kitShipping || null,
        createdByUserId: claims.sub,
        createdAt: new Date().toISOString()
      }

      if (this.demo) {
        this.memory.set(id, labOrder)
      } else {
        await (this.prisma as any).labOrder?.create({ data: labOrder })
      }

      // If kit shipping required, create UPS label (would integrate with UPS API)
      if (body.kitShipping) {
        const shipmentId = crypto.randomUUID()
        const shipment = {
          id: shipmentId,
          labOrderId: id,
          carrier: 'UPS',
          trackingNumber: `1Z999AA${Math.floor(Math.random() * 100000000)}`,
          status: 'LABEL_CREATED',
          shipTo: body.kitShipping,
          createdAt: new Date().toISOString()
        }
        
        if (this.demo) {
          this.memory.set(`shipment_${shipmentId}`, shipment)
        }
      }

      logger.info({
        action: 'LAB_ORDER_CREATED',
        labOrderId: id,
        patientId: body.patientId,
        tests: body.tests,
        hasShipping: !!body.kitShipping,
        orgId: claims.orgId,
        audit: true
      })

      return labOrder
    } catch (error) {
      logger.error({
        action: 'CREATE_LAB_ORDER_FAILED',
        error: (error as Error).message,
        patientId: body.patientId,
        orgId: claims.orgId
      })
      throw error
    }
  }

  async listLabOrders(query: any, claims: RequestClaims) {
    try {
      if (this.demo) {
        const items = Array.from(this.memory.values()).filter(
          order => order.orgId === claims.orgId &&
          (!query.patientId || order.patientId === query.patientId) &&
          (!query.status || order.status === query.status)
        )
        return { items: items.slice(0, query.limit), next_cursor: null }
      }

      const items = await (this.prisma as any).labOrder?.findMany({
        where: {
          orgId: claims.orgId,
          ...(query.patientId && { patientId: query.patientId }),
          ...(query.status && { status: query.status })
        },
        orderBy: { createdAt: 'desc' },
        take: query.limit
      })

      return { items: items || [], next_cursor: null }
    } catch (error) {
      logger.error({
        action: 'LIST_LAB_ORDERS_FAILED',
        error: (error as Error).message,
        orgId: claims.orgId
      })
      throw error
    }
  }

  async getLabOrder(id: string, claims: RequestClaims) {
    try {
      if (this.demo) {
        const item = this.memory.get(id)
        if (!item || item.orgId !== claims.orgId) {
          throw new Error('Lab order not found')
        }
        return item
      }

      const item = await (this.prisma as any).labOrder?.findFirst({
        where: { id, orgId: claims.orgId },
        include: {
          patient: { select: { legalName: true, dob: true } },
          shipments: true
        }
      })

      if (!item) throw new Error('Lab order not found')

      logger.info({
        action: 'LAB_ORDER_VIEWED',
        labOrderId: id,
        orgId: claims.orgId,
        userId: claims.sub,
        audit: true
      })

      return item
    } catch (error) {
      logger.error({
        action: 'GET_LAB_ORDER_FAILED',
        error: (error as Error).message,
        labOrderId: id,
        orgId: claims.orgId
      })
      throw error
    }
  }
}
