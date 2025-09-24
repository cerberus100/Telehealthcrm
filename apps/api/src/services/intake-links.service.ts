import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { RequestClaims } from '../types/claims'
import { logger } from '../utils/logger'
import crypto from 'crypto'

@Injectable()
export class IntakeLinksService {
  private demo: boolean
  private memory: Map<string, any>

  constructor(private readonly prisma: PrismaService) {
    this.demo = process.env.API_DEMO_MODE === 'true'
    this.memory = new Map()
  }

  async createIntakeLink(body: any, claims: RequestClaims) {
    try {
      const id = crypto.randomUUID()
      const didNumber = `+1555${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`
      
      const intakeLink = {
        id,
        marketerOrgId: claims.orgId,
        services: body.services,
        clientIds: body.clientIds,
        campaign: body.campaign || null,
        didNumber,
        allowedOrigins: body.allowedOrigins || [],
        rateLimit: body.rateLimit || 1000,
        webhookUrl: body.webhookUrl || null,
        active: true,
        createdAt: new Date().toISOString()
      }

      if (this.demo) {
        this.memory.set(id, intakeLink)
      } else {
        await (this.prisma as any).intakeLink?.create({ data: intakeLink })
      }

      logger.info({
        action: 'INTAKE_LINK_CREATED',
        intakeLinkId: id,
        orgId: claims.orgId,
        services: body.services,
        didNumber,
        audit: true
      })

      return {
        ...intakeLink,
        url: `${process.env.FRONTEND_BASE_URL || 'http://127.0.0.1:3000'}/intake/${id}`,
        didNumber
      }
    } catch (error) {
      logger.error({
        action: 'CREATE_INTAKE_LINK_FAILED',
        error: (error as Error).message,
        orgId: claims.orgId
      })
      throw error
    }
  }

  async listIntakeLinks(claims: RequestClaims) {
    try {
      if (this.demo) {
        const items = Array.from(this.memory.values()).filter(
          link => link.marketerOrgId === claims.orgId
        )
        return { items, next_cursor: undefined }
      }

      const items = await (this.prisma as any).intakeLink?.findMany({
        where: { marketerOrgId: claims.orgId },
        orderBy: { createdAt: 'desc' }
      })

      return { items: items || [], next_cursor: undefined }
    } catch (error) {
      logger.error({
        action: 'LIST_INTAKE_LINKS_FAILED',
        error: (error as Error).message,
        orgId: claims.orgId
      })
      throw error
    }
  }

  async updateIntakeLink(id: string, body: any, claims: RequestClaims) {
    try {
      if (this.demo) {
        const existing = this.memory.get(id)
        if (!existing || existing.marketerOrgId !== claims.orgId) {
          throw new Error('Not found')
        }
        const updated = { ...existing, ...body, updatedAt: new Date().toISOString() }
        this.memory.set(id, updated)
        return updated
      }

      const updated = await (this.prisma as any).intakeLink?.update({
        where: { id, marketerOrgId: claims.orgId },
        data: body
      })

      logger.info({
        action: 'INTAKE_LINK_UPDATED',
        intakeLinkId: id,
        orgId: claims.orgId,
        audit: true
      })

      return updated
    } catch (error) {
      logger.error({
        action: 'UPDATE_INTAKE_LINK_FAILED',
        error: (error as Error).message,
        intakeLinkId: id,
        orgId: claims.orgId
      })
      throw error
    }
  }

  async deleteIntakeLink(id: string, claims: RequestClaims) {
    try {
      if (this.demo) {
        const existing = this.memory.get(id)
        if (!existing || existing.marketerOrgId !== claims.orgId) {
          throw new Error('Not found')
        }
        this.memory.delete(id)
        return { success: true }
      }

      await (this.prisma as any).intakeLink?.update({
        where: { id, marketerOrgId: claims.orgId },
        data: { active: false }
      })

      logger.info({
        action: 'INTAKE_LINK_DELETED',
        intakeLinkId: id,
        orgId: claims.orgId,
        audit: true
      })

      return { success: true }
    } catch (error) {
      logger.error({
        action: 'DELETE_INTAKE_LINK_FAILED',
        error: (error as Error).message,
        intakeLinkId: id,
        orgId: claims.orgId
      })
      throw error
    }
  }
}
