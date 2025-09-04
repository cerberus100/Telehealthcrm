import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { RequestClaims } from '../types/claims'
import { ShipmentsQueryDto, ShipmentDto } from '../types/dto'

@Injectable()
export class ShipmentsService {
  constructor(private prisma: PrismaService) {}

  async getShipments(query: ShipmentsQueryDto, claims: RequestClaims) {
    const where: any = {
      orgId: claims.orgId,
    }

    if (query.consult_id) {
      where.labOrder = {
        consultId: query.consult_id,
      }
    }

    if (query.lab_order_id) {
      where.labOrderId = query.lab_order_id
    }

    const take = query.limit || 50

    const shipments = await this.prisma.shipment.findMany({
      where,
      take: take + 1,
      skip: query.cursor ? 1 : 0,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        labOrder: true,
      },
    })

    const hasNext = shipments.length > take
    const items = shipments.slice(0, take)

    const isMarketer = claims.role === 'MARKETER'
    const itemsResponse = items.map((shipment: any) => {
      const shipTo = shipment.shipTo as any
      const maskedShipTo = isMarketer
        ? {
            name: 'REDACTED',
            city: shipTo?.city,
            state: shipTo?.state,
            zip: shipTo?.zip,
          }
        : shipTo

      return {
        id: shipment.id,
        lab_order_id: shipment.labOrderId,
        carrier: shipment.carrier,
        tracking_number: shipment.trackingNumber,
        status: shipment.status,
        last_event_at: shipment.lastEventAt?.toISOString(),
        ship_to: maskedShipTo,
      }
    })

    const last = items.length > 0 ? items[items.length - 1] : null
    return {
      items: itemsResponse,
      next_cursor: hasNext && last ? last.id : null,
    }
  }
}
