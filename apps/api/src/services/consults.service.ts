import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { BaseService } from './base.service'
import { RequestClaims } from '../types/claims'
import {
  ConsultsQueryDto,
  ConsultSummaryDto,
  ConsultDetailDto,
  UpdateConsultStatusDto,
  ShipmentsQueryDto,
  ShipmentDto,
  RxQueryDto,
  RxSummaryDto,
  RxDetailDto,
  NotificationsQueryDto,
  NotificationDto
} from '../types/dto'

@Injectable()
export class ConsultsService extends BaseService {

  async getConsults(query: ConsultsQueryDto, claims: RequestClaims): Promise<{ items: ConsultSummaryDto[]; nextCursor?: string }> {
    return this.withTenant(claims.orgId, async (tenantContext) => {
      this.logOperation('GET_CONSULTS', claims.orgId, { query })

      const where: any = {
        orgId: claims.orgId,
      }

      if (query.status) {
        where.status = query.status
      }

      const take = query.limit || 50

      const consults = await this.prisma.consult.findMany({
        where,
        take: take + 1,
        cursor: query.cursor ? { id: query.cursor } : undefined,
        orderBy: { createdAt: 'desc' },
        include: {
          patient: true,
          org: true,
        },
      })

      const itemsResponse = consults.map((consult: any) => ({
        id: consult.id,
        status: consult.status,
        created_at: consult.createdAt.toISOString(),
        provider_org_id: consult.providerOrgId,
      }))

      return this.createPaginatedResponse(
        itemsResponse,
        take,
        (item) => item.id
      )
    })
  }

  async getConsult(id: string, claims: RequestClaims): Promise<ConsultDetailDto> {
    return this.withTenant(claims.orgId, async (tenantContext) => {
      this.logOperation('GET_CONSULT', claims.orgId, { consultId: id })

      const consult = await this.prisma.consult.findUnique({
        where: { id },
        include: {
          patient: true,
          org: true,
        },
      })

    if (!consult) {
      throw new NotFoundException('Consult not found')
    }

    // Check if user has access to this consult
    if (consult.orgId !== claims.orgId) {
      throw new ForbiddenException('Access denied')
    }

    // For marketers, only return summary data
    if (claims.role === 'MARKETER') {
      return {
        id: consult.id,
        status: consult.status,
        created_at: consult.createdAt.toISOString(),
        provider_org_id: consult.providerOrgId,
        patient: {
          id: consult.patient.id,
          legal_name: consult.patient.legalName,
          dob: consult.patient.dob.toISOString(),
          address: consult.patient.address as any,
        },
        reason_codes: consult.reasonCodes,
        created_from: consult.createdFrom,
      }
    }

      return {
        id: consult.id,
        status: consult.status,
        created_at: consult.createdAt.toISOString(),
        provider_org_id: consult.providerOrgId,
        patient: {
          id: consult.patient.id,
          legal_name: consult.patient.legalName,
          dob: consult.patient.dob.toISOString(),
          address: consult.patient.address as any,
        },
        reason_codes: consult.reasonCodes,
        created_from: consult.createdFrom,
      }
    })
  }

  async updateConsultStatus(id: string, updateDto: UpdateConsultStatusDto, claims: RequestClaims) {
    const consult = await this.prisma.consult.findUnique({
      where: { id },
    })

    if (!consult) {
      throw new NotFoundException('Consult not found')
    }

    if (consult.orgId !== claims.orgId) {
      throw new ForbiddenException('Access denied')
    }

    const updatedConsult = await this.prisma.consult.update({
      where: { id },
      data: { status: updateDto.status },
    })

    return {
      id: updatedConsult.id,
      status: updatedConsult.status,
    }
  }
}
