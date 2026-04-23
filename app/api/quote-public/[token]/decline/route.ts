import { NextResponse } from 'next/server'
import { serviceResultResponse } from '@/lib/server/routeResult'
import { declinePublicEstimate } from '@/lib/server/estimatePublicPortal'

function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

export async function POST(
  request: Request,
  context: { params: { token: string } | Promise<{ token: string }> }
) {
  const params = await Promise.resolve(context.params)
  const token = (params as { token?: string } | null | undefined)?.token
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  return serviceResultResponse(
    await declinePublicEstimate({
      token,
      reason: asText(body?.reason),
    }),
    (version) => ({ ok: true, version })
  )
}
