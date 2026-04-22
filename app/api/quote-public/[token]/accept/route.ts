import { NextResponse } from 'next/server'
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
  const legalName = asText(body?.legal_name || body?.full_name)
  if (!legalName) {
    return NextResponse.json({ error: 'Legal name is required' }, { status: 400 })
  }
  const signatureType = asText(body?.signature_type) || 'typed'
  const signatureValue = asText(body?.signature_value || body?.signature)
  const accepted = body?.accepted_terms === true || body?.accepted === true || body?.agreement_checked === true
  if (!accepted) {
    return NextResponse.json({ error: 'Acceptance checkbox is required' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const update = await supabaseAdmin
    .from('estimate_public_versions')
    .update({
      status: 'accepted',
      accepted_at: now,
      locked_at: now,
      acceptance_json: {
        legal_name: legalName,
        signature_type: signatureType,
        signature_value: signatureValue,
        accepted_terms: true,
        accepted_at: now,
        user_agent: request.headers.get('user-agent') ?? '',
        ip: request.headers.get('x-forwarded-for') ?? '',
      },
    })
    .eq('id', loaded.snapshot.estimate_version_id)
    .select('*')
    .maybeSingle()

  if (update.error) return NextResponse.json({ error: update.error.message }, { status: 500 })

  await supabaseAdmin.from('estimate_public_events').insert({
    org_id: loaded.version.org_id,
    estimate_public_version_id: loaded.snapshot.estimate_version_id,
    event_type: 'accepted',
    actor_type: 'customer',
    metadata: {
      legal_name: legalName,
      signature_type: signatureType,
    },
  })

  return NextResponse.json({ ok: true, version: update.data })
}
