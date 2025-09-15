import { Module } from '@nestjs/common'
import { ShipmentsController } from './shipments.controller'
import { ShipmentsService } from './shipments.service'
import { PrismaService } from '../../prisma.service'
import { AuditService } from '../../audit/audit.service'

@Module({
  controllers: [ShipmentsController],
  providers: [ShipmentsService],
  exports: [ShipmentsService],
})
export class ShipmentsModule {}
