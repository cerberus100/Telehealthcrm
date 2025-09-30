/**
 * Video Visit Controller
 * HIPAA/SOC2 Compliant REST API
 * 
 * Endpoints:
 * - POST /api/visits - Create/schedule video visit
 * - POST /api/visits/:id/links - Generate one-time join tokens
 * - POST /api/visits/:id/notify - Send SMS/Email with deep links
 * - POST /api/visits/:id/start - Start Connect WebRTC session
 * - POST /api/visits/:id/end - End visit
 * - POST /api/token/redeem - Validate token (pre-join check)
 * - GET /api/visits/:id - Get visit details
 * - GET /api/visits - List visits for user
 */

import { Controller, Post, Get, Patch, Body, Param, Query, Req, UseGuards } from '@nestjs/common'
import { FastifyRequest } from 'fastify'
import { Abac, AbacGuard } from '../abac/abac.guard'
import { VideoVisitService } from '../services/video-visit.service'
import { VideoTokenService } from '../services/video-token.service'
import { VideoNotificationService } from '../services/video-notification.service'
import { logger } from '../utils/logger'
import { z } from 'zod'

// Request validation schemas
const CreateVisitSchema = z.object({
  patientId: z.string().uuid(),
  clinicianId: z.string().uuid(),
  scheduledAt: z.string().datetime(),
  duration: z.number().int().min(15).max(120).optional(),
  visitType: z.enum(['initial', 'follow-up', 'urgent']).optional(),
  chiefComplaint: z.string().max(1000).optional(),
  channel: z.enum(['sms', 'email', 'both'])
})

const GenerateLinksSchema = z.object({
  roles: z.array(z.enum(['patient', 'clinician'])),
  ttlMinutes: z.number().int().min(15).max(30).optional()
})

const SendNotificationSchema = z.object({
  channel: z.enum(['sms', 'email', 'both']),
  recipientRole: z.enum(['patient', 'clinician', 'both']),
  template: z.enum(['initial', 'reminder', 'urgent']).optional()
})

const StartVisitSchema = z.object({
  token: z.string().min(1),
  deviceInfo: z.object({
    hasCamera: z.boolean(),
    hasMicrophone: z.boolean(),
    browser: z.string(),
    os: z.string()
  })
})

const EndVisitSchema = z.object({
  sessionToken: z.string(),
  endReason: z.enum(['completed', 'no-show', 'technical-issue', 'cancelled']),
  duration: z.number().optional(),
  notes: z.string().max(5000).optional()
})

const RedeemTokenSchema = z.object({
  token: z.string().min(1)
})

const ResendLinkSchema = z.object({
  role: z.enum(['patient', 'clinician']),
  reason: z.enum(['expired', 'lost', 'not-received']),
  channel: z.enum(['sms', 'email', 'both'])
})

@Controller('api/visits')
@UseGuards(AbacGuard)
export class VideoVisitsController {
  constructor(
    private readonly visitService: VideoVisitService,
    private readonly tokenService: VideoTokenService,
    private readonly notificationService: VideoNotificationService
  ) {}

  /**
   * POST /api/visits
   * Create new video visit
   * RBAC: ADMIN, DOCTOR only
   */
  @Post()
  @Abac({ resource: 'VideoVisit', action: 'create' })
  async createVisit(@Body() body: z.infer<typeof CreateVisitSchema>, @Req() req: FastifyRequest) {
    const parsed = CreateVisitSchema.parse(body)
    const claims = (req as any).claims

    const visit = await this.visitService.createVisit({
      ...parsed,
      scheduledAt: new Date(parsed.scheduledAt),
      createdBy: claims.sub
    })

    return {
      visitId: visit.id,
      status: visit.status,
      scheduledAt: visit.scheduledAt.toISOString(),
      expiresAt: new Date(visit.scheduledAt.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      patientId: visit.patientId,
      clinicianId: visit.clinicianId,
      createdAt: visit.createdAt.toISOString()
    }
  }

  /**
   * POST /api/visits/:id/links
   * Generate one-time join links
   * RBAC: ADMIN, DOCTOR only
   */
  @Post(':id/links')
  @Abac({ resource: 'VideoVisit', action: 'update' })
  async generateLinks(
    @Param('id') visitId: string,
    @Body() body: z.infer<typeof GenerateLinksSchema>,
    @Req() req: FastifyRequest
  ) {
    const parsed = GenerateLinksSchema.parse(body)
    const clientIp = (req as any).ip || 'unknown'
    const userAgent = req.headers['user-agent'] || 'unknown'

    // Get visit
    const visit = await this.prisma.videoVisit.findUnique({
      where: { id: visitId },
      include: { patient: true, clinician: true }
    })

    if (!visit) {
      throw new Error('Visit not found')
    }

    const result: any = {}

    // Generate patient link
    if (parsed.roles.includes('patient')) {
      const patientToken = await this.tokenService.issueToken({
        visitId,
        userId: visit.patientId,
        role: 'patient',
        ttlMinutes: parsed.ttlMinutes,
        issuedToIP: clientIp,
        issuedToUA: userAgent
      })

      result.patient = {
        token: patientToken.token,
        link: `https://visit.eudaura.com/j/${patientToken.shortCode}`,
        expiresAt: patientToken.expiresAt.toISOString(),
        tokenId: patientToken.tokenId
      }
    }

    // Generate clinician link
    if (parsed.roles.includes('clinician')) {
      const clinicianToken = await this.tokenService.issueToken({
        visitId,
        userId: visit.clinicianId,
        role: 'clinician',
        ttlMinutes: parsed.ttlMinutes,
        issuedToIP: clientIp,
        issuedToUA: userAgent
      })

      result.clinician = {
        token: clinicianToken.token,
        link: `https://visit.eudaura.com/j/${clinicianToken.shortCode}`,
        expiresAt: clinicianToken.expiresAt.toISOString(),
        tokenId: clinicianToken.tokenId
      }
    }

    return result
  }

  /**
   * POST /api/visits/:id/notify
   * Send SMS/Email notifications
   * RBAC: ADMIN, DOCTOR only
   */
  @Post(':id/notify')
  @Abac({ resource: 'VideoVisit', action: 'update' })
  async sendNotifications(
    @Param('id') visitId: string,
    @Body() body: z.infer<typeof SendNotificationSchema>
  ) {
    const parsed = SendNotificationSchema.parse(body)
    
    const result = await this.notificationService.sendNotifications({
      visitId,
      ...parsed
    })

    return result
  }

  /**
   * POST /api/visits/:id/start
   * Start Connect WebRTC session
   * PUBLIC: Token-based auth (no session required)
   */
  @Post(':id/start')
  async startVisit(
    @Param('id') visitId: string,
    @Body() body: z.infer<typeof StartVisitSchema>,
    @Req() req: FastifyRequest
  ) {
    const parsed = StartVisitSchema.parse(body)
    const clientIp = (req as any).ip || 'unknown'
    const userAgent = req.headers['user-agent'] || 'unknown'

    // Extract token ID from JWT
    const parts = parsed.token.split('.')
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8')
    const payload = JSON.parse(payloadJson)

    const response = await this.visitService.startVisit({
      visitId,
      tokenId: payload.jti,
      deviceInfo: parsed.deviceInfo
    }, clientIp, userAgent)

    return {
      connectContact: {
        contactId: response.contactId,
        instanceId: this.visitService['connectInstanceId'],
        participantId: response.participantId,
        participantToken: response.participantToken
      },
      visitSession: {
        sessionToken: response.sessionToken,
        expiresIn: 3600 // 1 hour
      }
    }
  }

  /**
   * POST /api/visits/:id/start-authenticated
   * Start visit for authenticated portal users (no one-time token required)
   * RBAC: PATIENT or DOCTOR only
   */
  @Post(':id/start-authenticated')
  @Abac({ resource: 'VideoVisit', action: 'update' })
  async startVisitAuthenticated(
    @Param('id') visitId: string,
    @Body() body: { deviceInfo: any },
    @Req() req: FastifyRequest
  ) {
    const claims = (req as any).claims
    const clientIp = (req as any).ip || 'unknown'
    const userAgent = req.headers['user-agent'] || 'unknown'

    // Verify user has access to this visit
    const visit = await this.prisma.videoVisit.findUnique({
      where: { id: visitId },
      select: { patientId: true, clinicianId: true }
    })

    if (!visit) {
      throw new Error('Visit not found')
    }

    const hasAccess = visit.patientId === claims.sub || visit.clinicianId === claims.sub
    if (!hasAccess) {
      throw new Error('Access denied')
    }

    // Determine role
    const role = visit.patientId === claims.sub ? 'patient' : 'clinician'

    // Create temporary token for this session
    const tempToken = await this.tokenService.issueToken({
      visitId,
      userId: claims.sub,
      role,
      ttlMinutes: 60, // 1 hour for portal users
      issuedToIP: clientIp,
      issuedToUA: userAgent
    })

    // Start visit (same as public endpoint)
    const response = await this.visitService.startVisit({
      visitId,
      tokenId: tempToken.tokenId,
      deviceInfo: body.deviceInfo
    }, clientIp, userAgent)

    return {
      connectContact: {
        contactId: response.contactId,
        instanceId: this.visitService['connectInstanceId'],
        participantId: response.participantId,
        participantToken: response.participantToken
      },
      chimeJoinInfo: response, // Return full Chime details
      visitSession: {
        sessionToken: response.sessionToken,
        expiresIn: 3600
      }
    }
  }

  /**
   * POST /api/visits/:id/end
   * End video visit
   */
  @Post(':id/end')
  @Abac({ resource: 'VideoVisit', action: 'update' })
  async endVisit(
    @Param('id') visitId: string,
    @Body() body: z.infer<typeof EndVisitSchema>,
    @Req() req: FastifyRequest
  ) {
    const parsed = EndVisitSchema.parse(body)
    const claims = (req as any).claims

    await this.visitService.endVisit({
      visitId,
      userId: claims.sub,
      endReason: parsed.endReason,
      notes: parsed.notes
    })

    return { ok: true }
  }

  /**
   * POST /api/token/redeem
   * Pre-join token validation (read-only, doesn't consume)
   * PUBLIC: No auth required
   */
  @Post('/token/redeem')
  async validateToken(@Body() body: z.infer<typeof RedeemTokenSchema>) {
    const parsed = RedeemTokenSchema.parse(body)
    
    const result = await this.tokenService.validateToken(parsed.token, { requireUnused: true })

    if (!result.valid) {
      return {
        valid: false,
        error: result.error,
        action: result.action
      }
    }

    // Get visit details (no PHI)
    const visit = await this.prisma.videoVisit.findUnique({
      where: { id: result.payload!.visit_id },
      include: {
        clinician: { select: { firstName: true } }
      }
    })

    if (!visit) {
      return { valid: false, error: 'Visit not found' }
    }

    const expiresIn = result.payload!.exp - Math.floor(Date.now() / 1000)

    return {
      valid: true,
      visit: {
        visitId: visit.id,
        scheduledAt: visit.scheduledAt.toISOString(),
        clinicianName: visit.clinician.firstName, // First name only
        duration: visit.duration
      },
      expiresIn,
      warnings: expiresIn < 120 ? ['Expires in less than 2 minutes'] : undefined
    }
  }

  /**
   * GET /api/visits/:id
   * Get visit details
   * RBAC: Patient, Clinician, or Admin
   */
  @Get(':id')
  @Abac({ resource: 'VideoVisit', action: 'read' })
  async getVisit(@Param('id') visitId: string, @Req() req: FastifyRequest) {
    const claims = (req as any).claims
    const visit = await this.visitService.getVisit(visitId, claims.sub, claims.role)
    return visit
  }

  /**
   * GET /api/visits
   * List visits for current user
   * RBAC: Authenticated users
   */
  @Get()
  @Abac({ resource: 'VideoVisit', action: 'read' })
  async listVisits(
    @Query('status') status: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('cursor') cursor: string | undefined,
    @Req() req: FastifyRequest
  ) {
    const claims = (req as any).claims
    
    const result = await this.visitService.listVisits({
      userId: claims.sub,
      role: claims.role,
      status,
      limit: limit ? parseInt(limit) : undefined,
      cursor
    })

    return result
  }

  /**
   * POST /api/visits/:id/resend-link
   * Resend expired/lost link
   * RBAC: ADMIN, DOCTOR, or visit participant
   */
  @Post(':id/resend-link')
  @Abac({ resource: 'VideoVisit', action: 'update' })
  async resendLink(
    @Param('id') visitId: string,
    @Body() body: z.infer<typeof ResendLinkSchema>,
    @Req() req: FastifyRequest
  ) {
    const parsed = ResendLinkSchema.parse(body)
    const clientIp = (req as any).ip || 'unknown'
    const userAgent = req.headers['user-agent'] || 'unknown'

    // Get visit
    const visit = await this.prisma.videoVisit.findUnique({
      where: { id: visitId },
      include: { patient: true, clinician: true }
    })

    if (!visit) {
      throw new Error('Visit not found')
    }

    // Check resend count (max 5)
    const resendCount = await this.prisma.oneTimeToken.count({
      where: { visitId, role: parsed.role }
    })

    if (resendCount >= 5) {
      logger.warn('Too many resend requests', { visitId, role: parsed.role })
      throw new Error('Too many resend requests')
    }

    // Revoke old tokens
    await this.prisma.oneTimeToken.updateMany({
      where: { visitId, role: parsed.role, status: { in: ['ACTIVE', 'EXPIRED'] } },
      data: { status: 'REVOKED' }
    })

    // Generate new token
    const userId = parsed.role === 'patient' ? visit.patientId : visit.clinicianId
    const newToken = await this.tokenService.issueToken({
      visitId,
      userId,
      role: parsed.role,
      ttlMinutes: 20,
      issuedToIP: clientIp,
      issuedToUA: userAgent
    })

    // Send notification
    await this.notificationService.sendNotifications({
      visitId,
      channel: parsed.channel,
      recipientRole: parsed.role
    })

    return {
      tokenId: newToken.tokenId,
      link: `https://visit.eudaura.com/j/${newToken.shortCode}`,
      expiresAt: newToken.expiresAt.toISOString(),
      sentVia: parsed.channel === 'both' ? ['sms', 'email'] : [parsed.channel]
    }
  }

  // Inject PrismaService for direct access (needed for token/redeem)
  constructor(
    visitService: VideoVisitService,
    tokenService: VideoTokenService,
    notificationService: VideoNotificationService,
    private readonly prisma: PrismaService
  ) {
    this.visitService = visitService
    this.tokenService = tokenService
    this.notificationService = notificationService
  }
}
