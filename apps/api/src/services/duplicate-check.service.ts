import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { logger } from '../utils/logger'
import crypto from 'crypto'

@Injectable()
export class DuplicateCheckService {
  private demo: boolean
  private memory: Map<string, any>

  constructor(private readonly prisma: PrismaService) {
    this.demo = process.env.API_DEMO_MODE === 'true'
    this.memory = new Map()
    
    // Seed demo data with some completed tests
    if (this.demo) {
      this.seedDemoData()
    }
  }

  private seedDemoData() {
    // Demo Medicare IDs with completed tests
    const demoCompletedTests = [
      {
        medicareId: '1A2B3C4D5E',
        patientName: 'John Demo',
        testCategory: 'NEURO',
        testType: 'COGNITIVE',
        completedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
        labOrderId: 'lo_demo_1',
        resultStatus: 'COMPLETED'
      },
      {
        medicareId: '9Z8Y7X6W5V',
        patientName: 'Jane Sample',
        testCategory: 'IMMUNE',
        testType: 'AUTOIMMUNE_PANEL',
        completedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(), // 45 days ago
        labOrderId: 'lo_demo_2',
        resultStatus: 'COMPLETED'
      }
    ]

    demoCompletedTests.forEach(test => {
      this.memory.set(`medicare_${test.medicareId}`, test)
    })
  }

  async checkMedicareId(params: {
    medicareId: string
    testCategory: string
    testType?: string
    patientName?: string
    dob?: string
  }) {
    try {
      const { medicareId, testCategory, testType, patientName, dob } = params
      
      // Hash Medicare ID for secure storage/lookup
      const hashedMedicareId = crypto.createHash('sha256').update(medicareId).digest('hex')
      
      if (this.demo) {
        const existing = this.memory.get(`medicare_${medicareId}`)
        
        if (existing && existing.testCategory === testCategory) {
          const daysSince = Math.floor((Date.now() - new Date(existing.completedAt).getTime()) / (1000 * 60 * 60 * 24))
          
          // Consider recent if within 90 days for NEURO, 180 days for IMMUNE
          const recentThreshold = testCategory === 'NEURO' ? 90 : 180
          const isRecent = daysSince <= recentThreshold
          
          logger.info({
            action: 'DUPLICATE_CHECK_HIT',
            medicareIdHash: hashedMedicareId.substring(0, 8),
            testCategory,
            daysSinceCompleted: daysSince,
            isRecent,
            audit: true
          })
          
          return {
            isDuplicate: true,
            isRecent,
            existing: {
              patientName: existing.patientName,
              testCategory: existing.testCategory,
              testType: existing.testType,
              completedAt: existing.completedAt,
              daysSince,
              labOrderId: existing.labOrderId,
              resultStatus: existing.resultStatus
            },
            recommendation: isRecent 
              ? 'BLOCK_DUPLICATE' 
              : 'WARN_PREVIOUS_TEST',
            message: isRecent
              ? `Patient completed ${testCategory} test ${daysSince} days ago. Recent test may not be covered by insurance.`
              : `Patient has previous ${testCategory} test from ${daysSince} days ago. Consider if new test is medically necessary.`
          }
        }
        
        return {
          isDuplicate: false,
          isRecent: false,
          recommendation: 'PROCEED',
          message: 'No recent tests found. Safe to proceed.'
        }
      }

      // Production: Query encrypted Medicare ID
      const patients = await (this.prisma as any).patient?.findMany({
        where: {
          insurancePolicy: {
            memberIdEncrypted: hashedMedicareId // In production, this would be KMS-encrypted
          }
        },
        include: {
          labOrders: {
            where: {
              tests: { hasSome: [testCategory] },
              status: { in: ['RESULTS_READY', 'COMPLETED'] }
            },
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      })

      if (patients && patients.length > 0) {
        const patient = patients[0]
        const recentTest = patient.labOrders?.[0]
        
        if (recentTest) {
          const daysSince = Math.floor((Date.now() - new Date(recentTest.createdAt).getTime()) / (1000 * 60 * 60 * 24))
          const recentThreshold = testCategory === 'NEURO' ? 90 : 180
          const isRecent = daysSince <= recentThreshold
          
          return {
            isDuplicate: true,
            isRecent,
            existing: {
              patientName: patient.legalName,
              testCategory,
              completedAt: recentTest.createdAt,
              daysSince,
              labOrderId: recentTest.id
            },
            recommendation: isRecent ? 'BLOCK_DUPLICATE' : 'WARN_PREVIOUS_TEST',
            message: isRecent
              ? `Patient completed ${testCategory} test ${daysSince} days ago. Recent test may not be covered by insurance.`
              : `Patient has previous ${testCategory} test from ${daysSince} days ago. Consider if new test is medically necessary.`
          }
        }
      }

      return {
        isDuplicate: false,
        isRecent: false,
        recommendation: 'PROCEED',
        message: 'No recent tests found. Safe to proceed.'
      }
    } catch (error) {
      logger.error({
        action: 'DUPLICATE_CHECK_FAILED',
        error: (error as Error).message,
        testCategory: params.testCategory
      })
      
      // Fail open for safety - don't block if check fails
      return {
        isDuplicate: false,
        isRecent: false,
        recommendation: 'PROCEED_WITH_CAUTION',
        message: 'Unable to verify previous tests. Please verify manually.'
      }
    }
  }
}
