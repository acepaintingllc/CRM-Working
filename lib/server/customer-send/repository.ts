import {
  errorResult,
  okResult,
  type ServiceResult,
} from '@/lib/server/serviceResult'
import { supabaseAdmin } from '@/lib/server/org'
import type { CustomerEstimateDocument } from '@/lib/customer-estimates/types'
import { asText } from './document'
import type {
  CustomerSendDraft,
  CustomerSendOperationalSnapshot,
  CustomerSendPersistedPdf,
  CustomerSendStoredSnapshot,
  EstimatePublicVersionRow,
} from './types'
import {
  appendCustomerSendPersistedPdf,
  buildCustomerSendPersistedSnapshot,
  normalizeCustomerSendStoredSnapshot,
  readCustomerSendVersionDocument,
} from './types'

type EstimatePublicEventType =
  | 'draft_saved'
  | 'sent'
  | 'viewed'
  | 'accepted'
  | 'declined'
  | 'superseded'
  | 'pdf_requested'

function readEstimatePublicVersionRow(
  value: EstimatePublicVersionRow | null | undefined
): EstimatePublicVersionRow | null {
  // Supabase row payloads are an untrusted DB boundary until we verify an object exists.
  return value && typeof value === 'object' ? value : null
}

function readSupersededVersionIds(value: Array<{ id?: unknown }> | null | undefined): string[] {
  // Supabase selected rows are an untrusted DB boundary until ids are normalized to strings.
  return (value ?? []).map((row) => asText(row.id)).filter(Boolean)
}

function isMutableDraftVersion(version: EstimatePublicVersionRow | null | undefined) {
  return asText(version?.status || 'draft') === 'draft'
}

function documentsMatch(
  left: CustomerEstimateDocument | null | undefined,
  right: CustomerEstimateDocument | null | undefined
) {
  if (!left || !right) return false
  return JSON.stringify(left) === JSON.stringify(right)
}

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
  document: CustomerEstimateDocument
  operationalSnapshot?: CustomerSendOperationalSnapshot
  latestDraft: EstimatePublicVersionRow | null
  latestVersion: EstimatePublicVersionRow | null
}): Promise<ServiceResult<EstimatePublicVersionRow>> {
  const latestDraft = isMutableDraftVersion(params.latestDraft) ? params.latestDraft : null
  const nextVersionNumber =
    Number(params.latestVersion?.version_number ?? 0) + (latestDraft ? 0 : 1)
  const publicMeta = latestDraft ?? null
  const resolveNullableText = (value: string) => (value === '' ? null : value)
  const payload = {
    org_id: params.orgId,
    estimate_id: params.estimateId,
    customer_id: resolveNullableText(params.customerId),
    version_number: latestDraft
      ? Number(latestDraft.version_number ?? 1)
      : nextVersionNumber,
    status: 'draft',
    public_token: publicMeta?.public_token ?? null,
    to_email: resolveNullableText(params.draft.to_email),
    cc_email: resolveNullableText(params.draft.cc_email),
    bcc_email: resolveNullableText(params.draft.bcc_email),
    subject: resolveNullableText(params.draft.subject),
    body: resolveNullableText(params.draft.body),
    template_key: resolveNullableText(params.draft.template_key),
    snapshot_json: buildCustomerSendPersistedSnapshot({
      document: params.document,
      draft: params.draft,
      operationalSnapshot: params.operationalSnapshot,
    }),
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
    latestDraft?.id
      ? await supabaseAdmin
          .from('estimate_public_versions')
          .update(payload)
          .eq('org_id', params.orgId)
          .eq('id', asText(latestDraft.id))
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

  const versionRow = readEstimatePublicVersionRow(result.data)
  if (!versionRow) {
    return errorResult('server_error', 'Unable to save draft')
  }

  return okResult(versionRow)
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

  const versionRow = readEstimatePublicVersionRow(result.data)
  if (!versionRow) {
    return errorResult('server_error', params.lockFailureMessage)
  }

  return okResult(versionRow)
}

export async function supersedeOlderPublicEstimateVersions(params: {
  orgId: string
  estimateId: string
  currentVersionId: string
  supersededAt: string
  userId: string
}): Promise<ServiceResult<{ supersededIds: string[] }>> {
  const result = await supabaseAdmin
    .from('estimate_public_versions')
    .update({
      status: 'superseded',
      locked_at: params.supersededAt,
    })
    .eq('org_id', params.orgId)
    .eq('estimate_id', params.estimateId)
    .neq('id', params.currentVersionId)
    .in('status', ['sent', 'viewed'])
    .select('id')

  if (result.error) {
    return errorResult('server_error', result.error.message)
  }

  const supersededIds = readSupersededVersionIds(result.data)

  for (const versionId of supersededIds) {
    const eventResult = await writeEstimatePublicEvent({
      orgId: params.orgId,
      versionId,
      eventType: 'superseded',
      actorType: 'staff',
      createdBy: params.userId,
      metadata: {
        superseded_by_version_id: params.currentVersionId,
      },
    })
    if (!eventResult.ok) return eventResult
  }

  return okResult({ supersededIds })
}

export async function updateEstimatePublicVersionSnapshot(params: {
  orgId: string
  version: EstimatePublicVersionRow
  snapshot: CustomerSendStoredSnapshot
  clearLegacyDraftJson?: boolean
}): Promise<ServiceResult<EstimatePublicVersionRow>> {
  const versionId = asText(params.version.id)
  if (!versionId) {
    return errorResult('server_error', 'Unable to save quote PDF metadata')
  }

  if (!isMutableDraftVersion(params.version)) {
    const currentDocument = readCustomerSendVersionDocument(params.version)
    if (!documentsMatch(currentDocument, params.snapshot.document)) {
      return errorResult(
        'invalid_input',
        'Sent quote documents are immutable and cannot be replaced.'
      )
    }
  }

  const result = await supabaseAdmin
    .from('estimate_public_versions')
    .update({
      snapshot_json: params.snapshot,
      ...(params.clearLegacyDraftJson ? { draft_json: null } : {}),
    })
    .eq('org_id', params.orgId)
    .eq('id', versionId)
    .select('*')
    .single()

  if (result.error || !result.data) {
    return errorResult(
      'server_error',
      result.error?.message ?? 'Unable to save quote PDF metadata'
    )
  }

  const versionRow = readEstimatePublicVersionRow(result.data)
  if (!versionRow) {
    return errorResult('server_error', 'Unable to save quote PDF metadata')
  }

  return okResult(versionRow)
}

export async function upgradeCustomerSendLegacyVersionSnapshot(params: {
  orgId: string
  version: EstimatePublicVersionRow
  document: CustomerEstimateDocument
  draft: CustomerSendDraft
}): Promise<ServiceResult<EstimatePublicVersionRow>> {
  if (!isMutableDraftVersion(params.version)) {
    return errorResult(
      'invalid_input',
      'Sent quote snapshots must be migrated before public rendering.'
    )
  }

  return updateEstimatePublicVersionSnapshot({
    orgId: params.orgId,
    version: params.version,
    snapshot: buildCustomerSendPersistedSnapshot({
      document: params.document,
      draft: params.draft,
    }),
    clearLegacyDraftJson: true,
  })
}

export async function appendEstimatePublicVersionPdf(params: {
  orgId: string
  version: EstimatePublicVersionRow
  pdf: CustomerSendPersistedPdf
}): Promise<ServiceResult<EstimatePublicVersionRow>> {
  const normalizedSnapshot = normalizeCustomerSendStoredSnapshot(params.version.snapshot_json)
  if (!normalizedSnapshot) {
    return errorResult('server_error', 'Unable to save quote PDF metadata')
  }

  return updateEstimatePublicVersionSnapshot({
    orgId: params.orgId,
    version: params.version,
    snapshot: appendCustomerSendPersistedPdf({
      snapshot: params.version.snapshot_json,
      document: normalizedSnapshot.document,
      pdf: params.pdf,
    }),
  })
}
