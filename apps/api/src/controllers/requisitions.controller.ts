import { Controller, Get, Post, UseGuards, Body, Res } from '@nestjs/common'
import { FastifyReply } from 'fastify'
import { Response } from 'express'
import { Abac } from '../abac/abac.guard'
import { AbacGuard } from '../abac/abac.guard'
import { RequisitionsService } from '../services/requisitions.service'

@Controller('requisitions')
@UseGuards(AbacGuard)
export class RequisitionsController {
  constructor(private readonly svc: RequisitionsService) {}

  @Get('templates')
  @Abac({ resource: 'Organization', action: 'read' })
  async listTemplates() {
    return await this.svc.listTemplates()
  }

  @Post('templates')
  @Abac({ resource: 'Organization', action: 'write' })
  async uploadTemplate(@Body() body: { labName: string; title: string; filename: string; mimeType: string; sizeBytes: number; fileB64: string }) {
    return await this.svc.uploadTemplateBase64(body)
  }

  @Post('templates/download')
  @Abac({ resource: 'Organization', action: 'read' })
  async download(@Body() body: { id: string }, @Res({ passthrough: true }) res: FastifyReply) {
    const stream = await this.svc.download(body.id)
    res.header('Content-Type', stream.mimeType)
    res.header('Content-Length', String(stream.sizeBytes))
    return res.send(stream.body)
  }
}


