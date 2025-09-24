import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { BaseService } from './base.service'
import { RequestClaims } from '../types/claims'
import { RxQueryDto, RxSummaryDto, RxDetailDto } from '../types/dto'

@Injectable()
export class RxService extends BaseService {

  async getRxList(query: RxQueryDto, claims: RequestClaims) {
    // Only providers and pharmacists can access Rx data
    if (claims.role !== 'DOCTOR' && claims.role !== 'PHARMACIST' && claims.role !== 'ADMIN') {
      throw new ForbiddenException('Access denied')
    }

    const where: any = {
      orgId: claims.orgId,
    }

    if (query.status) {
      where.status = query.status
    }

    const take = query.limit || 50

    const rxs = await this.prisma.rx.findMany({
      where,
      take: take + 1,
      skip: query.cursor ? 1 : 0,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        consult: true,
      },
    })

    const itemsResponse = rxs.map((rx: any) => ({
      id: rx.id,
      status: rx.status,
      created_at: rx.createdAt.toISOString(),
      consult_id: rx.consultId,
      pharmacy_org_id: rx.pharmacyOrgId,
    }))

    return this.createPaginatedResponse(
      itemsResponse,
      take,
      (item) => item.id
    )
  }

  async getRx(id: string, claims: RequestClaims): Promise<RxDetailDto> {
    // Only providers and pharmacists can access Rx data
    if (claims.role !== 'DOCTOR' && claims.role !== 'PHARMACIST' && claims.role !== 'ADMIN') {
      throw new ForbiddenException('Access denied')
    }

    const rx = await this.prisma.rx.findUnique({
      where: { id },
      include: {
        consult: true,
      },
    })

    if (!rx) {
      throw new NotFoundException('Rx not found')
    }

    if (rx.orgId !== claims.orgId) {
      throw new ForbiddenException('Access denied')
    }

    return {
      id: rx.id,
      status: rx.status,
      created_at: rx.createdAt.toISOString(),
      consult_id: rx.consultId,
      pharmacy_org_id: rx.pharmacyOrgId,
      provider_user_id: rx.providerUserId,
      refills_allowed: rx.refillsAllowed,
      refills_used: rx.refillsUsed,
    }
  }
}
