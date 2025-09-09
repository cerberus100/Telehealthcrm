import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { RequestClaims } from '../types/claims'

export interface DashboardMetrics {
  consultsApproved: {
    value: number
    delta: number
    trend: 'up' | 'down'
    sparkline: number[]
  }
  avgTurnaroundTime?: {
    value: number
    suffix: string
    delta: number
    trend: 'up' | 'down'
    sparkline: number[]
  }
  kitsInTransit: {
    value: number
    delta: number
    trend: 'up' | 'down'
    sparkline: number[]
  }
  resultsAging: {
    value: number
    delta: number
    trend: 'up' | 'down'
    sparkline: number[]
  }
}

export interface OperationalMetrics {
  avgTurnaroundTime: {
    value: number
    suffix: string
    delta: number
    trend: 'up' | 'down'
    sparkline: number[]
  }
  // Additional sensitive operational metrics can be added here
  processingEfficiency: {
    value: number
    suffix: string
    delta: number
    trend: 'up' | 'down'
  }
  resourceUtilization: {
    value: number
    suffix: string
    delta: number
    trend: 'up' | 'down'
  }
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get basic dashboard metrics available to all authenticated users
   * Excludes sensitive operational metrics like TAT
   */
  async getMetrics(claims: RequestClaims): Promise<DashboardMetrics> {
    // TODO: Replace with real database queries
    // For now, return mock data similar to the frontend
    const baseMetrics: DashboardMetrics = {
      consultsApproved: {
        value: 128,
        delta: 5,
        trend: 'up',
        sparkline: [5, 7, 8, 9, 10, 9, 12, 14]
      },
      kitsInTransit: {
        value: 42,
        delta: 2,
        trend: 'up',
        sparkline: [20, 22, 25, 28, 30, 33, 38, 42]
      },
      resultsAging: {
        value: 3,
        delta: -1,
        trend: 'down',
        sparkline: [6, 5, 5, 4, 4, 4, 3, 3]
      }
    }

    // Only include TAT for admin roles - this is handled by ABAC policy
    // The frontend will call the operational-metrics endpoint separately
    return baseMetrics
  }

  /**
   * Get sensitive operational metrics (like TAT) restricted to admin roles only
   * Access controlled by ABAC policy
   */
  async getOperationalMetrics(claims: RequestClaims): Promise<OperationalMetrics> {
    // TODO: Replace with real database queries calculating actual TAT
    // This should aggregate consult processing times from the database
    
    return {
      avgTurnaroundTime: {
        value: 2.4,
        suffix: 'h',
        delta: -8,
        trend: 'down',
        sparkline: [3.2, 3.0, 2.9, 2.8, 2.7, 2.6, 2.5, 2.4]
      },
      processingEfficiency: {
        value: 94.2,
        suffix: '%',
        delta: 2.1,
        trend: 'up'
      },
      resourceUtilization: {
        value: 78.5,
        suffix: '%',
        delta: -1.2,
        trend: 'down'
      }
    }
  }

  /**
   * Calculate actual average turnaround time from database
   * TODO: Implement when moving from mock data
   */
  private async calculateAvgTAT(orgId: string): Promise<number> {
    // Example query structure:
    // const result = await this.prisma.consult.aggregate({
    //   where: {
    //     orgId,
    //     status: { in: ['APPROVED', 'DECLINED'] },
    //     createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
    //   },
    //   _avg: {
    //     // Calculate time difference between createdAt and updatedAt
    //   }
    // })
    return 2.4 // Mock value
  }
}

