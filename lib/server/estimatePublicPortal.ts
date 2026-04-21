import { supabaseAdmin } from './org'
import type { EstimatePublicSnapshot, Unsafe } from '@/lib/customer-estimates/types'

function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

export async function loadPublicEstimateByToken(token: string, origin?: string) {
  const versionRes = await supabaseAdmin
    .from('estimate_public_versions')
    .select('*')
    .eq('public_token', token)
    .maybeSingle()
  if (versionRes.error) return { error: versionRes.error.message } as const
  if (!versionRes.data) return { error: 'Quote not found' } as const

  const version = versionRes.data as Unsafe
  const snapshot = (version.snapshot_json ?? {}) as Record<string, unknown>
  const document = (snapshot.document ?? null) as EstimatePublicSnapshot['document'] | null
  if (!document) return { error: 'Quote snapshot missing' } as const
  const normalizedSnapshot: Record<string, unknown> = {
    ...snapshot,
    document,
  }

  const publicUrl = origin ? `${origin}/quote/${token}` : null
  const payload: EstimatePublicSnapshot = {
    estimate_id: asText(version.estimate_id),
    estimate_version_id: asText(version.id),
    version_number: Number(version.version_number ?? 0),
    status: (asText(version.status) || 'draft') as EstimatePublicSnapshot['status'],
    public_token: asText(version.public_token) || null,
    public_url: publicUrl,
    draft: (normalizedSnapshot.draft ?? {}) as Record<string, unknown>,
    document,
    snapshot_json: normalizedSnapshot,
    sent_at: asText(version.sent_at) || null,
    viewed_at: asText(version.viewed_at) || null,
    accepted_at: asText(version.accepted_at) || null,
    declined_at: asText(version.declined_at) || null,
    locked_at: asText(version.locked_at) || null,
  }
  return { version: version as Unsafe, snapshot: payload } as const
}

export async function markPublicEstimateViewed(params: {
  versionId: string
  orgId: string
  actorType?: 'customer' | 'staff' | 'system'
  metadata?: Record<string, unknown>
}) {
  const viewedAt = new Date().toISOString()
  const update = await supabaseAdmin
    .from('estimate_public_versions')
    .update({
      status: 'viewed',
      viewed_at: viewedAt,
    })
    .eq('id', params.versionId)
    .select('*')
    .maybeSingle()
  if (update.error) return { error: update.error.message } as const
  await supabaseAdmin.from('estimate_public_events').insert({
    org_id: params.orgId,
    estimate_public_version_id: params.versionId,
    event_type: 'viewed',
    actor_type: params.actorType ?? 'customer',
    metadata: params.metadata ?? {},
  })
  return { ok: true as const, viewed_at: viewedAt, version: update.data as Unsafe | null }
}
