import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { RequestClaims } from '../types/claims'
import { RxQueryDto, RxSummaryDto, RxDetailDto } from '../types/dto'

@Injectable()
export class RxService {
  constructor(private prisma: PrismaService) {}

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

    const hasNext = rxs.length > take
    const items = rxs.slice(0, take)

    const itemsResponse = items.map((rx: any) => ({
      id: rx.id,
      status: rx.status,
      created_at: rx.createdAt.toISOString(),
      consult_id: rx.consultId,
      pharmacy_org_id: rx.pharmacyOrgId,
    }))

    const last = items.length > 0 ? items[items.length - 1] : null
    return {
      items: itemsResponse,
      next_cursor: hasNext && last ? last.id : null,
    }
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
