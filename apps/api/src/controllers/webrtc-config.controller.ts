/**
 * WebRTC Configuration Controller
 * Provides TURN/STUN configuration to frontend clients
 * HIPAA: No credentials exposed, read-only access
 */

import { Controller, Get, UseGuards } from '@nestjs/common'
import { AbacGuard } from '../abac/abac.guard'
import { Abac } from '../abac/abac.decorator'
import { TurnConfigService } from '../services/turn-config.service'

@Controller('api/webrtc')
@UseGuards(AbacGuard)
export class WebRTCConfigController {
  constructor(private readonly turnConfigService: TurnConfigService) {}

  /**
   * GET /api/webrtc/config
   * Get WebRTC configuration for video calls
   * Returns client-safe configuration (no credentials)
   */
  @Get('config')
  // No ABAC - public config endpoint
  async getConfiguration() {
    const config = await this.turnConfigService.getClientConfiguration()
    
    return {
      ice_transport_policy: config.iceTransportPolicy,
      stun_servers: config.stunServers,
      aws_managed_turn: config.useAwsManaged,
      recommendations: {
        use_headphones: true,
        min_bandwidth_kbps: 500,
        recommended_bandwidth_kbps: 1500,
        supported_browsers: ['Chrome 90+', 'Firefox 88+', 'Safari 14+', 'Edge 90+']
      }
    }
  }

  /**
   * GET /api/webrtc/health
   * Health check for WebRTC service configuration
   */
  @Get('health')
  async healthCheck() {
    try {
      const config = await this.turnConfigService.getClientConfiguration()
      
      return {
        status: 'healthy',
        stun_servers_available: config.stunServers.length > 0,
        aws_managed: config.useAwsManaged,
        ice_policy: config.iceTransportPolicy
      }
    } catch (error) {
      return {
        status: 'degraded',
        error: 'Configuration unavailable, using fallback',
        aws_managed: true // Fallback to AWS-managed
      }
    }
  }
}

