import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { RequestClaims } from '../types/claims'
import { logger } from '../utils/logger'

@Injectable()
export class MarketerService {
  private demo: boolean

  constructor(private readonly prisma: PrismaService) {
    this.demo = process.env.API_DEMO_MODE === 'true'
  }

  async getApprovals(query: any, claims: RequestClaims) {
    try {
      if (this.demo) {
        // Demo approvals data with HIPAA-safe marketer view
        const mockApprovals = [
          {
            id: 'a_1',
            type: 'LABS',
            consultId: 'c_1',
            patientInitials: 'J.D.',
            service: 'NEURO Cognitive',
            status: 'APPROVED',
            approvedAt: new Date().toISOString(),
            shipping: {
              city: 'Austin',
              state: 'TX',
              trackingNumber: '1Z999AA123456789'
            }
          },
          {
            id: 'a_2',
            type: 'RX',
            consultId: 'c_2', 
            patientInitials: 'M.S.',
            service: 'Prescription',
            status: 'DECLINED',
            declinedAt: new Date(Date.now() - 3600000).toISOString(),
            reason: 'Insufficient documentation'
          }
        ]

        const filtered = mockApprovals.filter(a => 
          (!query.service || a.type === query.service) &&
          (!query.status || a.status === query.status)
        )

        return { items: filtered.slice(0, query.limit), next_cursor: null }
      }

      // Production: query consults with marketer-safe fields only
      const items = await (this.prisma as any).consult?.findMany({
        where: {
          marketerOrgId: claims.orgId,
          ...(query.status && { status: query.status }),
          ...(query.from && { createdAt: { gte: new Date(query.from) } }),
          ...(query.to && { createdAt: { lte: new Date(query.to) } })
        },
        select: {
          id: true,
          status: true,
          createdAt: true,
          patient: {
            select: {
              // HIPAA minimum necessary: initials only for marketers
              legalName: true
            }
          },
          labOrders: {
            select: {
              id: true,
              tests: true,
              shipments: {
                select: {
                  trackingNumber: true,
                  status: true,
                  shipTo: {
                    select: { city: true, state: true }
                  }
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: query.limit
      })

      // Transform to marketer-safe format
      const transformed = (items || []).map((item: any) => ({
        id: item.id,
        consultId: item.id,
        patientInitials: item.patient?.legalName?.split(' ').map((n: string) => n[0]).join('.') + '.',
        status: item.status,
        service: item.labOrders?.[0]?.tests?.join(', ') || 'Unknown',
        shipping: item.labOrders?.[0]?.shipments?.[0] || null,
        approvedAt: item.status === 'APPROVED' ? item.createdAt : null,
        declinedAt: item.status === 'DECLINED' ? item.createdAt : null
      }))

      return { items: transformed, next_cursor: null }
    } catch (error) {
      logger.error({
        action: 'GET_APPROVALS_FAILED',
        error: (error as Error).message,
        orgId: claims.orgId
      })
      throw error
    }
  }

  async getApprovalPackUrl(id: string, claims: RequestClaims) {
    try {
      // Generate time-limited signed URL for approval pack PDF
      // In production: create PDF bundle and return S3 signed URL
      
      logger.info({
        action: 'APPROVAL_PACK_REQUESTED',
        approvalId: id,
        orgId: claims.orgId,
        userId: claims.sub,
        audit: true
      })

      return {
        url: `https://demo-bucket.s3.amazonaws.com/approval-packs/${id}.pdf?expires=${Date.now() + 1800000}`,
        expiresAt: new Date(Date.now() + 1800000).toISOString()
      }
    } catch (error) {
      logger.error({
        action: 'GET_APPROVAL_PACK_FAILED',
        error: (error as Error).message,
        approvalId: id,
        orgId: claims.orgId
      })
      throw error
    }
  }

  async exportUpsCSV(body: any, claims: RequestClaims) {
    try {
      // Generate UPS WorldShip CSV with shipping-necessary fields only
      const headers = [
        'ShipToName',
        'ShipToAddress1', 
        'ShipToCity',
        'ShipToState',
        'ShipToPostalCode',
        'ShipToPhone',
        'Reference1',
        'Service',
        'PackagingType'
      ]

      const rows = body.ids.map((id: string) => [
        'Patient Name', // Would be from approval record
        '123 Main St',
        'Austin',
        'TX', 
        '78701',
        '5551234567',
        `CONSULT-${id}`,
        'UPS_GROUND',
        'PACKAGE'
      ])

      const csv = [headers, ...rows].map(row => row.join(',')).join('\n')

      logger.info({
        action: 'UPS_CSV_EXPORTED',
        recordCount: body.ids.length,
        orgId: claims.orgId,
        userId: claims.sub,
        audit: true
      })

      return csv
    } catch (error) {
      logger.error({
        action: 'EXPORT_UPS_CSV_FAILED',
        error: (error as Error).message,
        orgId: claims.orgId
      })
      throw error
    }
  }
}
