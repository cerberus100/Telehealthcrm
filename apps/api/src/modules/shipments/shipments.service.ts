import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../../prisma.service'
import { AuditService } from '../../audit/audit.service'
import { logger } from '../../utils/logger'
import { PhiRedactor } from '../../utils/phi-redactor'
import {
  CreateShipmentDto,
  UpdateShipmentDto,
  BulkCreateShipmentsDto,
  ShipmentsQueryDto,
  ShipmentResponseDto,
  ShipmentsListResponseDto,
  RefreshShipmentDto,
  Carrier,
  ShipmentStatus,
} from './dto/shipments.dto'

@Injectable()
export class ShipmentsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  /**
   * Create a new shipment
   */
  async createShipment(
    createShipmentDto: CreateShipmentDto,
    userId: string,
    orgId: string,
    correlationId: string,
  ): Promise<ShipmentResponseDto> {
    try {
      // Validate tracking number format
      this.validateTrackingNumber(createShipmentDto.trackingNumber, createShipmentDto.carrier)

      // Check if tracking number already exists
      const existingShipment = await this.prisma.shipment.findUnique({
        where: { trackingNumber: createShipmentDto.trackingNumber },
      })

      if (existingShipment) {
        throw new BadRequestException('Tracking number already exists')
      }

      // Create shipment
      const shipment = await this.prisma.shipment.create({
        data: {
          marketerOrgId: orgId,
          createdByUserId: userId,
          assignedToUserId: createShipmentDto.assignedToUserId,
          carrier: createShipmentDto.carrier,
          trackingNumber: createShipmentDto.trackingNumber,
          reference: createShipmentDto.reference,
          status: 'CREATED',
          shipTo: createShipmentDto.shipTo,
          audit: {
            created_by: userId,
            created_at: new Date().toISOString(),
            changes: [],
          },
        },
      })

      // Log audit event
      await this.auditService.logEvent({
        correlationId,
        actorUserId: userId,
        actorOrgId: orgId,
        action: 'create',
        resource: 'Shipment',
        resourceId: shipment.id,
        afterState: PhiRedactor.redactObject(shipment),
        success: true,
      })

      logger.info({
        action: 'SHIPMENT_CREATED',
        shipment_id: shipment.id,
        tracking_number: shipment.trackingNumber,
        carrier: shipment.carrier,
        user_id: userId,
        org_id: orgId,
        correlation_id: correlationId,
      })

      return this.mapShipmentToResponse(shipment)
    } catch (error) {
      logger.error({
        action: 'SHIPMENT_CREATE_FAILED',
        error: (error as Error).message,
        user_id: userId,
        org_id: orgId,
        correlation_id: correlationId,
      })
      throw error
    }
  }

  /**
   * Create multiple shipments in bulk
   */
  async createBulkShipments(
    bulkCreateDto: BulkCreateShipmentsDto,
    userId: string,
    orgId: string,
    correlationId: string,
  ): Promise<{ created: number; failed: number; errors: string[] }> {
    try {
      const results = {
        created: 0,
        failed: 0,
        errors: [] as string[],
      }

      // Process shipments in batches to avoid overwhelming the database
      const batchSize = 10
      for (let i = 0; i < bulkCreateDto.shipments.length; i += batchSize) {
        const batch = bulkCreateDto.shipments.slice(i, i + batchSize)
        
        for (const shipmentData of batch) {
          try {
            await this.createShipment(shipmentData, userId, orgId, correlationId)
            results.created++
          } catch (error) {
            results.failed++
            results.errors.push(`Shipment ${shipmentData.trackingNumber}: ${(error as Error).message}`)
          }
        }
      }

      logger.info({
        action: 'BULK_SHIPMENTS_CREATED',
        created: results.created,
        failed: results.failed,
        user_id: userId,
        org_id: orgId,
        correlation_id: correlationId,
      })

      return results
    } catch (error) {
      logger.error({
        action: 'BULK_SHIPMENTS_CREATE_FAILED',
        error: (error as Error).message,
        user_id: userId,
        org_id: orgId,
        correlation_id: correlationId,
      })
      throw error
    }
  }

  /**
   * Get shipments with filtering and pagination
   */
  async getShipments(
    query: ShipmentsQueryDto,
    orgId: string,
    userId: string,
    correlationId: string,
  ): Promise<ShipmentsListResponseDto> {
    try {
      const where: any = {
        marketerOrgId: orgId, // Enforce org scoping
      }

      // Apply filters
      if (query.status) {
        where.status = query.status
      }

      if (query.carrier) {
        where.carrier = query.carrier
      }

      if (query.assigned_to) {
        where.assignedToUserId = query.assigned_to
      }

      if (query.date_from || query.date_to) {
        where.createdAt = {}
        if (query.date_from) {
          where.createdAt.gte = new Date(query.date_from)
        }
        if (query.date_to) {
          where.createdAt.lte = new Date(query.date_to)
        }
      }

      if (query.search) {
        where.OR = [
          { trackingNumber: { contains: query.search, mode: 'insensitive' } },
          { reference: { contains: query.search, mode: 'insensitive' } },
        ]
      }

      const limit = query.limit
      const skip = query.cursor ? 1 : 0

      const [items, total] = await Promise.all([
        this.prisma.shipment.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip,
          cursor: query.cursor ? { id: query.cursor } : undefined,
        }),
        this.prisma.shipment.count({ where }),
      ])

      const itemsResponse = items.map((shipment: any) => this.mapShipmentToResponse(shipment))
      const hasNext = items.length === limit
      const nextCursor = hasNext && items[items.length - 1] ? items[items.length - 1]?.id : null

      logger.info({
        action: 'SHIPMENTS_QUERIED',
        count: items.length,
        total,
        user_id: userId,
        org_id: orgId,
        correlation_id: correlationId,
      })

      return {
        items: itemsResponse,
        next_cursor: nextCursor || null,
        total,
      }
    } catch (error) {
      logger.error({
        action: 'SHIPMENTS_QUERY_FAILED',
        error: (error as Error).message,
        user_id: userId,
        org_id: orgId,
        correlation_id: correlationId,
      })
      throw error
    }
  }

  /**
   * Get a single shipment by ID
   */
  async getShipmentById(
    id: string,
    orgId: string,
    userId: string,
    correlationId: string,
  ): Promise<ShipmentResponseDto> {
    try {
      const shipment = await this.prisma.shipment.findFirst({
        where: {
          id,
          marketerOrgId: orgId, // Enforce org scoping
        },
      })

      if (!shipment) {
        throw new NotFoundException('Shipment not found')
      }

      logger.info({
        action: 'SHIPMENT_RETRIEVED',
        shipment_id: id,
        user_id: userId,
        org_id: orgId,
        correlation_id: correlationId,
      })

      return this.mapShipmentToResponse(shipment)
    } catch (error) {
      logger.error({
        action: 'SHIPMENT_RETRIEVE_FAILED',
        shipment_id: id,
        error: (error as Error).message,
        user_id: userId,
        org_id: orgId,
        correlation_id: correlationId,
      })
      throw error
    }
  }

  /**
   * Update a shipment
   */
  async updateShipment(
    id: string,
    updateShipmentDto: UpdateShipmentDto,
    userId: string,
    orgId: string,
    correlationId: string,
  ): Promise<ShipmentResponseDto> {
    try {
      // Get existing shipment for audit
      const existingShipment = await this.prisma.shipment.findFirst({
        where: {
          id,
          marketerOrgId: orgId, // Enforce org scoping
        },
      })

      if (!existingShipment) {
        throw new NotFoundException('Shipment not found')
      }

      // Update shipment
      const updatedShipment = await this.prisma.shipment.update({
        where: { id },
        data: {
          ...updateShipmentDto,
          audit: {
            ...(existingShipment.audit as any),
            changes: [
              ...(existingShipment.audit as any).changes,
              {
                changed_by: userId,
                changed_at: new Date().toISOString(),
                changes: updateShipmentDto,
              },
            ],
          },
        },
      })

      // Log audit event
      await this.auditService.logEvent({
        correlationId,
        actorUserId: userId,
        actorOrgId: orgId,
        action: 'update',
        resource: 'Shipment',
        resourceId: id,
        beforeState: PhiRedactor.redactObject(existingShipment),
        afterState: PhiRedactor.redactObject(updatedShipment),
        success: true,
      })

      logger.info({
        action: 'SHIPMENT_UPDATED',
        shipment_id: id,
        user_id: userId,
        org_id: orgId,
        correlation_id: correlationId,
      })

      return this.mapShipmentToResponse(updatedShipment)
    } catch (error) {
      logger.error({
        action: 'SHIPMENT_UPDATE_FAILED',
        shipment_id: id,
        error: (error as Error).message,
        user_id: userId,
        org_id: orgId,
        correlation_id: correlationId,
      })
      throw error
    }
  }

  /**
   * Delete a shipment
   */
  async deleteShipment(
    id: string,
    userId: string,
    orgId: string,
    correlationId: string,
  ): Promise<{ success: boolean }> {
    try {
      // Get existing shipment for audit
      const existingShipment = await this.prisma.shipment.findFirst({
        where: {
          id,
          marketerOrgId: orgId, // Enforce org scoping
        },
      })

      if (!existingShipment) {
        throw new NotFoundException('Shipment not found')
      }

      // Delete shipment
      await this.prisma.shipment.delete({
        where: { id },
      })

      // Log audit event
      await this.auditService.logEvent({
        correlationId,
        actorUserId: userId,
        actorOrgId: orgId,
        action: 'delete',
        resource: 'Shipment',
        resourceId: id,
        beforeState: PhiRedactor.redactObject(existingShipment),
        success: true,
      })

      logger.info({
        action: 'SHIPMENT_DELETED',
        shipment_id: id,
        user_id: userId,
        org_id: orgId,
        correlation_id: correlationId,
      })

      return { success: true }
    } catch (error) {
      logger.error({
        action: 'SHIPMENT_DELETE_FAILED',
        shipment_id: id,
        error: (error as Error).message,
        user_id: userId,
        org_id: orgId,
        correlation_id: correlationId,
      })
      throw error
    }
  }

  /**
   * Refresh shipment tracking data
   */
  async refreshShipmentTracking(
    id: string,
    refreshDto: RefreshShipmentDto,
    userId: string,
    orgId: string,
    correlationId: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const shipment = await this.prisma.shipment.findFirst({
        where: {
          id,
          marketerOrgId: orgId, // Enforce org scoping
        },
      })

      if (!shipment) {
        throw new NotFoundException('Shipment not found')
      }

      // TODO: Integrate with UPS tracking service
      // For now, just update the last poll time
      await this.prisma.shipment.update({
        where: { id },
        data: {
          lastCarrierPollAt: new Date(),
        },
      })

      logger.info({
        action: 'SHIPMENT_TRACKING_REFRESHED',
        shipment_id: id,
        tracking_number: shipment.trackingNumber,
        user_id: userId,
        org_id: orgId,
        correlation_id: correlationId,
      })

      return {
        success: true,
        message: 'Tracking data refresh initiated',
      }
    } catch (error) {
      logger.error({
        action: 'SHIPMENT_TRACKING_REFRESH_FAILED',
        shipment_id: id,
        error: (error as Error).message,
        user_id: userId,
        org_id: orgId,
        correlation_id: correlationId,
      })
      throw error
    }
  }

  /**
   * Validate tracking number format based on carrier
   */
  private validateTrackingNumber(trackingNumber: string, carrier: Carrier): void {
    const patterns = {
      UPS: /^1Z[0-9A-Z]{16}$/,
      FEDEX: /^[0-9]{12}$/,
      USPS: /^[0-9]{20}$/,
      OTHER: /^.{1,50}$/,
    }

    const pattern = patterns[carrier]
    if (!pattern.test(trackingNumber)) {
      throw new BadRequestException(`Invalid ${carrier} tracking number format`)
    }
  }

  /**
   * Map Prisma shipment to response DTO
   */
  private mapShipmentToResponse(shipment: any): ShipmentResponseDto {
    return {
      id: shipment.id,
      carrier: shipment.carrier,
      trackingNumber: shipment.trackingNumber,
      reference: shipment.reference,
      status: shipment.status,
      eta: shipment.eta?.toISOString() || null,
      lastEvent: shipment.lastEvent,
      lastCarrierPollAt: shipment.lastCarrierPollAt?.toISOString() || null,
      shipTo: shipment.shipTo,
      createdByUserId: shipment.createdByUserId,
      assignedToUserId: shipment.assignedToUserId,
      createdAt: shipment.createdAt.toISOString(),
      updatedAt: shipment.updatedAt.toISOString(),
    }
  }
}
