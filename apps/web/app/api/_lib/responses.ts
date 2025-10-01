import { NextResponse } from 'next/server'
import { writeAudit } from '../../../lib/server/audit'
import type { Claims } from '../../../lib/server/auth'

export function json<T>(data: T, init: number | ResponseInit = 200): NextResponse<T> {
  return NextResponse.json<T>(data, typeof init === 'number' ? { status: init } : init)
}

export function badRequest(message: string, details?: unknown): NextResponse {
  return NextResponse.json({ error: message, details }, { status: 400 })
}

export function unauthorized(message = 'Unauthorized'): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 })
}

export function forbidden(message = 'Forbidden'): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 })
}

export function internalError(message = 'Internal Server Error'): NextResponse {
  return NextResponse.json({ error: message }, { status: 500 })
}

interface AuditMeta {
  action: Parameters<typeof writeAudit>[0]['action']
  target?: string
  metadata?: Record<string, unknown>
}

export async function audit(claims: Claims | undefined, meta: AuditMeta): Promise<void> {
  await writeAudit({
    actorUserId: claims?.sub,
    actorRole: claims?.role,
    action: meta.action,
    target: meta.target,
    metadata: meta.metadata,
  })
}


