import { supabaseAdmin } from './org'
import { writeEstimatePublicEvent } from './customer-send/repository'
import { errorResult, okResult, type ServiceResult } from './serviceResult'
import { ensureAssembledCustomerEstimateDocument } from '@/lib/customer-estimates/assemble'
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
  const payload = buildEstimatePublicSnapshotFromVersion(version, origin)
  if ('error' in payload) return payload
  return { version: version as Unsafe, snapshot: payload } as const
}

type PublicEstimateLoaded = Awaited<ReturnType<typeof loadPublicEstimateByToken>>
type PublicEstimateTransitionStatus = EstimatePublicSnapshot['status']

type AcceptPublicEstimateParams = {
  token: string
  legalName: string
  signatureType?: string
  signatureValue?: string
  acceptedTerms: boolean
  userAgent?: string
  ip?: string
}

type DeclinePublicEstimateParams = {
  token: string
  reason?: string
}

type PublicEstimateSnapshotOptions = {
  origin?: string
}

type PublicEstimateViewOptions = {
  actorType?: 'customer' | 'staff' | 'system'
  metadata?: Record<string, unknown>
}

export function buildEstimatePublicSnapshotFromVersion(
  version: Unsafe,
  origin?: string
) {
  const token = asText(version.public_token)
  const snapshot = (version.snapshot_json ?? {}) as Record<string, unknown>
  const rawDocument = ((snapshot.document ?? snapshot) ?? null) as
    | EstimatePublicSnapshot['document']
    | Record<string, unknown>
    | null
  const document = rawDocument ? ensureAssembledCustomerEstimateDocument(rawDocument) : null
  if (!document) return { error: 'Quote snapshot missing' } as const

  const normalizedSnapshot: Record<string, unknown> = {
    ...snapshot,
    document,
  }

  return {
    estimate_id: asText(version.estimate_id),
    estimate_version_id: asText(version.id),
    version_number: Number(version.version_number ?? 0),
    status: (asText(version.status) || 'draft') as EstimatePublicSnapshot['status'],
    public_token: token || null,
    public_url: origin && token ? `${origin}/quote/${token}` : null,
    draft: (normalizedSnapshot.draft ?? {}) as Record<string, unknown>,
    document,
    snapshot_json: normalizedSnapshot,
    sent_at: asText(version.sent_at) || null,
    viewed_at: asText(version.viewed_at) || null,
    accepted_at: asText(version.accepted_at) || null,
    declined_at: asText(version.declined_at) || null,
    locked_at: asText(version.locked_at) || null,
  } satisfies EstimatePublicSnapshot
}

function shouldMarkViewed(snapshot: EstimatePublicSnapshot) {
  return (snapshot.status === 'sent' || snapshot.status === 'viewed') && !snapshot.viewed_at
}

export async function loadPublicEstimateSnapshot(
  token: string,
  snapshotOptions?: PublicEstimateSnapshotOptions,
  viewOptions?: PublicEstimateViewOptions
): Promise<ServiceResult<EstimatePublicSnapshot>> {
  if (!token || typeof token !== 'string') {
    return errorResult('invalid_input', 'Invalid token')
  }

  const loaded = await loadPublicEstimateByToken(token, snapshotOptions?.origin)
  if (!isLoadedEstimate(loaded)) {
    return errorResult('not_found', asText(loaded.error) || 'Quote not found')
  }

  if (!shouldMarkViewed(loaded.snapshot)) {
    return okResult(loaded.snapshot)
  }

  const viewed = await markPublicEstimateViewed({
    versionId: loaded.snapshot.estimate_version_id,
    orgId: asText(loaded.version.org_id),
    actorType: viewOptions?.actorType,
    metadata: viewOptions?.metadata,
  }).catch(() => null)

  if (!viewed || 'error' in viewed || !viewed.ok) {
    return okResult(loaded.snapshot)
  }

  return okResult({
    ...loaded.snapshot,
    status: 'viewed',
    viewed_at: viewed.viewed_at,
  })
}

function isLoadedEstimate(
  loaded: PublicEstimateLoaded
): loaded is Extract<PublicEstimateLoaded, { version: Unsafe; snapshot: EstimatePublicSnapshot }> {
  return 'version' in loaded && 'snapshot' in loaded
}

function isRepeatableTerminalState(
  currentStatus: PublicEstimateTransitionStatus,
  nextStatus: 'accepted' | 'declined'
) {
  return currentStatus === nextStatus
}

function canTransitionToTerminalState(
  currentStatus: PublicEstimateTransitionStatus,
  nextStatus: 'accepted' | 'declined'
) {
  if (currentStatus === 'sent' || currentStatus === 'viewed') return true
  if (isRepeatableTerminalState(currentStatus, nextStatus)) return true
  return false
}

function transitionConflictMessage(
  currentStatus: PublicEstimateTransitionStatus,
  nextStatus: 'accepted' | 'declined'
) {
  if (nextStatus === 'accepted') {
    if (currentStatus === 'accepted') return 'Quote already accepted'
    if (currentStatus === 'declined') return 'Cannot accept a declined quote'
  }
  if (nextStatus === 'declined') {
    if (currentStatus === 'declined') return 'Quote already declined'
    if (currentStatus === 'accepted') return 'Cannot decline an accepted quote'
  }
  return `Cannot ${nextStatus} quote from ${currentStatus} status`
}

async function loadTransitionableEstimate(token: string) {
  if (!token || typeof token !== 'string') {
    return errorResult('invalid_input', 'Invalid token')
  }

  const loaded = await loadPublicEstimateByToken(token)
  if (!isLoadedEstimate(loaded)) {
    return errorResult('not_found', asText(loaded.error) || 'Quote not found')
  }

  return okResult(loaded)
}

async function updatePublicEstimateVersion(params: {
  orgId: string
  versionId: string
  payload: Record<string, unknown>
}) {
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

export async function acceptPublicEstimate(
  params: AcceptPublicEstimateParams
): Promise<ServiceResult<EstimatePublicSnapshot>> {
  const legalName = asText(params.legalName)
  if (!legalName) {
    return errorResult('invalid_input', 'Legal name is required')
  }
  if (!params.acceptedTerms) {
    return errorResult('invalid_input', 'Acceptance checkbox is required')
  }

  const loadedResult = await loadTransitionableEstimate(params.token)
  if (!loadedResult.ok) return loadedResult

  const loaded = loadedResult.data
  const currentStatus = loaded.snapshot.status
  if (!canTransitionToTerminalState(currentStatus, 'accepted')) {
    return errorResult('conflict', transitionConflictMessage(currentStatus, 'accepted'))
  }
  if (currentStatus === 'accepted') {
    return okResult(loaded.snapshot)
  }

  const signatureType = asText(params.signatureType) || 'typed'
  const signatureValue = asText(params.signatureValue)
  const now = new Date().toISOString()
  const orgId = asText(loaded.version.org_id)
  const versionId = loaded.snapshot.estimate_version_id
  const updateResult = await updatePublicEstimateVersion({
    orgId,
    versionId,
    payload: {
      status: 'accepted',
      accepted_at: now,
      locked_at: now,
      acceptance_json: {
        legal_name: legalName,
        signature_type: signatureType,
        signature_value: signatureValue,
        accepted_terms: true,
        accepted_at: now,
        user_agent: asText(params.userAgent),
        ip: asText(params.ip),
      },
    },
  })
  if (!updateResult.ok) return updateResult

  const eventResult = await writeEstimatePublicEvent({
    orgId,
    versionId,
    eventType: 'accepted',
    actorType: 'customer',
    metadata: {
      legal_name: legalName,
      signature_type: signatureType,
    },
  })
  if (!eventResult.ok) return eventResult

  const snapshot = buildEstimatePublicSnapshotFromVersion(updateResult.data)
  if ('error' in snapshot) {
    return errorResult('server_error', asText(snapshot.error) || 'Quote snapshot missing')
  }

  return okResult(snapshot)
}

export async function declinePublicEstimate(
  params: DeclinePublicEstimateParams
): Promise<ServiceResult<EstimatePublicSnapshot>> {
  const loadedResult = await loadTransitionableEstimate(params.token)
  if (!loadedResult.ok) return loadedResult

  const loaded = loadedResult.data
  const currentStatus = loaded.snapshot.status
  if (!canTransitionToTerminalState(currentStatus, 'declined')) {
    return errorResult('conflict', transitionConflictMessage(currentStatus, 'declined'))
  }
  if (currentStatus === 'declined') {
    return okResult(loaded.snapshot)
  }

  const now = new Date().toISOString()
  const orgId = asText(loaded.version.org_id)
  const versionId = loaded.snapshot.estimate_version_id
  const updateResult = await updatePublicEstimateVersion({
    orgId,
    versionId,
    payload: {
      status: 'declined',
      declined_at: now,
      locked_at: now,
    },
  })
  if (!updateResult.ok) return updateResult

  const eventResult = await writeEstimatePublicEvent({
    orgId,
    versionId,
    eventType: 'declined',
    actorType: 'customer',
    metadata: {
      reason: asText(params.reason),
    },
  })
  if (!eventResult.ok) return eventResult

  const snapshot = buildEstimatePublicSnapshotFromVersion(updateResult.data)
  if ('error' in snapshot) {
    return errorResult('server_error', asText(snapshot.error) || 'Quote snapshot missing')
  }

  return okResult(snapshot)
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
  await writeEstimatePublicEvent({
    orgId: params.orgId,
    versionId: params.versionId,
    eventType: 'viewed',
    actorType: params.actorType ?? 'customer',
    metadata: params.metadata ?? {},
  })
  return { ok: true as const, viewed_at: viewedAt, version: update.data as Unsafe | null }
}
