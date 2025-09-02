import { INestApplication, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect()
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }

  // Optional: for Nest apps that want to coordinate shutdown hooks
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async enableShutdownHooks(_app: INestApplication) {
    // No-op: prefer Nest lifecycle with onModuleDestroy
  }
}
