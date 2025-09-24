import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import crypto from 'crypto'

@Injectable()
export class RequisitionsService {
  private s3: S3Client
  private bucket: string
  private demo: boolean
  private memory: Map<string, { buffer: Buffer; meta: { id: string; orgId: string; labName: string; title: string; filename: string; s3Key: string; sha256: string; sizeBytes: number; mimeType: string; createdAt: string } }>

  constructor(private readonly prisma: PrismaService) {
    this.s3 = new S3Client({})
    this.bucket = process.env.DOCS_BUCKET || 'teleplatform-docs-dev'
    this.demo = process.env.API_DEMO_MODE === 'true'
    this.memory = new Map()
  }

  async listTemplates() {
    if (this.demo) {
      const items = Array.from(this.memory.values()).map((v) => ({
        id: v.meta.id,
        orgId: v.meta.orgId,
        labName: v.meta.labName,
        title: v.meta.title,
        filename: v.meta.filename,
        s3Key: v.meta.s3Key,
        sha256: v.meta.sha256,
        sizeBytes: v.meta.sizeBytes,
        mimeType: v.meta.mimeType,
        createdAt: v.meta.createdAt,
      }))
      items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      return { items, next_cursor: undefined }
    }
    const items = await (this.prisma as any).requisitionTemplate.findMany?.({ orderBy: { createdAt: 'desc' } })
    return { items: items ?? [], next_cursor: undefined }
  }

  async uploadTemplate(params: { file: any; labName: string; title: string }) {
    const { file, labName, title } = params
    const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex')
    const id = crypto.randomUUID()
    const s3Key = `requisitions/${id}/${file.originalname}`
    await this.s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: s3Key, Body: file.buffer, ContentType: file.mimetype }))
    const created = await (this.prisma as any).requisitionTemplate.create?.({
      data: {
        id,
        orgId: 'mock-org-123',
        labName,
        title,
        filename: file.originalname,
        s3Key,
        sha256,
        sizeBytes: file.size,
        mimeType: file.mimetype,
        createdByUserId: 'mock-user-123',
      },
    })
    return created ?? { id, labName, title, filename: file.originalname, s3Key, sha256 }
  }

  async uploadTemplateBase64(body: { labName: string; title: string; filename: string; mimeType: string; sizeBytes: number; fileB64: string; insurancesAccepted?: any }) {
    const buffer = Buffer.from(body.fileB64, 'base64')
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex')
    const id = crypto.randomUUID()
    const s3Key = `requisitions/${id}/${body.filename}`
    const meta = {
      id,
      orgId: 'mock-org-123',
      labName: body.labName,
      title: body.title,
      filename: body.filename,
      s3Key,
      sha256,
      sizeBytes: body.sizeBytes,
      mimeType: body.mimeType,
      insurancesAccepted: body.insurancesAccepted || { commercial: true, medicare: true },
      createdAt: new Date().toISOString(),
    }
    if (this.demo) {
      this.memory.set(id, { buffer, meta })
      return meta
    }
    await this.s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: s3Key, Body: buffer, ContentType: body.mimeType }))
    const created = await (this.prisma as any).requisitionTemplate.create?.({
      data: {
        id,
        orgId: meta.orgId,
        labName: meta.labName,
        title: meta.title,
        filename: meta.filename,
        s3Key: meta.s3Key,
        sha256: meta.sha256,
        sizeBytes: meta.sizeBytes,
        mimeType: meta.mimeType,
        insurancesAccepted: meta.insurancesAccepted,
        createdByUserId: 'mock-user-123',
        createdAt: new Date(),
      },
    })
    return created ?? meta
  }

  async download(id: string) {
    if (this.demo) {
      const v = this.memory.get(id)
      if (!v) throw new Error('Not found')
      const stream = ReadableFromBuffer(v.buffer)
      return { body: stream, mimeType: v.meta.mimeType, sizeBytes: v.meta.sizeBytes }
    }
    const found = await (this.prisma as any).requisitionTemplate.findUnique?.({ where: { id } })
    if (!found) throw new Error('Not found')
    const out = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: found.s3Key }))
    return { body: (out as any).Body as NodeJS.ReadableStream, mimeType: found.mimeType, sizeBytes: found.sizeBytes }
  }
}

function ReadableFromBuffer(buf: Buffer): NodeJS.ReadableStream {
  const { Readable } = require('stream') as { Readable: any }
  const stream = new Readable()
  stream.push(buf)
  stream.push(null)
  return stream
}


