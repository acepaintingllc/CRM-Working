import { supabaseAdmin } from './org'
import {
  applyAcceptedEstimateSideEffects,
  ensureAcceptedEstimateOperationalSnapshot,
} from './accepted-estimates/service'
import { writeEstimatePublicEvent } from './customer-send/repository'
import { errorResult, okResult, type ServiceResult } from './serviceResult'
import { ensureAssembledCustomerEstimateDocument } from '@/lib/customer-estimates/assemble'
import { normalizeEstimatePublicAcceptanceRecord } from '@/lib/customer-estimates/publicAcceptance'
import type { EstimatePublicSnapshot, Unsafe } from '@/lib/customer-estimates/types'
import {
  sendPublicEstimateAcceptanceNotifications,
  sendPublicEstimateDeclineNotification,
} from './publicEstimateNotifications'

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
  customerEmail?: string
  signatureType?: string
  signatureValue?: string
  acceptedTerms: boolean
  customerMessage?: string
  origin?: string
  userAgent?: string
  ip?: string
}

type DeclinePublicEstimateParams = {
  token: string
  reason?: string
  origin?: string
}

type PublicEstimateSnapshotOptions = {
  origin?: string
}

type PublicEstimateViewOptions = {
  actorType?: 'customer' | 'staff' | 'system'
  metadata?: Record<string, unknown>
}

type EstimatePublicEventParams = {
  orgId: string
  versionId: string
  eventType: 'accepted' | 'declined' | 'viewed'
  actorType: 'customer' | 'staff' | 'system'
  metadata?: Record<string, unknown>
}

const ACCEPTED_RETRY_SCHEDULE_ELIGIBLE_JOB_STATUSES = [
  'estimate_scheduled',
  'estimate_sent',
  'follow_up',
]

type AcceptedEstimateSideEffectsDb = Parameters<typeof applyAcceptedEstimateSideEffects>[0]

function acceptedEstimateSideEffectsDb() {
  return supabaseAdmin as unknown as AcceptedEstimateSideEffectsDb
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function logPublicNotificationResult(label: string, result: unknown) {
  const resultRecord = asRecord(result)
  if (!resultRecord) return

  for (const [recipient, rawStatus] of Object.entries(resultRecord)) {
    const status = asRecord(rawStatus)
    const error = asText(status?.error)
    const skipped = status?.skipped === true
    const reason = asText(status?.reason) || 'unknown'

    if (error) {
      console.error(`[public-estimate-notification] ${label} ${recipient} failed`, error)
    } else if (skipped) {
      console.error(`[public-estimate-notification] ${label} ${recipient} skipped`, reason)
    }
  }
}

async function runPublicNotification(label: string, task: Promise<unknown>) {
  const result = await task.catch((error: unknown) => {
    console.error(
      '[public-estimate-notification] failed',
      error instanceof Error ? error.message : error
    )
    return null
  })

  logPublicNotificationResult(label, result)
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
    acceptance_json: normalizeEstimatePublicAcceptanceRecord(version.acceptance_json),
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

  if (!viewed || 'error' in viewed || !viewed.ok || !viewed.version) {
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
    if (currentStatus === 'superseded') return 'A newer quote is available.'
  }
  if (nextStatus === 'declined') {
    if (currentStatus === 'declined') return 'Quote already declined'
    if (currentStatus === 'accepted') return 'Cannot decline an accepted quote'
    if (currentStatus === 'superseded') return 'A newer quote is available.'
  }
  return `Cannot ${nextStatus} quote from ${currentStatus} status`
}

async function ensureOperationalSnapshotAfterAcceptedOwnership(params: {
  requestOrigin?: string
  orgId: string
  userId: string
  estimateId: string
  publicVersionId: string
}) {
  const result = await ensureAcceptedEstimateOperationalSnapshot({
    requestOrigin: asText(params.requestOrigin),
    orgId: params.orgId,
    userId: params.userId,
    estimateId: params.estimateId,
    publicVersionId: params.publicVersionId,
  }).catch((error: unknown) =>
    errorResult(
      'server_error',
      error instanceof Error ? error.message : 'Unable to create estimate snapshot'
    )
  )

  if (!result.ok) {
    // Acceptance, estimate ownership, and snapshot inserts are not currently one
    // database transaction. Once ownership has committed, retries reconcile the
    // missing immutable snapshot instead of rolling back an accepted quote.
    console.error('[public-estimate-acceptance] snapshot creation failed', result.message)
  }

  return result
}

function parsePublicQuoteDate(value: unknown) {
  const text = asText(value)
  if (!text) return null

  const date = new Date(text.includes('T') ? text : `${text}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function publicQuoteExpirationDate(snapshot: EstimatePublicSnapshot) {
  const validDays = Number(snapshot.document.quote_validity_days)
  if (!Number.isFinite(validDays) || validDays <= 0) return null

  const sourceDate =
    parsePublicQuoteDate(snapshot.sent_at) ??
    parsePublicQuoteDate(snapshot.document.meta.sent_at)
  if (!sourceDate) return null

  const expiresAt = new Date(sourceDate)
  expiresAt.setDate(expiresAt.getDate() + validDays)
  return expiresAt
}

function isPublicQuoteExpired(snapshot: EstimatePublicSnapshot, now = new Date()) {
  const expiresAt = publicQuoteExpirationDate(snapshot)
  return expiresAt ? now.getTime() > expiresAt.getTime() : false
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
  allowedStatuses?: string[]
}) {
  const updateQuery = supabaseAdmin
    .from('estimate_public_versions')
    .update(params.payload)
    .eq('org_id', params.orgId)
    .eq('id', params.versionId)

  const filteredUpdate = params.allowedStatuses
    ? updateQuery.in('status', params.allowedStatuses)
    : updateQuery

  const update = await filteredUpdate
    .select('*')
    .maybeSingle()

  if (update.error) {
    if (
      params.payload.status === 'accepted' &&
      isSingleAcceptedPublicVersionMessage(update.error.message ?? '')
    ) {
      return errorResult(
        'conflict',
        'Estimate is already accepted by another public version'
      )
    }
    return errorResult(
      'server_error',
      update.error.message ?? 'Unable to update public quote'
    )
  }
  if (!update.data) {
    return errorResult(
      params.allowedStatuses ? 'conflict' : 'server_error',
      params.allowedStatuses
        ? 'Quote status changed before this action completed'
        : 'Unable to update public quote'
    )
  }

  return okResult(update.data as Unsafe)
}

async function loadAcceptedEstimateRow(orgId: string, estimateId: string) {
  const estimateLookup = await supabaseAdmin
    .from('estimates')
    .select('id, job_id, accepted_at, accepted_public_version_id')
    .eq('org_id', orgId)
    .eq('id', estimateId)
    .maybeSingle()
  if (estimateLookup.error || !estimateLookup.data) {
    return errorResult(
      'server_error',
      estimateLookup.error?.message ?? 'Accepted estimate missing'
    )
  }

  return okResult(estimateLookup.data as Unsafe)
}

async function reconcileAcceptedRetryOwnership(params: {
  orgId: string
  versionId: string
  estimateId: string
  acceptedAt: string
}) {
  const estimateLookup = await loadAcceptedEstimateRow(params.orgId, params.estimateId)
  if (!estimateLookup.ok) return estimateLookup
  const acceptedPublicVersionId = asText(estimateLookup.data.accepted_public_version_id)
  if (acceptedPublicVersionId && acceptedPublicVersionId !== params.versionId) {
    return errorResult(
      'conflict',
      'Estimate is already accepted by another public version'
    )
  }

  const estimateUpdate = await supabaseAdmin
    .from('estimates')
    .update({
      accepted_at: params.acceptedAt,
      accepted_public_version_id: params.versionId,
      version_state: 'live',
    })
    .eq('org_id', params.orgId)
    .eq('id', params.estimateId)
    .is('accepted_public_version_id', null)
    .select('id')
    .maybeSingle()

  if (estimateUpdate.error) {
    return errorResult(
      'server_error',
      estimateUpdate.error.message ?? 'Unable to reconcile accepted estimate'
    )
  }
  let reconciledEstimateData = estimateUpdate.data
  if (!reconciledEstimateData) {
    const sameVersionEstimateUpdate = await supabaseAdmin
      .from('estimates')
      .update({
        accepted_at: params.acceptedAt,
        accepted_public_version_id: params.versionId,
        version_state: 'live',
      })
      .eq('org_id', params.orgId)
      .eq('id', params.estimateId)
      .eq('accepted_public_version_id', params.versionId)
      .select('id')
      .maybeSingle()

    if (sameVersionEstimateUpdate.error) {
      return errorResult(
        'server_error',
        sameVersionEstimateUpdate.error.message ?? 'Unable to reconcile accepted estimate'
      )
    }
    reconciledEstimateData = sameVersionEstimateUpdate.data
  }
  if (!reconciledEstimateData) {
    return errorResult(
      'conflict',
      'Estimate is already accepted by another public version'
    )
  }

  const jobId = asText(estimateLookup.data.job_id)
  if (!jobId) {
    return errorResult('server_error', 'Accepted estimate missing job')
  }

  const jobLookup = await supabaseAdmin
    .from('jobs')
    .select('id, linked_estimate_id, status')
    .eq('org_id', params.orgId)
    .eq('id', jobId)
    .maybeSingle()

  if (jobLookup.error || !jobLookup.data) {
    return errorResult(
      'server_error',
      jobLookup.error?.message ?? 'Accepted estimate job missing'
    )
  }

  if (asText((jobLookup.data as Unsafe).linked_estimate_id) === params.estimateId) {
    return okResult({ ok: true })
  }

  const currentJobStatus = asText((jobLookup.data as Unsafe).status)
  const shouldRepairJobStatus =
    ACCEPTED_RETRY_SCHEDULE_ELIGIBLE_JOB_STATUSES.includes(currentJobStatus)

  const jobUpdate = await supabaseAdmin
    .from('jobs')
    .update({
      linked_estimate_id: params.estimateId,
      ...(shouldRepairJobStatus ? { status: 'scheduled' } : {}),
    })
    .eq('org_id', params.orgId)
    .eq('id', jobId)
    .select('id')
    .maybeSingle()

  if (jobUpdate.error) {
    return errorResult(
      'server_error',
      jobUpdate.error.message ?? 'Unable to link accepted estimate to job'
    )
  }
  if (!jobUpdate.data) {
    return errorResult('server_error', 'Accepted estimate job missing')
  }

  return okResult({ ok: true })
}

async function ensureEstimatePublicEvent(params: EstimatePublicEventParams) {
  const existing = await supabaseAdmin
    .from('estimate_public_events')
    .select('id')
    .eq('org_id', params.orgId)
    .eq('estimate_public_version_id', params.versionId)
    .eq('event_type', params.eventType)
    .eq('actor_type', params.actorType)
    .maybeSingle()

  if (existing.error) {
    return errorResult(
      'server_error',
      existing.error.message ?? 'Unable to inspect public quote event'
    )
  }
  if (existing.data) {
    return okResult({ ok: true })
  }

  const writeResult = await writeEstimatePublicEvent(params)
  if (
    !writeResult.ok &&
    isTerminalPublicEvent(params.eventType) &&
    isDuplicateTerminalPublicEventMessage(writeResult.message)
  ) {
    const terminalLookup = await loadExistingTerminalPublicEvent({
      orgId: params.orgId,
      versionId: params.versionId,
    })
    if (!terminalLookup.ok) return terminalLookup

    const existingEventType = asText(terminalLookup.data?.event_type)
    if (existingEventType === params.eventType) {
      return okResult({ ok: true })
    }
    if (isTerminalPublicEvent(existingEventType)) {
      return errorResult(
        'conflict',
        'Public quote already has a different terminal event'
      )
    }

    return writeResult
  }

  return writeResult
}

async function loadExistingTerminalPublicEvent(params: {
  orgId: string
  versionId: string
}) {
  const existing = await supabaseAdmin
    .from('estimate_public_events')
    .select('id,event_type')
    .eq('org_id', params.orgId)
    .eq('estimate_public_version_id', params.versionId)
    .in('event_type', ['accepted', 'declined'])
    .maybeSingle()

  if (existing.error) {
    return errorResult(
      'server_error',
      existing.error.message ?? 'Unable to inspect public quote terminal event'
    )
  }

  return okResult((existing.data as Unsafe | null) ?? null)
}

function isTerminalPublicEvent(eventType: string) {
  return eventType === 'accepted' || eventType === 'declined'
}

function isDuplicateTerminalPublicEventMessage(message: string) {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('duplicate key') ||
    normalized.includes('unique constraint') ||
    normalized.includes('estimate_public_events_terminal_once_idx')
  )
}

function isSingleAcceptedPublicVersionMessage(message: string) {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('duplicate key') &&
    normalized.includes('estimate_public_versions_one_accepted_per_estimate_idx')
  )
}

function buildAcceptedEventMetadata(params: AcceptPublicEstimateParams, signatureType: string) {
  return {
    legal_name: asText(params.legalName),
    ...(asText(params.customerEmail) ? { customer_email: asText(params.customerEmail) } : {}),
    signature_type: signatureType,
    ...(asText(params.customerMessage) ? { customer_message: asText(params.customerMessage) } : {}),
    ...(params.origin ? { origin: asText(params.origin) } : {}),
  }
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
  const orgId = asText(loaded.version.org_id)
  const versionId = loaded.snapshot.estimate_version_id
  const estimateId = asText(loaded.version.estimate_id)
  const signatureType = asText(params.signatureType) || 'typed'
  if (!canTransitionToTerminalState(currentStatus, 'accepted')) {
    return errorResult('conflict', transitionConflictMessage(currentStatus, 'accepted'))
  }
  if (currentStatus !== 'accepted' && isPublicQuoteExpired(loaded.snapshot)) {
    return errorResult(
      'conflict',
      'This quote has expired. Please contact us for an updated quote.'
    )
  }
  if (currentStatus === 'accepted') {
    const acceptedAt =
      loaded.snapshot.accepted_at ||
      asText(loaded.version.accepted_at) ||
      asText(loaded.version.locked_at) ||
      new Date().toISOString()
    const ownershipResult = await reconcileAcceptedRetryOwnership({
      orgId,
      versionId,
      estimateId,
      acceptedAt,
    })
    if (!ownershipResult.ok) return ownershipResult

    await ensureOperationalSnapshotAfterAcceptedOwnership({
      requestOrigin: params.origin,
      orgId,
      userId: asText(loaded.version.created_by),
      estimateId,
      publicVersionId: versionId,
    })

    const eventResult = await ensureEstimatePublicEvent({
      orgId,
      versionId,
      eventType: 'accepted',
      actorType: 'customer',
      metadata: buildAcceptedEventMetadata(params, signatureType),
    })
    if (!eventResult.ok) return eventResult

    return okResult(loaded.snapshot)
  }

  const signatureValue = asText(params.signatureValue)
  const now = new Date().toISOString()
  const estimateLookup = await loadAcceptedEstimateRow(orgId, estimateId)
  if (!estimateLookup.ok) return estimateLookup
  const acceptedPublicVersionId = asText(
    estimateLookup.data.accepted_public_version_id
  )
  if (acceptedPublicVersionId && acceptedPublicVersionId !== versionId) {
    return errorResult(
      'conflict',
      'Estimate is already accepted by another public version'
    )
  }

  const updateResult = await updatePublicEstimateVersion({
    orgId,
    versionId,
    allowedStatuses: ['sent', 'viewed'],
    payload: {
      status: 'accepted',
      accepted_at: now,
      locked_at: now,
      acceptance_json: {
        legal_name: legalName,
        ...(asText(params.customerEmail) ? { customer_email: asText(params.customerEmail) } : {}),
        signature_type: signatureType,
        signature_value: signatureValue,
        accepted_terms: true,
        accepted_at: now,
        user_agent: asText(params.userAgent),
        ip: asText(params.ip),
        ...(asText(params.customerMessage) ? { customer_message: asText(params.customerMessage) } : {}),
        origin: asText(params.origin),
      },
    },
  })
  if (!updateResult.ok) return updateResult

  const ownershipResult = await applyAcceptedEstimateSideEffects(
    acceptedEstimateSideEffectsDb(),
    {
      orgId,
      jobId: asText(estimateLookup.data.job_id),
      estimateId,
      publicVersionId: versionId,
      acceptedAt: now,
    }
  )
  if (!ownershipResult.ok) return ownershipResult

  await ensureOperationalSnapshotAfterAcceptedOwnership({
    requestOrigin: params.origin,
    orgId,
    userId: asText(loaded.version.created_by),
    estimateId,
    publicVersionId: versionId,
  })

  const eventResult = await ensureEstimatePublicEvent({
    orgId,
    versionId,
    eventType: 'accepted',
    actorType: 'customer',
    metadata: buildAcceptedEventMetadata(params, signatureType),
  })
  if (!eventResult.ok) return eventResult

  const snapshot = buildEstimatePublicSnapshotFromVersion(updateResult.data)
  if ('error' in snapshot) {
    return errorResult('server_error', asText(snapshot.error) || 'Quote snapshot missing')
  }

  await runPublicNotification(
    'acceptance',
    sendPublicEstimateAcceptanceNotifications({
      origin: params.origin,
      orgId,
      userId: asText(loaded.version.created_by),
      document: snapshot.document,
      publicToken: snapshot.public_token,
      acceptedBy: legalName,
      acceptedAt: now,
    })
  )

  return okResult(snapshot)
}

export async function declinePublicEstimate(
  params: DeclinePublicEstimateParams
): Promise<ServiceResult<EstimatePublicSnapshot>> {
  const loadedResult = await loadTransitionableEstimate(params.token)
  if (!loadedResult.ok) return loadedResult

  const loaded = loadedResult.data
  const currentStatus = loaded.snapshot.status
  const orgId = asText(loaded.version.org_id)
  const versionId = loaded.snapshot.estimate_version_id
  const declineEventMetadata = {
    reason: asText(params.reason),
    ...(params.origin ? { origin: asText(params.origin) } : {}),
  }
  if (!canTransitionToTerminalState(currentStatus, 'declined')) {
    return errorResult('conflict', transitionConflictMessage(currentStatus, 'declined'))
  }
  if (currentStatus === 'declined') {
    const eventResult = await ensureEstimatePublicEvent({
      orgId,
      versionId,
      eventType: 'declined',
      actorType: 'customer',
      metadata: declineEventMetadata,
    })
    if (!eventResult.ok) return eventResult

    return okResult(loaded.snapshot)
  }

  const now = new Date().toISOString()
  const updateResult = await updatePublicEstimateVersion({
    orgId,
    versionId,
    allowedStatuses: ['sent', 'viewed'],
    payload: {
      status: 'declined',
      declined_at: now,
      locked_at: now,
    },
  })
  if (!updateResult.ok) return updateResult

  const eventResult = await ensureEstimatePublicEvent({
    orgId,
    versionId,
    eventType: 'declined',
    actorType: 'customer',
    metadata: declineEventMetadata,
  })
  if (!eventResult.ok) return eventResult

  const snapshot = buildEstimatePublicSnapshotFromVersion(updateResult.data)
  if ('error' in snapshot) {
    return errorResult('server_error', asText(snapshot.error) || 'Quote snapshot missing')
  }

  await runPublicNotification(
    'decline',
    sendPublicEstimateDeclineNotification({
      origin: params.origin,
      orgId,
      userId: asText(loaded.version.created_by),
      document: snapshot.document,
      publicToken: snapshot.public_token,
      declinedAt: now,
      reason: params.reason,
    })
  )

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
    .eq('org_id', params.orgId)
    .eq('id', params.versionId)
    .in('status', ['sent', 'viewed'])
    .is('viewed_at', null)
    .select('*')
    .maybeSingle()
  if (update.error) return { error: update.error.message } as const
  if (!update.data) {
    return { ok: true as const, viewed_at: null, version: null }
  }
  await writeEstimatePublicEvent({
    orgId: params.orgId,
    versionId: params.versionId,
    eventType: 'viewed',
    actorType: params.actorType ?? 'customer',
    metadata: params.metadata ?? {},
  })
  return { ok: true as const, viewed_at: viewedAt, version: update.data as Unsafe | null }
}
