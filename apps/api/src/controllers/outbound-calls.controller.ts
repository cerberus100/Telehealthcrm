/**
 * Outbound Calls Controller
 * HIPAA/SOC2 Compliant REST API
 * 
 * Endpoints:
 * - POST /api/calls/outbound - Initiate outbound call to patient
 * - POST /api/calls/dial - Dial any phone number (manual dialer)
 * - GET /api/calls/:contactId/status - Get call status
 */

import { Controller, Post, Get, Body, Param, Req, UseGuards } from '@nestjs/common'
import { FastifyRequest } from 'fastify'
import { Abac, AbacGuard } from '../abac/abac.guard'
import { OutboundCallService } from '../services/outbound-call.service'
import { z } from 'zod'

// Request validation schemas
const OutboundCallSchema = z.object({
  patientId: z.string().uuid(),
  consultId: z.string().uuid().optional(),
  reason: z.string().max(500).optional()
})

const ManualDialSchema = z.object({
  phoneNumber: z.string().regex(/^\+?1?\d{10,15}$/, 'Invalid phone number format'),
  reason: z.string().max(500).optional()
})

@Controller('api/calls')
@UseGuards(AbacGuard)
export class OutboundCallsController {
  constructor(
    private readonly outboundCallService: OutboundCallService,
    private readonly prisma: any  // PrismaService
  ) {}

  /**
   * POST /api/calls/outbound
   * Initiate outbound call to patient (click-to-call from patient profile)
   * RBAC: DOCTOR only
   */
  @Post('outbound')
  @Abac({ resource: 'Patient', action: 'create' })
  async callPatient(@Body() body: z.infer<typeof OutboundCallSchema>, @Req() req: FastifyRequest) {
    const parsed = OutboundCallSchema.parse(body)
    const claims = (req as any).claims

    // Get patient phone number
    const patient = await this.prisma.patient.findUnique({
      where: { id: parsed.patientId },
      select: { phones: true }
    })

    if (!patient || !patient.phones || patient.phones.length === 0) {
      throw new Error('Patient phone number not found')
    }

    const phoneNumber = patient.phones[0]

    const result = await this.outboundCallService.initiateCall({
      clinicianId: claims.sub,
      patientId: parsed.patientId,
      phoneNumber,
      consultId: parsed.consultId,
      reason: parsed.reason || 'physician-initiated-call'
    })

    return {
      success: true,
      contactId: result.contactId,
      status: result.status,
      message: `Calling patient at ${phoneNumber.slice(-4)}...`,
      instructions: 'The call will appear in your CCP. Accept to connect.'
    }
  }

  /**
   * POST /api/calls/dial
   * Manual dialer - call any phone number
   * RBAC: DOCTOR only
   */
  @Post('dial')
  @Abac({ resource: 'Patient', action: 'create' })
  async dialNumber(@Body() body: z.infer<typeof ManualDialSchema>, @Req() req: FastifyRequest) {
    const parsed = ManualDialSchema.parse(body)
    const claims = (req as any).claims

    const result = await this.outboundCallService.initiateCall({
      clinicianId: claims.sub,
      phoneNumber: parsed.phoneNumber,
      reason: parsed.reason || 'manual-dial'
    })

    return {
      success: true,
      contactId: result.contactId,
      status: result.status,
      message: `Calling ${parsed.phoneNumber.slice(-4)}...`,
      instructions: 'The call will appear in your CCP. Accept to connect.'
    }
  }

  /**
   * GET /api/calls/:contactId/status
   * Get call status
   * RBAC: DOCTOR only
   */
  @Get(':contactId/status')
  @Abac({ resource: 'Patient', action: 'read' })
  async getCallStatus(@Param('contactId') contactId: string) {
    const status = await this.outboundCallService.getCallStatus(contactId)
    return status
  }

}

