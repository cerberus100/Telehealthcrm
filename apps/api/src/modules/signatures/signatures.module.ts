import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { SignaturesService } from './signatures.service'
import { SignaturesController } from './signatures.controller'
import { DocumentsService } from './documents.service'
import { S3EvidenceService } from './s3-evidence.service'
import { WebAuthnService } from './webauthn.service'
import { PrismaService } from '../../prisma.service'

@Module({
  imports: [ConfigModule],
  controllers: [SignaturesController],
  providers: [
    SignaturesService,
    DocumentsService,
    S3EvidenceService,
    WebAuthnService,
    // PrismaService is already provided globally
  ],
  exports: [SignaturesService, DocumentsService, WebAuthnService],
})
export class SignaturesModule {}
