import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PrismaService } from '../../prisma.service'
import { UpsTrackingService } from './ups-tracking.service'
import { logger } from '../../utils/logger'

@Injectable()
export class UpsPollingService {
  private readonly logger = new Logger(UpsPollingService.name)
  private isPolling = false
  private readonly batchSize = 50
  private readonly maxRetries = 3
  private readonly retryDelay = 5000 // 5 seconds

  constructor(
    private prisma: PrismaService,
    private upsTrackingService: UpsTrackingService,
  ) {}

  /**
   * Scheduled job to poll UPS for tracking updates
   * Runs every 30 minutes
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async pollTrackingUpdates(): Promise<void> {
    if (this.isPolling) {
      this.logger.warn('UPS polling already in progress, skipping this run')
      return
    }

    this.isPolling = true
    const startTime = Date.now()

    try {
      this.logger.info({
        action: 'UPS_POLLING_STARTED',
        timestamp: new Date().toISOString(),
      })

      // Get shipments that need polling
      const shipments = await this.getShipmentsForPolling()
      
      if (shipments.length === 0) {
        this.logger.info({
          action: 'UPS_POLLING_NO_SHIPMENTS',
          timestamp: new Date().toISOString(),
        })
        return
      }

      this.logger.info({
        action: 'UPS_POLLING_BATCH_START',
        shipment_count: shipments.length,
        timestamp: new Date().toISOString(),
      })

      // Process shipments in batches
      await this.processShipmentsBatch(shipments)

      const duration = Date.now() - startTime
      this.logger.info({
        action: 'UPS_POLLING_COMPLETED',
        duration_ms: duration,
        shipment_count: shipments.length,
        timestamp: new Date().toISOString(),
      })

    } catch (error) {
      this.logger.error({
        action: 'UPS_POLLING_FAILED',
        error: (error as Error).message,
        duration_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      })
    } finally {
      this.isPolling = false
    }
  }

  /**
   * Get shipments that need UPS polling
   */
  private async getShipmentsForPolling(): Promise<any[]> {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000)

    return await this.prisma.shipment.findMany({
      where: {
        carrier: 'UPS',
        status: {
          in: ['CREATED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'],
        },
        createdAt: {
          gte: fortyEightHoursAgo, // Don't poll shipments older than 48 hours
        },
        OR: [
          { lastCarrierPollAt: null },
          { lastCarrierPollAt: { lt: thirtyMinutesAgo } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: this.batchSize,
    })
  }

  /**
   * Process a batch of shipments
   */
  private async processShipmentsBatch(shipments: any[]): Promise<void> {
    const results = {
      updated: 0,
      failed: 0,
      errors: [] as string[],
    }

    for (const shipment of shipments) {
      try {
        // Add jitter to avoid overwhelming UPS API
        await this.delay(this.getRandomDelay())

        await this.updateShipmentTracking(shipment)
        results.updated++

        this.logger.debug({
          action: 'SHIPMENT_POLLED_SUCCESS',
          shipment_id: shipment.id,
          tracking_number: shipment.trackingNumber,
        })

      } catch (error) {
        results.failed++
        results.errors.push(`${shipment.trackingNumber}: ${(error as Error).message}`)

        this.logger.warn({
          action: 'SHIPMENT_POLL_FAILED',
          shipment_id: shipment.id,
          tracking_number: shipment.trackingNumber,
          error: (error as Error).message,
        })

        // Update last poll time even on failure to avoid immediate retry
        await this.updateLastPollTime(shipment.id)
      }
    }

    this.logger.info({
      action: 'UPS_POLLING_BATCH_RESULTS',
      updated: results.updated,
      failed: results.failed,
      error_count: results.errors.length,
    })
  }

  /**
   * Update tracking information for a single shipment
   */
  private async updateShipmentTracking(shipment: any): Promise<void> {
    try {
      // Get tracking info from UPS
      const trackingInfo = await this.upsTrackingService.getTrackingInfo(shipment.trackingNumber)

      // Update shipment with new information
      const updateData: any = {
        status: trackingInfo.status,
        lastEvent: trackingInfo.statusDescription,
        lastCarrierPollAt: new Date(),
        audit: {
          ...(shipment.audit as any),
          changes: [
            ...(shipment.audit as any).changes,
            {
              changed_by: 'UPS_POLLING_SERVICE',
              changed_at: new Date().toISOString(),
              changes: {
                status: trackingInfo.status,
                lastEvent: trackingInfo.statusDescription,
                lastCarrierPollAt: new Date().toISOString(),
              },
            },
          ],
        },
      }

      // Add delivery date if available
      if (trackingInfo.deliveryDate) {
        updateData.eta = new Date(trackingInfo.deliveryDate)
      }

      // Add exception info if present
      if (trackingInfo.exception) {
        updateData.status = 'EXCEPTION'
        updateData.lastEvent = trackingInfo.exception.description
      }

      await this.prisma.shipment.update({
        where: { id: shipment.id },
        data: updateData,
      })

      // Log successful update
      logger.info({
        action: 'SHIPMENT_TRACKING_UPDATED',
        shipment_id: shipment.id,
        tracking_number: shipment.trackingNumber,
        old_status: shipment.status,
        new_status: trackingInfo.status,
        events_count: trackingInfo.events.length,
      })

    } catch (error) {
      // Handle specific error cases
      if ((error as Error).message.includes('not found')) {
        // Mark as exception if tracking number not found
        await this.prisma.shipment.update({
          where: { id: shipment.id },
          data: {
            status: 'EXCEPTION',
            lastEvent: 'Tracking number not found',
            lastCarrierPollAt: new Date(),
          },
        })
      } else {
        throw error
      }
    }
  }

  /**
   * Update last poll time for a shipment
   */
  private async updateLastPollTime(shipmentId: string): Promise<void> {
    try {
      await this.prisma.shipment.update({
        where: { id: shipmentId },
        data: { lastCarrierPollAt: new Date() },
      })
    } catch (error) {
      this.logger.error({
        action: 'UPDATE_LAST_POLL_TIME_FAILED',
        shipment_id: shipmentId,
        error: (error as Error).message,
      })
    }
  }

  /**
   * Get random delay between 250-500ms for jitter
   */
  private getRandomDelay(): number {
    return Math.floor(Math.random() * 250) + 250
  }

  /**
   * Delay execution for specified milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Manual trigger for polling (for testing or admin use)
   */
  async triggerPolling(): Promise<{ success: boolean; message: string }> {
    if (this.isPolling) {
      return {
        success: false,
        message: 'Polling already in progress',
      }
    }

    try {
      await this.pollTrackingUpdates()
      return {
        success: true,
        message: 'Polling completed successfully',
      }
    } catch (error) {
      return {
        success: false,
        message: `Polling failed: ${(error as Error).message}`,
      }
    }
  }

  /**
   * Get polling service status
   */
  getPollingStatus(): {
    isPolling: boolean
    lastRun?: string
    nextRun?: string
  } {
    return {
      isPolling: this.isPolling,
      // Note: In a real implementation, you'd track last run time
      // and calculate next run time based on cron schedule
    }
  }
}
