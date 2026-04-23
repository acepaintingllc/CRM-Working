import { errorResult, okResult, type ServiceResult } from './serviceResult'
import {
  loadPublicEstimateRecordByToken,
  markPublicEstimateViewedRecord,
  updatePublicEstimateVersionRecord,
  writePublicEstimateEvent,
  type LoadedPublicEstimate,
} from './estimatePublicPortalRepository'
import type { EstimatePublicSnapshot, Unsafe } from '@/lib/customer-estimates/types'

type PublicEstimateTransitionStatus = EstimatePublicSnapshot['status']

export type AcceptPublicEstimateWorkflowInput = {
  token: string
  legalName: string
  signatureType?: string
  signatureValue?: string
  acceptedTerms: boolean
  userAgent?: string
  ip?: string
}

export type DeclinePublicEstimateWorkflowInput = {
  token: string
  reason?: string
}

export function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

export function normalizePublicEstimateAcceptanceInput(input: Record<string, unknown>) {
  return {
    legalName: asText(input.legal_name ?? input.full_name),
    signatureType: asText(input.signature_type) || 'typed',
    signatureValue: asText(input.signature_value ?? input.signature),
    acceptedTerms:
      input.accepted_terms === true ||
      input.accepted === true ||
      input.agreement_checked === true,
  } satisfies Omit<
    AcceptPublicEstimateWorkflowInput,
    'token' | 'userAgent' | 'ip'
  >
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

async function loadTransitionableEstimate(
  token: string
): Promise<ServiceResult<LoadedPublicEstimate>> {
  if (!token || typeof token !== 'string') {
    return errorResult('invalid_input', 'Invalid token')
  }

  return loadPublicEstimateRecordByToken({ token })
}

function shouldMarkPublicEstimateViewed(snapshot: EstimatePublicSnapshot) {
  return (snapshot.status === 'sent' || snapshot.status === 'viewed') && !snapshot.viewed_at
}

export async function loadPublicEstimateWorkflow(params: {
  token: string
  origin?: string
  userAgent?: string
}): Promise<ServiceResult<EstimatePublicSnapshot>> {
  if (!params.token || typeof params.token !== 'string') {
    return errorResult('invalid_input', 'Invalid token')
  }

  const loadedResult = await loadPublicEstimateRecordByToken({
    token: params.token,
    origin: params.origin,
  })
  if (!loadedResult.ok) return loadedResult

  const loaded = loadedResult.data
  if (!shouldMarkPublicEstimateViewed(loaded.snapshot)) {
    return okResult(loaded.snapshot)
  }

  const viewedResult = await markPublicEstimateViewedRecord({
    versionId: loaded.snapshot.estimate_version_id,
  })
  if (!viewedResult.ok) return viewedResult

  const eventResult = await writePublicEstimateEvent({
    orgId: asText(loaded.version.org_id),
    versionId: loaded.snapshot.estimate_version_id,
    eventType: 'viewed',
    actorType: 'customer',
    metadata: {
      user_agent: asText(params.userAgent),
    },
  })
  if (!eventResult.ok) return eventResult

  return okResult(loaded.snapshot)
}

export async function acceptPublicEstimateWorkflow(
  params: AcceptPublicEstimateWorkflowInput
): Promise<ServiceResult<Unsafe>> {
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
    return okResult(loaded.version)
  }

  const signatureType = asText(params.signatureType) || 'typed'
  const signatureValue = asText(params.signatureValue)
  const now = new Date().toISOString()
  const orgId = asText(loaded.version.org_id)
  const versionId = loaded.snapshot.estimate_version_id
  const updateResult = await updatePublicEstimateVersionRecord({
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

  const eventResult = await writePublicEstimateEvent({
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
}

export async function declinePublicEstimateWorkflow(
  params: DeclinePublicEstimateWorkflowInput
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

  const now = new Date().toISOString()
  const orgId = asText(loaded.version.org_id)
  const versionId = loaded.snapshot.estimate_version_id
  const updateResult = await updatePublicEstimateVersionRecord({
    orgId,
    versionId,
    payload: {
      status: 'declined',
      declined_at: now,
      locked_at: now,
    },
  })
  if (!updateResult.ok) return updateResult

  const eventResult = await writePublicEstimateEvent({
    orgId,
    versionId,
    eventType: 'declined',
    actorType: 'customer',
    metadata: {
      reason: asText(params.reason),
    },
  })
  if (!eventResult.ok) return eventResult

  return okResult(updateResult.data)
}

