import { supabaseAdmin } from './org'
import { writeEstimatePublicEvent } from './customer-send/repository'
import { errorResult, okResult, type ServiceResult } from './serviceResult'
<<<<<<< Updated upstream
import type { EstimatePublicSnapshot, Unsafe } from '@/lib/customer-estimates/types'
=======
import { serverLog } from './log'
import {
  createPublicEstimateAcceptanceRecord,
  parsePublicEstimateAcceptRequest,
  parsePublicEstimateDeclineRequest,
  publicEstimatePortalErrors,
} from '@/lib/customer-estimates/publicPortalContracts'
import { buildEstimatePublicSnapshotFromVersion } from '@/lib/customer-estimates/publicSnapshot'
import type {
  EstimatePublicSignatureType,
  EstimatePublicSnapshot,
  Unsafe,
} from '@/lib/customer-estimates/types'
>>>>>>> Stashed changes

function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

const estimatePublicVersionsTable = 'estimate_public_versions'
const publicQuoteNotFoundMessage = publicEstimatePortalErrors.quoteNotFound
const publicQuoteSnapshotMissingMessage = publicEstimatePortalErrors.quoteSnapshotMissing
const terminalTransitionSourceStatuses: ReadonlyArray<EstimatePublicSnapshot['status']> = [
  'sent',
  'viewed',
]

<<<<<<< Updated upstream
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
=======
type LoadedPublicEstimateContext = {
  token: string
  orgId: string
  snapshot: EstimatePublicSnapshot
>>>>>>> Stashed changes
}

type PublicEstimateTransitionStatus = EstimatePublicSnapshot['status']

type AcceptPublicEstimateParams = {
  token: string
  legalName: string
  signatureType?: EstimatePublicSignatureType
  signatureValue?: string
  acceptedTerms: boolean
  userAgent?: string
  ip?: string
}

type DeclinePublicEstimateParams = {
  token: string
  reason?: string
}

<<<<<<< Updated upstream
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
=======
type PublicEstimateSnapshotOptions = {
  origin?: string
}

type PublicEstimateViewOptions = {
  actorType?: 'customer' | 'staff' | 'system'
  metadata?: Record<string, unknown>
}

function shouldApplyViewedTransition(snapshot: EstimatePublicSnapshot) {
  return (snapshot.status === 'sent' || snapshot.status === 'viewed') && !snapshot.viewed_at
}

function logPublicSnapshotLoadFailure(params: {
  token: string
  message: string
  orgId?: string
  versionId?: string
}) {
  serverLog.error('estimate_public_snapshot_load_failed', {
    token: params.token,
    orgId: params.orgId ?? '',
    versionId: params.versionId ?? '',
    message: params.message,
  })
}

async function loadPublicEstimateContext(params: {
  token: string
  origin?: string
  notFoundMessage?: string
}): Promise<ServiceResult<LoadedPublicEstimateContext>> {
  const token = asText(params.token)
  if (!token || typeof token !== 'string') {
    return errorResult('invalid_input', 'Invalid token')
  }

  const versionRes = await supabaseAdmin
    .from(estimatePublicVersionsTable)
    .select('*')
    .eq('public_token', token)
    .maybeSingle()

  if (versionRes.error) {
    logPublicSnapshotLoadFailure({
      token,
      message: versionRes.error.message,
    })
    return errorResult('server_error', versionRes.error.message)
  }

  if (!versionRes.data) {
    return errorResult('not_found', params.notFoundMessage ?? publicQuoteNotFoundMessage)
  }

  const version = versionRes.data as Unsafe
  const snapshot = buildEstimatePublicSnapshotFromVersion({
    version,
    origin: params.origin,
  })
  if ('error' in snapshot) {
    logPublicSnapshotLoadFailure({
      token,
      orgId: asText(version.org_id),
      versionId: asText(version.id),
      message: asText(snapshot.error) || publicQuoteSnapshotMissingMessage,
    })
    return errorResult(
      'server_error',
      asText(snapshot.error) || publicQuoteSnapshotMissingMessage
    )
  }

  return okResult({
    token,
    orgId: asText(version.org_id),
    snapshot,
  })
}

async function loadLatestPublicEstimateSnapshot(
  context: LoadedPublicEstimateContext,
  snapshotOptions?: PublicEstimateSnapshotOptions
) {
  const reloaded = await loadPublicEstimateContext({
    token: context.token,
    origin: snapshotOptions?.origin,
  })
  if (!reloaded.ok) return context.snapshot
  return reloaded.data.snapshot
}

async function updatePublicEstimateTerminalVersion(params: {
  context: LoadedPublicEstimateContext
  payload: Record<string, unknown>
}) {
  const update = await supabaseAdmin
    .from(estimatePublicVersionsTable)
    .update(params.payload)
    .eq('org_id', params.context.orgId)
    .eq('id', params.context.snapshot.estimate_version_id)
    .in('status', [...terminalTransitionSourceStatuses])
    .select('*')
    .maybeSingle()

  if (update.error) {
    return errorResult(
      'server_error',
      update.error.message || 'Unable to update public quote'
    )
  }

  return okResult(update.data as Unsafe | null)
}

async function writePublicEstimateEvent(params: {
  action: 'view' | 'accept' | 'decline'
  orgId: string
  versionId: string
  eventType: 'viewed' | 'accepted' | 'declined'
  actorType?: 'customer' | 'staff' | 'system'
  metadata?: Record<string, unknown>
}) {
  const eventResult = await writeEstimatePublicEvent({
    orgId: params.orgId,
    versionId: params.versionId,
    eventType: params.eventType,
    actorType: params.actorType ?? 'customer',
    metadata: params.metadata ?? {},
  })

  if (!eventResult.ok) {
    serverLog.error('estimate_public_transition_event_failed', {
      action: params.action,
      orgId: params.orgId,
      versionId: params.versionId,
      eventType: params.eventType,
      message: eventResult.message,
    })
    return
  }

  serverLog.info('estimate_public_transition_event_written', {
    action: params.action,
    orgId: params.orgId,
    versionId: params.versionId,
    eventType: params.eventType,
  })
}

async function applyPublicEstimateViewedTransition(
  context: LoadedPublicEstimateContext,
  snapshotOptions?: PublicEstimateSnapshotOptions,
  viewOptions?: PublicEstimateViewOptions
) {
  if (!shouldApplyViewedTransition(context.snapshot)) {
    return context.snapshot
  }

  const viewedAt = new Date().toISOString()
  serverLog.info('estimate_public_view_write_attempt', {
    token: context.token,
    orgId: context.orgId,
    versionId: context.snapshot.estimate_version_id,
    currentStatus: context.snapshot.status,
  })

  const update = await supabaseAdmin
    .from(estimatePublicVersionsTable)
    .update({
      status: 'viewed',
      viewed_at: viewedAt,
    })
    .eq('org_id', context.orgId)
    .eq('id', context.snapshot.estimate_version_id)
    .is('viewed_at', null)
    .in('status', ['sent', 'viewed'])
    .select('*')
    .maybeSingle()

  if (update.error) {
    serverLog.error('estimate_public_view_write_failed', {
      token: context.token,
      orgId: context.orgId,
      versionId: context.snapshot.estimate_version_id,
      currentStatus: context.snapshot.status,
      message: update.error.message,
    })
    serverLog.info('estimate_public_view_write_result', {
      token: context.token,
      orgId: context.orgId,
      versionId: context.snapshot.estimate_version_id,
      applied: false,
      reason: 'write_error',
    })
    return context.snapshot
  }

  if (!update.data) {
    serverLog.info('estimate_public_view_write_result', {
      token: context.token,
      orgId: context.orgId,
      versionId: context.snapshot.estimate_version_id,
      applied: false,
      reason: 'skipped',
    })
    return loadLatestPublicEstimateSnapshot(context, snapshotOptions)
  }

  await writePublicEstimateEvent({
    action: 'view',
    orgId: context.orgId,
    versionId: context.snapshot.estimate_version_id,
    eventType: 'viewed',
    actorType: viewOptions?.actorType,
    metadata: viewOptions?.metadata,
  })

  serverLog.info('estimate_public_view_write_result', {
    token: context.token,
    orgId: context.orgId,
    versionId: context.snapshot.estimate_version_id,
    applied: true,
  })

  const snapshot = buildEstimatePublicSnapshotFromVersion({
    version: update.data as Unsafe,
    origin: snapshotOptions?.origin,
  })
  if ('error' in snapshot) {
    logPublicSnapshotLoadFailure({
      token: context.token,
      orgId: context.orgId,
      versionId: context.snapshot.estimate_version_id,
      message: asText(snapshot.error) || publicQuoteSnapshotMissingMessage,
    })
    return loadLatestPublicEstimateSnapshot(context, snapshotOptions)
  }

  return snapshot
}

export async function loadPublicEstimateSnapshot(
  token: string,
  snapshotOptions?: PublicEstimateSnapshotOptions,
  viewOptions?: PublicEstimateViewOptions
): Promise<ServiceResult<EstimatePublicSnapshot>> {
  const contextResult = await loadPublicEstimateContext({
    token,
    origin: snapshotOptions?.origin,
  })
  if (!contextResult.ok) return contextResult

  return okResult(
    await applyPublicEstimateViewedTransition(
      contextResult.data,
      snapshotOptions,
      viewOptions
    )
  )
>>>>>>> Stashed changes
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

function getTerminalTransitionDecision(
  currentStatus: PublicEstimateTransitionStatus,
  nextStatus: 'accepted' | 'declined'
) {
  if (terminalTransitionSourceStatuses.includes(currentStatus)) {
    return { kind: 'apply' as const }
  }
<<<<<<< Updated upstream

  const loaded = await loadPublicEstimateByToken(token)
  if (!isLoadedEstimate(loaded)) {
    return errorResult('not_found', loaded.error)
=======
  if (currentStatus === nextStatus) {
    return { kind: 'repeat' as const }
  }
  return {
    kind: 'conflict' as const,
    message: transitionConflictMessage(currentStatus, nextStatus),
>>>>>>> Stashed changes
  }
}

async function applyPublicEstimateTerminalTransition(params: {
  context: LoadedPublicEstimateContext
  action: 'accept' | 'decline'
  nextStatus: 'accepted' | 'declined'
  origin?: string
  payload: Record<string, unknown>
  eventMetadata: Record<string, unknown>
}) {
  const currentStatus = params.context.snapshot.status
  const decision = getTerminalTransitionDecision(currentStatus, params.nextStatus)
  if (decision.kind === 'repeat') {
    return okResult(params.context.snapshot)
  }
  if (decision.kind === 'conflict') {
    return errorResult('conflict', decision.message)
  }

  serverLog.info('estimate_public_transition_attempt', {
    action: params.action,
    orgId: params.context.orgId,
    versionId: params.context.snapshot.estimate_version_id,
    currentStatus,
    token: params.context.token,
  })

  const updateResult = await updatePublicEstimateTerminalVersion({
    context: params.context,
    payload: params.payload,
  })
  if (!updateResult.ok) {
    serverLog.error('estimate_public_transition_update_failed', {
      action: params.action,
      orgId: params.context.orgId,
      versionId: params.context.snapshot.estimate_version_id,
      currentStatus,
      message: updateResult.message,
    })
    return updateResult
  }

  if (!updateResult.data) {
    const latestSnapshot = await loadLatestPublicEstimateSnapshot(params.context, {
      origin: params.origin,
    })
    const latestDecision = getTerminalTransitionDecision(
      latestSnapshot.status,
      params.nextStatus
    )

    serverLog.info('estimate_public_transition_write_result', {
      action: params.action,
      orgId: params.context.orgId,
      versionId: params.context.snapshot.estimate_version_id,
      applied: false,
      latestStatus: latestSnapshot.status,
    })

    if (latestDecision.kind === 'repeat') {
      return okResult(latestSnapshot)
    }
    if (latestDecision.kind === 'conflict') {
      return errorResult('conflict', latestDecision.message)
    }

    serverLog.error('estimate_public_transition_write_skipped_without_terminal_state', {
      action: params.action,
      orgId: params.context.orgId,
      versionId: params.context.snapshot.estimate_version_id,
      requestedStatus: params.nextStatus,
      latestStatus: latestSnapshot.status,
    })
    return errorResult('server_error', 'Unable to update public quote')
  }

  await writePublicEstimateEvent({
    action: params.action,
    orgId: params.context.orgId,
    versionId: params.context.snapshot.estimate_version_id,
    eventType: params.nextStatus,
    metadata: params.eventMetadata,
  })

  serverLog.info('estimate_public_transition_write_result', {
    action: params.action,
    orgId: params.context.orgId,
    versionId: params.context.snapshot.estimate_version_id,
    applied: true,
    latestStatus: params.nextStatus,
  })

  const snapshot = buildEstimatePublicSnapshotFromVersion({
    version: updateResult.data,
    origin: params.origin,
  })
  if ('error' in snapshot) {
    logPublicSnapshotLoadFailure({
      token: params.context.token,
      orgId: params.context.orgId,
      versionId: params.context.snapshot.estimate_version_id,
      message: asText(snapshot.error) || publicQuoteSnapshotMissingMessage,
    })
    return errorResult(
      'server_error',
      asText(snapshot.error) || publicQuoteSnapshotMissingMessage
    )
  }

  return okResult(snapshot)
}

export async function acceptPublicEstimate(
  params: AcceptPublicEstimateParams
<<<<<<< Updated upstream
): Promise<ServiceResult<Unsafe>> {
  const legalName = asText(params.legalName)
  if (!legalName) {
    return errorResult('invalid_input', 'Legal name is required')
  }
  if (!params.acceptedTerms) {
    return errorResult('invalid_input', 'Acceptance checkbox is required')
=======
): Promise<ServiceResult<EstimatePublicSnapshot>> {
  const parsed = parsePublicEstimateAcceptRequest({
    legal_name: params.legalName,
    signature_type: params.signatureType,
    signature_value: params.signatureValue,
    accepted_terms: params.acceptedTerms,
  })
  if (!parsed.ok) {
    serverLog.info('estimate_public_accept_validation_failed', {
      token: asText(params.token),
      message: parsed.error,
    })
    return errorResult('invalid_input', parsed.error)
>>>>>>> Stashed changes
  }

  const contextResult = await loadPublicEstimateContext({
    token: params.token,
  })
  if (!contextResult.ok) return contextResult

<<<<<<< Updated upstream
  const loaded = loadedResult.data
  const currentStatus = loaded.snapshot.status
  if (!canTransitionToTerminalState(currentStatus, 'accepted')) {
    return errorResult('conflict', transitionConflictMessage(currentStatus, 'accepted'))
  }
  if (currentStatus === 'accepted') {
    return okResult(loaded.version)
  }

  const signatureType = asText(params.signatureType) || 'typed'
  const signatureValue = asText(params.signatureValue)
=======
>>>>>>> Stashed changes
  const now = new Date().toISOString()
  const acceptance = createPublicEstimateAcceptanceRecord({
    acceptedAt: now,
    ip: params.ip,
    legalName: parsed.value.legalName,
    signatureType: parsed.value.signatureType,
    signatureValue: parsed.value.signatureValue,
    userAgent: params.userAgent,
  })

  return applyPublicEstimateTerminalTransition({
    context: contextResult.data,
    action: 'accept',
    nextStatus: 'accepted',
    payload: {
      status: 'accepted',
      accepted_at: now,
      locked_at: now,
      acceptance_json: acceptance,
    },
    eventMetadata: {
      legal_name: acceptance.legal_name,
      signature_type: acceptance.signature_type,
    },
  })
<<<<<<< Updated upstream
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

  return okResult(updateResult.data)
=======
>>>>>>> Stashed changes
}

export async function declinePublicEstimate(
  params: DeclinePublicEstimateParams
<<<<<<< Updated upstream
): Promise<ServiceResult<Unsafe>> {
  const loadedResult = await loadTransitionableEstimate(params.token)
  if (!loadedResult.ok) return loadedResult

  const loaded = loadedResult.data
  const currentStatus = loaded.snapshot.status
  if (!canTransitionToTerminalState(currentStatus, 'declined')) {
    return errorResult('conflict', transitionConflictMessage(currentStatus, 'declined'))
  }
  if (currentStatus === 'declined') {
    return okResult(loaded.version)
  }
=======
): Promise<ServiceResult<EstimatePublicSnapshot>> {
  const parsed = parsePublicEstimateDeclineRequest({
    reason: params.reason,
  })
  if (!parsed.ok) {
    serverLog.info('estimate_public_decline_validation_failed', {
      token: asText(params.token),
      message: parsed.error,
    })
    return errorResult('invalid_input', parsed.error)
  }

  const contextResult = await loadPublicEstimateContext({
    token: params.token,
  })
  if (!contextResult.ok) return contextResult
>>>>>>> Stashed changes

  const now = new Date().toISOString()

  return applyPublicEstimateTerminalTransition({
    context: contextResult.data,
    action: 'decline',
    nextStatus: 'declined',
    payload: {
      status: 'declined',
      declined_at: now,
      locked_at: now,
    },
    eventMetadata: {
      reason: parsed.value.reason,
    },
  })
<<<<<<< Updated upstream
  if (!eventResult.ok) return eventResult

  return okResult(updateResult.data)
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
=======
>>>>>>> Stashed changes
}
