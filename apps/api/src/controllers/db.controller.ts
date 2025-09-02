import { Controller, Get, Req } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import { PrismaService } from '../prisma.service'

@Controller('db')
export class DbController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  async health(@Req() req: FastifyRequest) {
    // Simple query to assert connectivity
    await this.prisma.$queryRaw`SELECT 1` as any
    return {
      status: 'ok',
      orgId: req.headers['x-rls-org-id'] ?? null,
    }
  }
}
