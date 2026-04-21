import { NextResponse } from 'next/server'
import { serverLog } from '@/lib/server/log'

export function settingsData<T>(data: T, meta?: Record<string, unknown>) {
  return NextResponse.json(meta ? { data, meta } : { data })
}

export function settingsSaved<T>(data: T, notice: string) {
  return NextResponse.json({ data, notice })
}

export function settingsError(error: string, status: number) {
  return NextResponse.json({ error }, { status })
}

export function logSettingsRouteFailure(params: {
  resource: string
  action: string
  orgId?: string
  userId?: string
  error: unknown
}) {
  serverLog.error(`[settings:${params.resource}] ${params.action} failed`, {
    orgId: params.orgId ?? null,
    userId: params.userId ?? null,
    error: params.error instanceof Error ? params.error.message : params.error,
  })
}
