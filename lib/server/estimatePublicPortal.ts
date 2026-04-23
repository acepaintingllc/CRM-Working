import {
  loadPublicEstimateRecordByToken,
  markPublicEstimateViewedRecord,
  writePublicEstimateEvent,
} from './estimatePublicPortalRepository'
import {
  acceptPublicEstimateWorkflow,
  declinePublicEstimateWorkflow,
} from './estimatePublicPortalWorkflow'

export async function loadPublicEstimateByToken(token: string, origin?: string) {
  const result = await loadPublicEstimateRecordByToken({ token, origin })
  if (!result.ok) return { error: result.message } as const
  return result.data
}

export async function acceptPublicEstimate(params: {
  token: string
  legalName: string
  signatureType?: string
  signatureValue?: string
  acceptedTerms: boolean
  userAgent?: string
  ip?: string
}) {
  return acceptPublicEstimateWorkflow(params)
}

export async function declinePublicEstimate(params: {
  token: string
  reason?: string
}) {
  return declinePublicEstimateWorkflow(params)
}

export async function markPublicEstimateViewed(params: {
  versionId: string
  orgId: string
  actorType?: 'customer' | 'staff' | 'system'
  metadata?: Record<string, unknown>
}) {
  const viewedResult = await markPublicEstimateViewedRecord({
    versionId: params.versionId,
  })
  if (!viewedResult.ok) return { error: viewedResult.message } as const

  await writePublicEstimateEvent({
    orgId: params.orgId,
    versionId: params.versionId,
    eventType: 'viewed',
    actorType: params.actorType ?? 'customer',
    metadata: params.metadata ?? {},
  })

  return {
    ok: true as const,
    viewed_at: viewedResult.data.viewedAt,
    version: viewedResult.data.version,
  }
}
