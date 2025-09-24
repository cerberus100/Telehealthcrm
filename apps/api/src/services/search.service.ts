import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { RequestClaims } from '../types/claims'
import { logger } from '../utils/logger'
import { normalizePhone, getPhoneDigits } from '../integrations/connect/connect-lambda'

@Injectable()
export class SearchService {
  private demo: boolean

  constructor(private readonly prisma: PrismaService) {
    this.demo = process.env.API_DEMO_MODE === 'true'
  }

  async searchPatients(query: { q: string; limit?: number }, claims: RequestClaims) {
    try {
      if (this.demo) {
        // Demo search results
        const mockPatients = [
          {
            id: 'p_1',
            legalName: 'Jane Doe',
            dob: '1985-03-15',
            phones: ['+15551234567'],
            lastActivity: new Date().toISOString()
          },
          {
            id: 'p_2', 
            legalName: 'John Smith',
            dob: '1978-11-22',
            phones: ['+15559876543'],
            lastActivity: new Date(Date.now() - 86400000).toISOString()
          }
        ]

        const filtered = mockPatients.filter(p => 
          p.legalName.toLowerCase().includes(query.q.toLowerCase()) ||
          p.phones.some(phone => phone.includes(query.q.replace(/\D/g, '')))
        )

        return { items: filtered.slice(0, query.limit || 25), next_cursor: undefined }
      }

      // Parse search tokens: name:"Jane Doe" phone:555-1234 dob:1990
      const tokens = this.parseSearchTokens(query.q)
      
      const patients = await (this.prisma as any).patient?.findMany({
        where: {
          orgId: claims.orgId,
          ...(tokens.name && { 
            legalName: { contains: tokens.name, mode: 'insensitive' } 
          }),
          ...(tokens.phone && { 
            phones: { hasSome: [normalizePhone(tokens.phone)] } 
          }),
          ...(tokens.dob && { 
            dob: new Date(tokens.dob) 
          })
        },
        select: {
          id: true,
          legalName: true,
          dob: true,
          phones: true,
          lastActivity: true
        },
        orderBy: { lastActivity: 'desc' },
        take: query.limit || 25
      })

      return { items: patients || [], next_cursor: undefined }
    } catch (error) {
      logger.error({
        action: 'SEARCH_PATIENTS_FAILED',
        error: (error as Error).message,
        query: query.q,
        orgId: claims.orgId
      })
      throw error
    }
  }

  async findPatientsByPhone(phone: string, claims: RequestClaims) {
    try {
      const normalized = normalizePhone(phone)
      if (!normalized) throw new Error('Invalid phone format')

      if (this.demo) {
        const mockResults = [
          {
            id: 'p_phone_1',
            legalName: 'Jane Doe',
            phones: [normalized],
            lastActivity: new Date().toISOString(),
            nextAction: 'Review consult'
          }
        ]
        return { items: mockResults, next_cursor: undefined }
      }

      const { digits10, digits7 } = getPhoneDigits(normalized)
      
      // Search by exact E.164, then by last 10 digits, then by last 7
      const patients = await (this.prisma as any).patient?.findMany({
        where: {
          orgId: claims.orgId,
          OR: [
            { phones: { hasSome: [normalized] } },
            { phones: { hasSome: [digits10] } },
            { phones: { hasSome: [digits7] } }
          ]
        },
        select: {
          id: true,
          legalName: true,
          phones: true,
          lastActivity: true
        },
        orderBy: { lastActivity: 'desc' },
        take: 10
      })

      logger.info({
        action: 'PHONE_SEARCH_COMPLETED',
        phone: digits10, // Log last 10 digits only
        resultsCount: patients?.length || 0,
        orgId: claims.orgId
      })

      return { items: patients || [], next_cursor: undefined }
    } catch (error) {
      logger.error({
        action: 'PHONE_SEARCH_FAILED',
        error: (error as Error).message,
        orgId: claims.orgId
      })
      throw error
    }
  }

  private parseSearchTokens(query: string): Record<string, string> {
    const tokens: Record<string, string> = {}
    
    // Parse tokens like: name:"Jane Doe" phone:555-1234 dob:1990
    const tokenPattern = /(\w+):(?:"([^"]+)"|(\S+))/g
    let match
    
    while ((match = tokenPattern.exec(query)) !== null) {
      const key = match[1]
      const quotedValue = match[2]
      const unquotedValue = match[3]
      if (key) {
        tokens[key] = quotedValue || unquotedValue || ''
      }
    }
    
    // If no tokens found, treat as name search
    if (Object.keys(tokens).length === 0) {
      tokens.name = query
    }
    
    return tokens
  }
}
