import { supabaseAdmin } from './org'
import { writeEstimatePublicEvent } from './customer-send/repository'
import { errorResult, okResult, type ServiceResult } from './serviceResult'
import type { EstimatePublicSnapshot, Unsafe } from '@/lib/customer-estimates/types'

function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

export type LoadedPublicEstimate = {
  version: Unsafe
  snapshot: EstimatePublicSnapshot
}

export async function loadPublicEstimateRecordByToken(params: {
  token: string
  origin?: string
}): Promise<ServiceResult<LoadedPublicEstimate>> {
  const versionRes = await supabaseAdmin
    .from('estimate_public_versions')
    .select('*')
    .eq('public_token', params.token)
    .maybeSingle()

  if (versionRes.error) return errorResult('server_error', versionRes.error.message)
  if (!versionRes.data) return errorResult('not_found', 'Quote not found')

  const version = versionRes.data as Unsafe
  const snapshot = (version.snapshot_json ?? {}) as Record<string, unknown>
  const document = (snapshot.document ?? null) as EstimatePublicSnapshot['document'] | null
  if (!document) return errorResult('not_found', 'Quote snapshot missing')

  const normalizedSnapshot: Record<string, unknown> = {
    ...snapshot,
    document,
  }

  const publicUrl = params.origin ? `${params.origin}/quote/${params.token}` : null
  return okResult({
    version,
    snapshot: {
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
    },
  })
}

export async function updatePublicEstimateVersionRecord(params: {
  orgId: string
  versionId: string
  payload: Record<string, unknown>
}): Promise<ServiceResult<Unsafe>> {
  const update = await supabaseAdmin
    .from('estimate_public_versions')
    .update(params.payload)
    .eq('org_id', params.orgId)
    .eq('id', params.versionId)
    .select('*')
    .maybeSingle()

  if (update.error || !update.data) {
    return errorResult(
      'server_error',
      update.error?.message ?? 'Unable to update public quote'
    )
  }

  return okResult(update.data as Unsafe)
}

export async function markPublicEstimateViewedRecord(params: {
  versionId: string
}): Promise<ServiceResult<{ viewedAt: string; version: Unsafe | null }>> {
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

  if (update.error) {
    return errorResult('server_error', update.error.message)
  }

  return okResult({
    viewedAt,
    version: (update.data as Unsafe | null) ?? null,
  })
}

export async function writePublicEstimateEvent(params: {
  orgId: string
  versionId: string
  eventType: 'viewed' | 'accepted' | 'declined'
  actorType?: 'system' | 'customer' | 'staff'
  metadata?: Record<string, unknown>
}): Promise<ServiceResult<null>> {
  return writeEstimatePublicEvent(params)
}

