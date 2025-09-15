import { Injectable, Logger, Inject } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { UpsOAuthService } from './ups-oauth.service'
import { logger } from '../../utils/logger'

export interface UpsTrackingEvent {
  date: string
  time: string
  location: string
  status: string
  description: string
}

export interface UpsTrackingResponse {
  trackingNumber: string
  status: string
  statusCode: string
  statusDescription: string
  serviceType: string
  serviceDescription: string
  deliveryDate?: string
  deliveryTime?: string
  events: UpsTrackingEvent[]
  exception?: {
    code: string
    description: string
  }
}

export interface UpsTrackingRequest {
  trackingNumber: string
  locale?: string
  returnSignature?: boolean
}

@Injectable()
export class UpsTrackingService {
  private readonly logger = new Logger(UpsTrackingService.name)
  private readonly baseUrl: string
  private readonly trackingEndpoint: string

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    private readonly upsOAuthService: UpsOAuthService,
  ) {
    this.baseUrl = this.configService.get<string>('UPS_BASE_URL', 'https://onlinetools.ups.com')
    this.trackingEndpoint = '/api/track/v1/details'
  }

  /**
   * Get tracking information for a UPS package
   */
  async getTrackingInfo(trackingNumber: string): Promise<UpsTrackingResponse> {
    try {
      // Validate tracking number format
      this.validateTrackingNumber(trackingNumber)

      // Get access token
      const accessToken = await this.upsOAuthService.getAccessToken()

      // Make API request
      const response = await this.makeTrackingRequest(trackingNumber, accessToken)

      // Parse and map response
      const trackingInfo = this.mapUpsResponse(response, trackingNumber)

      this.logger.log({
        action: 'UPS_TRACKING_SUCCESS',
        tracking_number: trackingNumber,
        status: trackingInfo.status,
        events_count: trackingInfo.events.length,
      })

      return trackingInfo
    } catch (error) {
      this.logger.error({
        action: 'UPS_TRACKING_FAILED',
        tracking_number: trackingNumber,
        error: (error as Error).message,
      })
      throw error
    }
  }

  /**
   * Make the actual UPS API request
   */
  private async makeTrackingRequest(trackingNumber: string, accessToken: string): Promise<any> {
    const url = `${this.baseUrl}${this.trackingEndpoint}/${trackingNumber}`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      
      // Handle specific UPS error codes
      if (response.status === 404) {
        throw new Error('Tracking number not found')
      } else if (response.status === 429) {
        throw new Error('Rate limit exceeded - please retry later')
      } else if (response.status >= 500) {
        throw new Error('UPS service temporarily unavailable')
      } else {
        throw new Error(`UPS API error: ${response.status} ${errorText}`)
      }
    }

    return await response.json()
  }

  /**
   * Map UPS API response to our internal format
   */
  private mapUpsResponse(upsResponse: any, trackingNumber: string): UpsTrackingResponse {
    try {
      const shipment = upsResponse.trackResponse?.shipment?.[0]
      
      if (!shipment) {
        throw new Error('Invalid UPS response format')
      }

      const packageInfo = shipment.package?.[0]
      const activity = packageInfo?.activity || []

      // Map UPS status codes to our internal status
      const status = this.mapUpsStatus(packageInfo?.status?.type, packageInfo?.status?.description)

      // Map events
      const events: UpsTrackingEvent[] = activity.map((event: any) => ({
        date: event.date || '',
        time: event.time || '',
        location: event.location?.address?.city || '',
        status: event.status?.type || '',
        description: event.status?.description || '',
      }))

      // Extract delivery information
      const deliveryInfo = this.extractDeliveryInfo(packageInfo)

      return {
        trackingNumber,
        status,
        statusCode: packageInfo?.status?.type || '',
        statusDescription: packageInfo?.status?.description || '',
        serviceType: shipment.service?.code || '',
        serviceDescription: shipment.service?.description || '',
        deliveryDate: deliveryInfo.date,
        deliveryTime: deliveryInfo.time,
        events,
        exception: this.extractException(packageInfo),
      }
    } catch (error) {
      this.logger.error({
        action: 'UPS_RESPONSE_MAPPING_FAILED',
        tracking_number: trackingNumber,
        error: (error as Error).message,
        response: JSON.stringify(upsResponse).substring(0, 500),
      })
      throw new Error('Failed to parse UPS tracking response')
    }
  }

  /**
   * Map UPS status to our internal shipment status
   */
  private mapUpsStatus(upsStatus: string, description: string): string {
    const statusMap: Record<string, string> = {
      'I': 'IN_TRANSIT',      // In Transit
      'D': 'DELIVERED',       // Delivered
      'E': 'EXCEPTION',       // Exception
      'O': 'OUT_FOR_DELIVERY', // Out for Delivery
      'P': 'CREATED',         // Pickup
      'M': 'CREATED',         // Manifest
    }

    // Check for specific delivery status
    if (description?.toLowerCase().includes('delivered')) {
      return 'DELIVERED'
    }

    if (description?.toLowerCase().includes('out for delivery')) {
      return 'OUT_FOR_DELIVERY'
    }

    if (description?.toLowerCase().includes('exception')) {
      return 'EXCEPTION'
    }

    return statusMap[upsStatus] || 'IN_TRANSIT'
  }

  /**
   * Extract delivery date and time from package info
   */
  private extractDeliveryInfo(packageInfo: any): { date?: string; time?: string } {
    const deliveryInfo: { date?: string; time?: string } = {}

    // Look for delivery date in various fields
    if (packageInfo?.deliveryDate) {
      deliveryInfo.date = packageInfo.deliveryDate
    }

    if (packageInfo?.deliveryTime) {
      deliveryInfo.time = packageInfo.deliveryTime
    }

    // Check activity for delivery events
    const activities = packageInfo?.activity || []
    const deliveryActivity = activities.find((activity: any) => 
      activity.status?.description?.toLowerCase().includes('delivered')
    )

    if (deliveryActivity) {
      deliveryInfo.date = deliveryActivity.date
      deliveryInfo.time = deliveryActivity.time
    }

    return deliveryInfo
  }

  /**
   * Extract exception information if present
   */
  private extractException(packageInfo: any): { code: string; description: string } | undefined {
    const status = packageInfo?.status
    const description = status?.description || ''

    if (status?.type === 'E' || description.toLowerCase().includes('exception')) {
      return {
        code: status?.type || 'EXCEPTION',
        description: description || 'Package exception occurred',
      }
    }

    return undefined
  }

  /**
   * Validate UPS tracking number format
   */
  private validateTrackingNumber(trackingNumber: string): void {
    // UPS tracking numbers: 1Z followed by 16 alphanumeric characters
    const upsPattern = /^1Z[0-9A-Z]{16}$/
    
    if (!upsPattern.test(trackingNumber)) {
      throw new Error('Invalid UPS tracking number format')
    }
  }

  /**
   * Check if tracking number is valid UPS format
   */
  isValidTrackingNumber(trackingNumber: string): boolean {
    try {
      this.validateTrackingNumber(trackingNumber)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get service health status
   */
  async getServiceHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    lastCheck: string
    tokenValid: boolean
  }> {
    try {
      const tokenInfo = this.upsOAuthService.getTokenCacheInfo()
      
      return {
        status: tokenInfo.cached ? 'healthy' : 'degraded',
        lastCheck: new Date().toISOString(),
        tokenValid: tokenInfo.cached,
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        lastCheck: new Date().toISOString(),
        tokenValid: false,
      }
    }
  }
}
