import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import crypto from 'crypto'

@Injectable()
export class OnboardingService {
  private demo: boolean
  private memory: Map<string, any>

  constructor(private readonly prisma: PrismaService) {
    this.demo = process.env.API_DEMO_MODE === 'true'
    this.memory = new Map()
  }

  async step1(body: { firstName: string; lastName: string; email: string; mobile: string; password: string }) {
    const id = crypto.randomUUID()
    const rec = {
      id,
      email: body.email,
      mobile: body.mobile,
      firstName: body.firstName,
      lastName: body.lastName,
      emailVerified: false,
      mfaEnrolled: false,
      status: 'PENDING',
      stepsCompleted: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    if (this.demo) {
      this.memory.set(id, rec)
      return rec
    }
    const created = await (this.prisma as any).providerOnboarding.create?.({ data: {
      id,
      email: rec.email,
      mobile_phone: rec.mobile,
      first_name: rec.firstName,
      last_name: rec.lastName,
      status: 'PENDING',
      steps_completed: 1,
    } })
    return created ?? rec
  }

  async verifyEmail(body: { id: string; code: string }) {
    const rec = this.demo ? this.memory.get(body.id) : await (this.prisma as any).providerOnboarding.findUnique?.({ where: { id: body.id } })
    if (!rec) throw new Error('Not found')
    rec.emailVerified = true
    rec.stepsCompleted = Math.max(rec.stepsCompleted || 1, 1)
    if (this.demo) { this.memory.set(body.id, rec); return rec }
    const updated = await (this.prisma as any).providerOnboarding.update?.({ where: { id: body.id }, data: { emailVerified: true } })
    return updated ?? rec
  }

  async step2(body: { id: string; npi: string; dea?: string | null; licenses: any[]; boards: any[]; malpractice: any; uploads: any; pecosActive?: boolean }) {
    const rec = this.demo ? this.memory.get(body.id) : await (this.prisma as any).providerOnboarding.findUnique?.({ where: { id: body.id } })
    if (!rec) throw new Error('Not found')
    rec.npi = body.npi
    rec.dea = body.dea ?? null
    rec.licenses_json = body.licenses
    rec.boards_json = body.boards
    rec.malpractice_json = body.malpractice
    rec.uploads_json = body.uploads
    rec.pecos_active = body.pecosActive ?? null
    rec.stepsCompleted = Math.max(rec.stepsCompleted || 1, 2)
    rec.status = 'IN_PROGRESS'
    if (this.demo) { this.memory.set(body.id, rec); return rec }
    const updated = await (this.prisma as any).providerOnboarding.update?.({ where: { id: body.id }, data: {
      npi: body.npi,
      dea: body.dea ?? null,
      licenses_json: body.licenses,
      boards_json: body.boards,
      malpractice_json: body.malpractice,
      uploads_json: body.uploads,
      pecos_active: body.pecosActive ?? null,
      steps_completed: 2,
      status: 'IN_PROGRESS',
    } })
    return updated ?? rec
  }

  async step3(body: { id: string; practice: any }) {
    const rec = this.demo ? this.memory.get(body.id) : await (this.prisma as any).providerOnboarding.findUnique?.({ where: { id: body.id } })
    if (!rec) throw new Error('Not found')
    rec.practice_json = body.practice
    rec.stepsCompleted = Math.max(rec.stepsCompleted || 2, 3)
    if (this.demo) { this.memory.set(body.id, rec); return rec }
    const updated = await (this.prisma as any).providerOnboarding.update?.({ where: { id: body.id }, data: { practice_json: body.practice, steps_completed: 3 } })
    return updated ?? rec
  }

  async step4Sign(body: { id: string }) {
    const rec = this.demo ? this.memory.get(body.id) : await (this.prisma as any).providerOnboarding.findUnique?.({ where: { id: body.id } })
    if (!rec) throw new Error('Not found')
    // Demo: pretend to create SignatureEvent and return id
    const sigId = crypto.randomUUID()
    rec.agreements_signature_event_id = sigId
    rec.stepsCompleted = 4
    rec.status = 'SUBMITTED'
    if (this.demo) { this.memory.set(body.id, rec); return rec }
    const updated = await (this.prisma as any).providerOnboarding.update?.({ where: { id: body.id }, data: { agreements_signature_event_id: sigId, steps_completed: 4, status: 'SUBMITTED' } })
    return updated ?? rec
  }

  async adminList() {
    if (this.demo) {
      return { items: Array.from(this.memory.values()), next_cursor: null }
    }
    const items = await (this.prisma as any).providerOnboarding.findMany?.({ orderBy: { createdAt: 'desc' } })
    return { items: items ?? [], next_cursor: null }
  }

  async adminAction(body: { id: string; action: 'APPROVE'|'REJECT'|'REQUEST_INFO'; notes?: string; request_fields?: string[] }) {
    const rec = this.demo ? this.memory.get(body.id) : await (this.prisma as any).providerOnboarding.findUnique?.({ where: { id: body.id } })
    if (!rec) throw new Error('Not found')
    if (body.action === 'APPROVE') rec.status = 'APPROVED'
    else if (body.action === 'REJECT') rec.status = 'REJECTED'
    else rec.status = 'UNDER_REVIEW'
    if (this.demo) { this.memory.set(body.id, rec); return rec }
    const updated = await (this.prisma as any).providerOnboarding.update?.({ where: { id: body.id }, data: { status: rec.status } })
    return updated ?? rec
  }
}


