import { NextResponse } from 'next/server'
import { writeEstimatePublicEvent } from '@/lib/server/customer-send/repository'
import { supabaseAdmin } from '@/lib/server/org'
import { loadPublicEstimateByToken } from '@/lib/server/estimatePublicPortal'

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

  const loaded = await loadPublicEstimateByToken(token)
  if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: 404 })

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const reason = asText(body?.reason)
  const now = new Date().toISOString()
  const update = await supabaseAdmin
    .from('estimate_public_versions')
    .update({
      status: 'declined',
      declined_at: now,
      locked_at: now,
    })
    .eq('id', loaded.snapshot.estimate_version_id)
    .select('*')
    .maybeSingle()
  if (update.error) return NextResponse.json({ error: update.error.message }, { status: 500 })

  await writeEstimatePublicEvent({
    orgId: (loaded.version.org_id as string) ?? '',
    versionId: loaded.snapshot.estimate_version_id,
    eventType: 'declined',
    actorType: 'customer',
    metadata: { reason },
  })

  return NextResponse.json({ ok: true, version: update.data })
}
