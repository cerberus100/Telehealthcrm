import { Injectable, Logger } from '@nestjs/common';
import { TelemetryService } from '../utils/telemetry.service';
import { PrismaService } from '../prisma.service';
import { ConfigService } from '@nestjs/config';

export interface BusinessMetrics {
  consults: {
    total: number;
    passed: number;
    failed: number;
    approved: number;
    pending: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  shipments: {
    total: number;
    inTransit: number;
    delivered: number;
    exception: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  prescriptions: {
    total: number;
    submitted: number;
    dispensed: number;
    rejected: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  users: {
    total: number;
    byRole: Record<string, number>;
  };
  organizations: {
    total: number;
    byType: Record<string, number>;
  };
  notifications: {
    total: number;
    unread: number;
    today: number;
    byType: Record<string, number>;
  };
}

@Injectable()
export class BusinessMetricsService {
  private readonly logger = new Logger(BusinessMetricsService.name);
  private metricsCache: BusinessMetrics | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly telemetryService: TelemetryService,
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async getBusinessMetrics(orgId?: string): Promise<BusinessMetrics> {
    const now = Date.now();
    
    // Return cached metrics if still valid
    if (this.metricsCache && now < this.cacheExpiry) {
      return this.metricsCache;
    }

    try {
      const metrics = await this.calculateBusinessMetrics(orgId);
      
      // Cache the results
      this.metricsCache = metrics;
      this.cacheExpiry = now + this.CACHE_TTL;

      // Record metrics to telemetry
      await this.recordMetricsToTelemetry(metrics);

      return metrics;
    } catch (error) {
      this.logger.error('Failed to calculate business metrics:', error);
      throw error;
    }
  }

  private async calculateBusinessMetrics(orgId?: string): Promise<BusinessMetrics> {
    const whereClause = orgId ? { providerOrgId: orgId } : {};
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getTime() - (now.getDay() * 24 * 60 * 60 * 1000));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Parallel queries for better performance
    const [
      consultCounts,
      shipmentCounts,
      prescriptionCounts,
      userCounts,
      orgCounts,
      notificationCounts,
    ] = await Promise.all([
      this.getConsultMetrics(whereClause, startOfDay, startOfWeek, startOfMonth),
      this.getShipmentMetrics(whereClause, startOfDay, startOfWeek, startOfMonth),
      this.getPrescriptionMetrics(whereClause, startOfDay, startOfWeek, startOfMonth),
      this.getUserMetrics(orgId),
      this.getOrganizationMetrics(),
      this.getNotificationMetrics(orgId, startOfDay),
    ]);

    return {
      consults: consultCounts,
      shipments: shipmentCounts,
      prescriptions: prescriptionCounts,
      users: userCounts,
      organizations: orgCounts,
      notifications: notificationCounts,
    };
  }

  private async getConsultMetrics(
    whereClause: any,
    startOfDay: Date,
    startOfWeek: Date,
    startOfMonth: Date,
  ) {
    const [total, passed, failed, approved, pending, today, thisWeek, thisMonth] = await Promise.all([
      this.prismaService.consult.count({ where: whereClause }),
      this.prismaService.consult.count({ where: { ...whereClause, status: 'PASSED' } }),
      this.prismaService.consult.count({ where: { ...whereClause, status: 'FAILED' } }),
      this.prismaService.consult.count({ where: { ...whereClause, status: 'APPROVED' } }),
      this.prismaService.consult.count({ where: { ...whereClause, status: 'PENDING' } }),
      this.prismaService.consult.count({ where: { ...whereClause, createdAt: { gte: startOfDay } } }),
      this.prismaService.consult.count({ where: { ...whereClause, createdAt: { gte: startOfWeek } } }),
      this.prismaService.consult.count({ where: { ...whereClause, createdAt: { gte: startOfMonth } } }),
    ]);

    return { total, passed, failed, approved, pending, today, thisWeek, thisMonth };
  }

  private async getShipmentMetrics(
    whereClause: any,
    startOfDay: Date,
    startOfWeek: Date,
    startOfMonth: Date,
  ) {
    const [total, inTransit, delivered, exception, today, thisWeek, thisMonth] = await Promise.all([
      this.prismaService.shipment.count({ where: whereClause }),
      this.prismaService.shipment.count({ where: { ...whereClause, status: 'IN_TRANSIT' } }),
      this.prismaService.shipment.count({ where: { ...whereClause, status: 'DELIVERED' } }),
      this.prismaService.shipment.count({ where: { ...whereClause, status: 'EXCEPTION' } }),
      this.prismaService.shipment.count({ where: { ...whereClause, createdAt: { gte: startOfDay } } }),
      this.prismaService.shipment.count({ where: { ...whereClause, createdAt: { gte: startOfWeek } } }),
      this.prismaService.shipment.count({ where: { ...whereClause, createdAt: { gte: startOfMonth } } }),
    ]);

    return { total, inTransit, delivered, exception, today, thisWeek, thisMonth };
  }

  private async getPrescriptionMetrics(
    whereClause: any,
    startOfDay: Date,
    startOfWeek: Date,
    startOfMonth: Date,
  ) {
    const [total, submitted, dispensed, rejected, today, thisWeek, thisMonth] = await Promise.all([
      this.prismaService.rx.count({ where: whereClause }),
      this.prismaService.rx.count({ where: { ...whereClause, status: 'SUBMITTED' } }),
      this.prismaService.rx.count({ where: { ...whereClause, status: 'DISPENSED' } }),
      this.prismaService.rx.count({ where: { ...whereClause, status: 'REJECTED' } }),
      this.prismaService.rx.count({ where: { ...whereClause, createdAt: { gte: startOfDay } } }),
      this.prismaService.rx.count({ where: { ...whereClause, createdAt: { gte: startOfWeek } } }),
      this.prismaService.rx.count({ where: { ...whereClause, createdAt: { gte: startOfMonth } } }),
    ]);

    return { total, submitted, dispensed, rejected, today, thisWeek, thisMonth };
  }

  private async getUserMetrics(orgId?: string) {
    const whereClause = orgId ? { orgId } : {};
    
    const [total, byRole] = await Promise.all([
      this.prismaService.user.count({ where: whereClause }),
      this.getUserCountsByRole(whereClause),
    ]);

    return { total, byRole };
  }

  private async getUserCountsByRole(whereClause: any) {
    const roles = ['ADMIN', 'DOCTOR', 'LAB_TECH', 'PHARMACIST', 'MARKETER', 'SUPPORT'];
    const byRole: Record<string, number> = {};

    for (const role of roles) {
      byRole[role] = await this.prismaService.user.count({
        where: { ...whereClause, role },
      });
    }

    return byRole;
  }

  private async getOrganizationMetrics() {
    const [total, byType] = await Promise.all([
      this.prismaService.organization.count(),
      this.getOrganizationCountsByType(),
    ]);

    return { total, byType };
  }

  private async getOrganizationCountsByType() {
    const types = ['PROVIDER', 'LAB', 'PHARMACY', 'MARKETER'] as const;
    const byType: Record<string, number> = {};

    for (const type of types) {
      byType[type] = await this.prismaService.organization.count({
        where: { type },
      });
    }

    return byType;
  }

  private async getNotificationMetrics(orgId?: string, startOfDay?: Date) {
    const whereClause = orgId ? { orgId } : {};
    
    const [total, unread, today, byType] = await Promise.all([
      this.prismaService.notification.count({ where: whereClause }),
      this.prismaService.notification.count({ where: { ...whereClause, status: 'PENDING' } }),
      startOfDay ? this.prismaService.notification.count({ where: { ...whereClause, createdAt: { gte: startOfDay } } }) : 0,
      this.getNotificationCountsByType(whereClause),
    ]);

    return { total, unread, today, byType };
  }

  private async getNotificationCountsByType(whereClause: any) {
    const types = ['CONSULT_STATUS_CHANGE', 'SHIPMENT_UPDATE', 'RX_STATUS_CHANGE', 'SYSTEM_ALERT', 'USER_MANAGEMENT'];
    const byType: Record<string, number> = {};

    for (const type of types) {
      byType[type] = await this.prismaService.notification.count({
        where: { ...whereClause, type },
      });
    }

    return byType;
  }

  private async recordMetricsToTelemetry(metrics: BusinessMetrics): Promise<void> {
    try {
      // Record consult metrics
      this.telemetryService.recordMetric('business.consults.total', metrics.consults.total);
      this.telemetryService.recordMetric('business.consults.passed', metrics.consults.passed);
      this.telemetryService.recordMetric('business.consults.failed', metrics.consults.failed);
      this.telemetryService.recordMetric('business.consults.approved', metrics.consults.approved);
      this.telemetryService.recordMetric('business.consults.today', metrics.consults.today);

      // Record shipment metrics
      this.telemetryService.recordMetric('business.shipments.total', metrics.shipments.total);
      this.telemetryService.recordMetric('business.shipments.in_transit', metrics.shipments.inTransit);
      this.telemetryService.recordMetric('business.shipments.delivered', metrics.shipments.delivered);
      this.telemetryService.recordMetric('business.shipments.exception', metrics.shipments.exception);

      // Record prescription metrics
      this.telemetryService.recordMetric('business.prescriptions.total', metrics.prescriptions.total);
      this.telemetryService.recordMetric('business.prescriptions.submitted', metrics.prescriptions.submitted);
      this.telemetryService.recordMetric('business.prescriptions.dispensed', metrics.prescriptions.dispensed);

      // Record user metrics
      this.telemetryService.recordMetric('business.users.total', metrics.users.total);

      // Record organization metrics
      this.telemetryService.recordMetric('business.organizations.total', metrics.organizations.total);

      // Record notification metrics
      this.telemetryService.recordMetric('business.notifications.total', metrics.notifications.total);
      this.telemetryService.recordMetric('business.notifications.unread', metrics.notifications.unread);
      this.telemetryService.recordMetric('business.notifications.today', metrics.notifications.today);

      this.logger.log('Business metrics recorded to telemetry successfully');
    } catch (error) {
      this.logger.error('Failed to record metrics to telemetry:', error);
    }
  }

  // Method to clear cache (useful for testing or manual refresh)
  clearCache(): void {
    this.metricsCache = null;
    this.cacheExpiry = 0;
  }

  // Method to get cached metrics without calculation
  getCachedMetrics(): BusinessMetrics | null {
    return this.metricsCache;
  }
}
