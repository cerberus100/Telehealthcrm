import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
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
export class ConsultsService {
  constructor(private prisma: PrismaService) {}

  async getConsults(query: ConsultsQueryDto, claims: RequestClaims) {
    const where: any = {
      orgId: claims.orgId,
    }

    if (query.status) {
      where.status = query.status
    }

    const take = query.limit || 50
    const skip = query.cursor ? 1 : 0

    const consults = await this.prisma.consult.findMany({
      where,
      take: take + 1,
      skip: query.cursor ? 1 : 0,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        patient: true,
        org: true,
      },
    })

    const hasNext = consults.length > take
    const items = consults.slice(0, take)

    const itemsResponse = items.map((consult: any) => ({
      id: consult.id,
      status: consult.status,
      created_at: consult.createdAt.toISOString(),
      provider_org_id: consult.providerOrgId,
    }))

    const last = items.length > 0 ? items[items.length - 1] : null
    return {
      items: itemsResponse,
      next_cursor: hasNext && last ? last.id : null,
    }
  }

  async getConsult(id: string, claims: RequestClaims): Promise<ConsultDetailDto> {
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

    // For marketers, restrict to minimum necessary: status + org linkage only
    if (claims.role === 'MARKETER') {
      return {
        id: consult.id,
        status: consult.status,
        created_at: consult.createdAt.toISOString(),
        provider_org_id: consult.providerOrgId,
        patient: {
          id: 'masked',
          legal_name: 'REDACTED',
          dob: new Date(0).toISOString(),
          address: undefined as any,
        },
        reason_codes: [],
        created_from: 'WEB',
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
