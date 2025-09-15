import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { logger } from '../utils/logger'
import { PhiRedactor } from '../utils/phi-redactor'

export interface AuditEvent {
  correlationId: string
  actorUserId?: string
  actorOrgId?: string
  actorRole?: string
  actorIp?: string
  action: string
  resource: string
  resourceId?: string
  purposeOfUse?: string
  breakGlass?: boolean
  beforeState?: any
  afterState?: any
  userAgent?: string
  sessionId?: string
  success: boolean
  error?: string
  details?: any
}

export interface AuditQuery {
  entity?: string
  entityId?: string
  actorUserId?: string
  actorOrgId?: string
  action?: string
  startDate?: Date
  endDate?: Date
  cursor?: string
  limit?: number
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async logActivity(event: AuditEvent): Promise<void> {
    try {
      await this.logEvent(event);
    } catch (error) {
      logger.error({
        action: 'LOG_ACTIVITY_FAILED',
        error: (error as Error).message,
      });
      // Don't throw error to prevent breaking the main flow
    }
  }

  /**
   * Log an audit event
   */
  async logEvent(event: AuditEvent): Promise<void> {
    try {
      // Redact PHI from before/after states
      const redactedBefore = event.beforeState ? 
        PhiRedactor.redactObject(event.beforeState) : null
      const redactedAfter = event.afterState ? 
        PhiRedactor.redactObject(event.afterState) : null

      // Create audit log entry
      await this.prisma.auditLog.create({
        data: {
          actorUserId: event.actorUserId,
          actorOrgId: event.actorOrgId,
          action: event.action,
          entity: event.resource,
          entityId: event.resourceId || '',
          ip: event.actorIp,
          purposeOfUse: event.purposeOfUse,
          before: redactedBefore,
          after: redactedAfter,
        },
      })

      // Log to structured logger for real-time monitoring
      logger.info({
        action: 'AUDIT_EVENT_LOGGED',
        audit_action: event.action,
        audit_resource: event.resource,
        audit_resource_id: event.resourceId,
        actor_user_id: event.actorUserId,
        actor_org_id: event.actorOrgId,
        actor_role: event.actorRole,
        success: event.success,
        correlation_id: event.correlationId,
        phi_redacted: !!(event.beforeState || event.afterState),
      })

      // Alert on suspicious activities
      await this.detectSuspiciousActivity(event)
    } catch (error) {
      logger.error({
        action: 'AUDIT_LOG_FAILED',
        error: (error as Error).message,
        event: PhiRedactor.redactObject(event),
      })
    }
  }

  /**
   * Log authentication events
   */
  async logAuthEvent(event: Omit<AuditEvent, 'resource' | 'resourceId'> & {
    authType: 'login' | 'logout' | 'refresh' | 'failed_login'
    userId?: string
    email?: string
  }): Promise<void> {
    await this.logEvent({
      ...event,
      resource: 'Auth',
      resourceId: event.userId,
      action: event.authType,
    })
  }

  /**
   * Log PHI access events
   */
  async logPhiAccess(event: Omit<AuditEvent, 'resource'> & {
    phiType: 'patient' | 'consult' | 'lab_result' | 'rx'
    patientId?: string
    consultId?: string
    purposeOfUse: string
  }): Promise<void> {
    await this.logEvent({
      ...event,
      resource: event.phiType,
      resourceId: event.patientId || event.consultId,
      purposeOfUse: event.purposeOfUse,
    })
  }

  /**
   * Log admin actions
   */
  async logAdminAction(event: Omit<AuditEvent, 'resource'> & {
    adminAction: 'user_create' | 'user_update' | 'user_delete' | 'role_change' | 'org_create' | 'org_update'
    targetUserId?: string
    targetOrgId?: string
    changes?: any
  }): Promise<void> {
    await this.logEvent({
      ...event,
      resource: 'Admin',
      resourceId: event.targetUserId || event.targetOrgId,
      action: event.adminAction,
      beforeState: event.changes?.before,
      afterState: event.changes?.after,
    })
  }

  /**
   * Query audit logs
   */
  async queryAuditLogs(query: AuditQuery): Promise<{
    items: any[]
    nextCursor?: string
    total: number
  }> {
    try {
      const where: any = {}

      if (query.entity) {
        where.entity = query.entity
      }

      if (query.entityId) {
        where.entityId = query.entityId
      }

      if (query.actorUserId) {
        where.actorUserId = query.actorUserId
      }

      if (query.actorOrgId) {
        where.actorOrgId = query.actorOrgId
      }

      if (query.action) {
        where.action = query.action
      }

      if (query.startDate || query.endDate) {
        where.ts = {}
        if (query.startDate) {
          where.ts.gte = query.startDate
        }
        if (query.endDate) {
          where.ts.lte = query.endDate
        }
      }

      const limit = Math.min(query.limit || 50, 100)
      const skip = query.cursor ? 1 : 0

      const [items, total] = await Promise.all([
        this.prisma.auditLog.findMany({
          where,
          orderBy: { ts: 'desc' },
          take: limit,
          skip,
          cursor: query.cursor ? { id: query.cursor } : undefined,
        }),
        this.prisma.auditLog.count({ where }),
      ])

      const nextCursor = items.length === limit && items[items.length - 1] ? items[items.length - 1]?.id : undefined

      return {
        items: items.map((item: any) => ({
          id: item.id,
          timestamp: item.ts,
          actor: {
            user_id: item.actorUserId,
            org_id: item.actorOrgId,
          },
          action: item.action,
          resource: item.entity,
          resource_id: item.entityId,
          purpose_of_use: item.purposeOfUse,
          ip: item.ip,
          before_state: item.before,
          after_state: item.after,
        })),
        nextCursor,
        total,
      }
    } catch (error) {
      logger.error({
        action: 'AUDIT_QUERY_FAILED',
        error: (error as Error).message,
        query: PhiRedactor.redactObject(query),
      })
      throw error
    }
  }

  /**
   * Detect suspicious activities
   */
  private async detectSuspiciousActivity(event: AuditEvent): Promise<void> {
    // Check for failed login attempts
    if (event.action === 'failed_login') {
      const recentFailures = await this.prisma.auditLog.count({
        where: {
          action: 'failed_login',
          ip: event.actorIp,
          ts: {
            gte: new Date(Date.now() - 15 * 60 * 1000), // Last 15 minutes
          },
        },
      })

      if (recentFailures >= 5) {
        logger.warn({
          action: 'SUSPICIOUS_LOGIN_ATTEMPTS',
          ip: event.actorIp,
          failure_count: recentFailures,
          time_window: '15_minutes',
        })
      }
    }

    // Check for cross-org access attempts
    if (event.action === 'read' && event.actorRole !== 'SUPER_ADMIN') {
      const crossOrgAttempts = await this.prisma.auditLog.count({
        where: {
          action: 'read',
          actorUserId: event.actorUserId,
          ts: {
            gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
          },
        },
      })

      if (crossOrgAttempts >= 10) {
        logger.warn({
          action: 'SUSPICIOUS_CROSS_ORG_ACCESS',
          user_id: event.actorUserId,
          org_id: event.actorOrgId,
          access_count: crossOrgAttempts,
          time_window: '1_hour',
        })
      }
    }

    // Check for PHI access without purpose of use
    if (event.action === 'read' && ['patient', 'consult', 'lab_result', 'rx'].includes(event.resource) && !event.purposeOfUse) {
      logger.warn({
        action: 'PHI_ACCESS_WITHOUT_PURPOSE',
        user_id: event.actorUserId,
        org_id: event.actorOrgId,
        role: event.actorRole,
        resource: event.resource,
        resource_id: event.resourceId,
      })
    }
  }

  /**
   * Export audit logs for compliance
   */
  async exportAuditLogs(startDate: Date, endDate: Date, format: 'json' | 'csv' = 'json'): Promise<string> {
    try {
      const logs = await this.prisma.auditLog.findMany({
        where: {
          ts: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { ts: 'asc' },
      })

      if (format === 'csv') {
        return this.convertToCsv(logs)
      }

      return JSON.stringify(logs, null, 2)
    } catch (error) {
      logger.error({
        action: 'AUDIT_EXPORT_FAILED',
        error: (error as Error).message,
        start_date: startDate,
        end_date: endDate,
        format,
      })
      throw error
    }
  }

  /**
   * Convert audit logs to CSV format
   */
  private convertToCsv(logs: any[]): string {
    const headers = [
      'id',
      'timestamp',
      'actor_user_id',
      'actor_org_id',
      'action',
      'entity',
      'entity_id',
      'ip',
      'purpose_of_use',
    ]

    const csvRows = [headers.join(',')]

    for (const log of logs) {
      const row = [
        log.id,
        log.ts.toISOString(),
        log.actorUserId || '',
        log.actorOrgId || '',
        log.action,
        log.entity,
        log.entityId || '',
        log.ip || '',
        log.purposeOfUse || '',
      ]
      csvRows.push(row.join(','))
    }

    return csvRows.join('\n')
  }

  /**
   * Clean up old audit logs (retention policy)
   */
  async cleanupOldLogs(retentionDays: number = 2555): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)

      const result = await this.prisma.auditLog.deleteMany({
        where: {
          ts: {
            lt: cutoffDate,
          },
        },
      })

      logger.info({
        action: 'AUDIT_LOG_CLEANUP',
        deleted_count: result.count,
        retention_days: retentionDays,
        cutoff_date: cutoffDate.toISOString(),
      })

      return result.count
    } catch (error) {
      logger.error({
        action: 'AUDIT_LOG_CLEANUP_FAILED',
        error: (error as Error).message,
        retention_days: retentionDays,
      })
      throw error
    }
  }
}
