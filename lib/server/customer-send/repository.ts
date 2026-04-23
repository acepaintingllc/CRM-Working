import {
  errorResult,
  okResult,
  type ServiceResult,
} from '@/lib/server/serviceResult'
import { supabaseAdmin } from '@/lib/server/org'
import { asText } from './document'
import type {
  CustomerSendDraft,
  EstimatePublicVersionRow,
} from './types'

type EstimatePublicEventType =
  | 'draft_saved'
  | 'sent'
  | 'viewed'
  | 'accepted'
  | 'declined'
  | 'superseded'
  | 'pdf_requested'

export async function writeEstimatePublicEvent(params: {
  orgId: string
  versionId: string
  eventType: EstimatePublicEventType
  actorType?: 'system' | 'customer' | 'staff'
  metadata?: Record<string, unknown>
  createdBy?: string | null
}): Promise<ServiceResult<null>> {
  const result = await supabaseAdmin.from('estimate_public_events').insert({
    org_id: params.orgId,
    estimate_public_version_id: params.versionId,
    event_type: params.eventType,
    actor_type: params.actorType ?? 'system',
    metadata: params.metadata ?? {},
    created_by: params.createdBy ?? null,
  })

  if (result.error) {
    return errorResult('server_error', result.error.message)
  }

  return okResult(null)
}

export async function saveCustomerSendDraftVersion(params: {
  orgId: string
  estimateId: string
  customerId: string
  userId: string
  draft: CustomerSendDraft
  document: Record<string, unknown>
  latestDraft: EstimatePublicVersionRow | null
  latestVersion: EstimatePublicVersionRow | null
}): Promise<ServiceResult<EstimatePublicVersionRow>> {
  const nextVersionNumber =
    Number(params.latestVersion?.version_number ?? 0) + (params.latestDraft ? 0 : 1)
  const publicMeta = params.latestDraft ?? null
  const resolveNullableText = (value: string) => (value === '' ? null : value)
  const payload = {
    org_id: params.orgId,
    estimate_id: params.estimateId,
    customer_id: resolveNullableText(params.customerId),
    version_number: params.latestDraft
      ? Number(params.latestDraft.version_number ?? 1)
      : nextVersionNumber,
    status: 'draft',
    public_token: publicMeta?.public_token ?? null,
    to_email: resolveNullableText(params.draft.to_email),
    cc_email: resolveNullableText(params.draft.cc_email),
    bcc_email: resolveNullableText(params.draft.bcc_email),
    subject: resolveNullableText(params.draft.subject),
    body: resolveNullableText(params.draft.body),
    template_key: resolveNullableText(params.draft.template_key),
    snapshot_json: {
      document: params.document,
      draft: params.draft,
    },
    draft_json: params.draft,
    acceptance_json: publicMeta?.acceptance_json ?? null,
    sent_at: publicMeta?.sent_at ?? null,
    viewed_at: publicMeta?.viewed_at ?? null,
    accepted_at: publicMeta?.accepted_at ?? null,
    declined_at: publicMeta?.declined_at ?? null,
    locked_at: publicMeta?.locked_at ?? null,
    created_by: params.userId,
  }

  const result =
    params.latestDraft?.id
      ? await supabaseAdmin
          .from('estimate_public_versions')
          .update(payload)
          .eq('org_id', params.orgId)
          .eq('id', asText(params.latestDraft.id))
          .select('*')
          .single()
      : await supabaseAdmin
          .from('estimate_public_versions')
          .insert(payload)
          .select('*')
          .single()

  if (result.error || !result.data) {
    return errorResult('server_error', result.error?.message ?? 'Unable to save draft')
  }

  const eventResult = await writeEstimatePublicEvent({
    orgId: params.orgId,
    versionId: asText(result.data.id),
    eventType: 'draft_saved',
    actorType: 'staff',
    createdBy: params.userId,
    metadata: { draft: params.draft },
  })
  if (!eventResult.ok) return eventResult

  return okResult(result.data as EstimatePublicVersionRow)
}

export async function markEstimatePublicVersionSent(params: {
  orgId: string
  versionId: string
  publicToken: string
  sentAt: string
  lockFailureMessage: string
}): Promise<ServiceResult<EstimatePublicVersionRow>> {
  const result = await supabaseAdmin
    .from('estimate_public_versions')
    .update({
      status: 'sent',
      public_token: params.publicToken,
      sent_at: params.sentAt,
      locked_at: params.sentAt,
    })
    .eq('org_id', params.orgId)
    .eq('id', params.versionId)
    .select('*')
    .single()

  if (result.error || !result.data) {
    return errorResult(
      'server_error',
      result.error?.message ?? params.lockFailureMessage
    )
  }

  return okResult(result.data as EstimatePublicVersionRow)
}
