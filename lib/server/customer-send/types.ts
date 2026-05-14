import type { CustomerEstimateDocument } from '@/lib/customer-estimates/types'
import {
  appendEstimatePublicPersistedPdf,
  buildEstimatePublicPersistedSnapshot,
  type EstimatePublicPersistedSnapshot,
  readEstimatePublicPersistedSnapshotState,
  readEstimatePublicPersistedDocument,
  readEstimatePublicPersistedDraft,
  readEstimatePublicVersionDocument,
  readEstimatePublicVersionDraft,
} from '@/lib/customer-estimates/publicVersionSnapshot.ts'
export type {
  CustomerQuoteSourceModel,
  CustomerSendCopy,
  CustomerSendDraft,
  CustomerSendMode,
  CustomerSendMutationData,
  CustomerSendOperationalSnapshot,
  CustomerSendPageData,
  CustomerSendPublicMeta,
  CustomerSendScopeKey,
  CustomerSendSubmissionData,
  EstimateCustomerSendCalculatedData,
  EstimateCustomerSendContextData,
  EstimateCustomerSendContextResult,
  EstimateCustomerSendCoreResources,
  EstimateCustomerSendCustomerRow,
  EstimateCustomerSendEstimateRow,
  EstimateCustomerSendInputs,
  EstimateCustomerSendJobRow,
  EstimateCustomerSendRawResources,
  EstimateCustomerSendSettings,
  EstimateCustomerSendScopeResources,
  EstimateCustomerSendVersionResources,
  EstimateJobSettingsRow,
  EstimatePublicVersionRow,
  EstimateTemplateSettingsRow,
  QuoteSendDefaults,
} from './contextTypes'

export {
  CUSTOMER_SEND_OPERATIONAL_SNAPSHOT_KIND,
  CUSTOMER_SEND_OPERATIONAL_SNAPSHOT_VERSION,
  CUSTOMER_SEND_SCOPE_KEYS,
} from './contextTypes'

import type {
  CustomerSendDraft,
  CustomerSendOperationalSnapshot,
  EstimatePublicVersionRow,
} from './contextTypes'

type UnknownRecord = Record<string, unknown>

export type CustomerSendPersistedPdf = {
  drive_file_id: string
  drive_file_name: string
  drive_web_view_link: string | null
  filename: string
  mime_type: string
  saved_at: string
}

export type CustomerSendPersistedSnapshot = EstimatePublicPersistedSnapshot

export type CustomerSendStoredSnapshot = CustomerSendPersistedSnapshot

export type CustomerSendVersionArtifactState =
  | { kind: 'missing' }
  | {
      kind: 'canonical'
      document: CustomerEstimateDocument
      draftInput: Record<string, unknown>
      snapshot: EstimatePublicPersistedSnapshot
    }
  | {
      kind: 'legacy'
      document: CustomerEstimateDocument
      draftInput: Record<string, unknown>
      snapshot: EstimatePublicPersistedSnapshot
    }
  | {
      kind: 'invalid'
      reason:
        | 'snapshot_unreadable'
        | 'snapshot_missing_document'
        | 'snapshot_missing_draft'
        | 'document_unreadable'
      message: string
    }

function isRecord(value: unknown): value is UnknownRecord {
  return !!value && typeof value === 'object'
}

function isNullableString(value: unknown): value is string | null {
  return value == null || typeof value === 'string'
}

function isCustomerSendScopeTextEdits(
  value: unknown
): value is CustomerSendDraft['scope_text_edits'] {
  if (!isRecord(value)) return false
  return Object.values(value).every((entry) => typeof entry === 'string')
}

function isCustomerSendDraft(value: unknown): value is CustomerSendDraft {
  if (!isRecord(value)) return false

  return (
    typeof value.to_email === 'string' &&
    typeof value.cc_email === 'string' &&
    typeof value.bcc_email === 'string' &&
    typeof value.subject === 'string' &&
    typeof value.body === 'string' &&
    typeof value.template_key === 'string' &&
    typeof value.title === 'string' &&
    typeof value.intro_paragraph === 'string' &&
    typeof value.closing_paragraph === 'string' &&
    typeof value.terms_text === 'string' &&
    isCustomerSendScopeTextEdits(value.scope_text_edits) &&
    (value.quote_validity_days == null || typeof value.quote_validity_days === 'number') &&
    typeof value.deposit_language === 'string' &&
    typeof value.card_fee_note === 'string'
  )
}

function isCustomerSendPersistedPdf(value: unknown): value is CustomerSendPersistedPdf {
  if (!isRecord(value)) return false

  return (
    typeof value.drive_file_id === 'string' &&
    typeof value.drive_file_name === 'string' &&
    isNullableString(value.drive_web_view_link) &&
    typeof value.filename === 'string' &&
    typeof value.mime_type === 'string' &&
    typeof value.saved_at === 'string'
  )
}

function readPersistedDraft(value: unknown): CustomerSendDraft | undefined {
  return isCustomerSendDraft(value) ? value : undefined
}

function readOptionalRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined
}

export function readCustomerSendPersistedDraftInput(
  value: unknown
): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

export function readCustomerSendPersistedDocument(
  snapshot: unknown
): CustomerEstimateDocument | null {
  return readEstimatePublicPersistedDocument(snapshot)
}

export function readCustomerSendPersistedPdf(
  snapshot: unknown
): CustomerSendPersistedPdf | null {
  const state = readEstimatePublicPersistedSnapshotState(snapshot)
  if (state.kind !== 'canonical' && state.kind !== 'legacy') return null
  return isCustomerSendPersistedPdf(state.snapshot.pdf) ? state.snapshot.pdf : null
}

export function readCustomerSendStoredSnapshot(
  snapshot: unknown
): CustomerSendStoredSnapshot | null {
  const snapshotState = readEstimatePublicPersistedSnapshotState(snapshot)
  if (snapshotState.kind !== 'canonical' && snapshotState.kind !== 'legacy') return null
  const snapshotData = snapshotState.snapshot

  const draft = readPersistedDraft(snapshotData.draft)
  const pdf = isCustomerSendPersistedPdf(snapshotData.pdf) ? snapshotData.pdf : undefined

  return {
    artifact_kind: snapshotData.artifact_kind,
    artifact_version: snapshotData.artifact_version,
    document: snapshotData.document,
    ...(draft ? { draft } : {}),
    ...(pdf ? { pdf } : {}),
    ...(readOptionalRecord(snapshotData.operational_snapshot)
      ? { operational_snapshot: snapshotData.operational_snapshot }
      : {}),
  }
}

export function buildCustomerSendPersistedSnapshot(params: {
  document: CustomerEstimateDocument
  draft: CustomerSendDraft
  pdf?: CustomerSendPersistedPdf | Record<string, unknown> | null
  operationalSnapshot?: CustomerSendOperationalSnapshot | Record<string, unknown>
}): CustomerSendPersistedSnapshot {
  const snapshot = buildEstimatePublicPersistedSnapshot({
    document: params.document,
    draft: params.draft,
    pdf: params.pdf ?? undefined,
    operationalSnapshot: params.operationalSnapshot,
  })
  return {
    artifact_kind: snapshot.artifact_kind,
    artifact_version: snapshot.artifact_version,
    document: snapshot.document,
    draft: params.draft,
    ...(readOptionalRecord(snapshot.operational_snapshot)
      ? { operational_snapshot: snapshot.operational_snapshot }
      : {}),
  }
}

export function appendCustomerSendPersistedPdf(params: {
  snapshot: unknown
  document: CustomerEstimateDocument
  pdf: CustomerSendPersistedPdf
}): CustomerSendStoredSnapshot {
  const currentDraft = readEstimatePublicPersistedDraft(params.snapshot)

  const snapshot = appendEstimatePublicPersistedPdf({
    snapshot: params.snapshot,
    document: params.document,
    pdf: params.pdf,
  })
  return {
    artifact_kind: snapshot.artifact_kind,
    artifact_version: snapshot.artifact_version,
    document: snapshot.document,
    ...(Object.keys(currentDraft).length > 0 ? { draft: currentDraft } : {}),
    ...(readOptionalRecord(snapshot.operational_snapshot)
      ? { operational_snapshot: snapshot.operational_snapshot }
      : {}),
    pdf: params.pdf,
  }
}

export function readCustomerSendVersionDocument(
  version: Pick<EstimatePublicVersionRow, 'snapshot_json'> | null | undefined
): CustomerEstimateDocument | null {
  return readEstimatePublicVersionDocument(version)
}

export function readCustomerSendVersionArtifactState(
  version:
    | Pick<EstimatePublicVersionRow, 'snapshot_json' | 'draft_json'>
    | null
    | undefined
): CustomerSendVersionArtifactState {
  const snapshotState = readEstimatePublicPersistedSnapshotState(version?.snapshot_json ?? null)
  if (snapshotState.kind === 'missing') {
    return { kind: 'missing' }
  }
  if (snapshotState.kind === 'invalid') {
    return {
      kind: 'invalid',
      reason: snapshotState.reason,
      message:
        snapshotState.reason === 'snapshot_unreadable'
          ? 'Customer send preview snapshot is unreadable'
          : 'Customer send preview snapshot document is missing',
    }
  }

  const document = snapshotState.snapshot.document

  const legacyDraft = readCustomerSendPersistedDraftInput(version?.draft_json ?? null)
  if (snapshotState.kind === 'canonical') {
    const persistedDraft = readEstimatePublicPersistedDraft(version?.snapshot_json ?? null)
    if (Object.keys(persistedDraft).length === 0) {
      return {
        kind: 'invalid',
        reason: 'snapshot_missing_draft',
        message: 'Customer send preview snapshot draft is missing',
      }
    }

    return {
      kind: 'canonical',
      document,
      draftInput: persistedDraft,
      snapshot: snapshotState.snapshot,
    }
  }

  const legacySnapshotDraft = snapshotState.snapshot.draft ?? {}
  const persistedLegacyDraft =
    Object.keys(legacySnapshotDraft).length > 0 ? legacySnapshotDraft : legacyDraft

  if (Object.keys(persistedLegacyDraft).length === 0) {
    return {
      kind: 'invalid',
      reason: 'snapshot_missing_draft',
      message: 'Customer send preview snapshot draft is missing',
    }
  }

  return {
    kind: 'legacy',
    document,
    draftInput: persistedLegacyDraft,
    snapshot: snapshotState.snapshot,
  }
}

export function normalizeCustomerSendStoredSnapshot(
  snapshot: unknown
): CustomerSendStoredSnapshot | null {
  const snapshotState = readEstimatePublicPersistedSnapshotState(snapshot)
  if (snapshotState.kind !== 'canonical' && snapshotState.kind !== 'legacy') return null
  const normalized = snapshotState.snapshot

  const draft = readPersistedDraft(normalized.draft)
  const pdf = isCustomerSendPersistedPdf(normalized.pdf) ? normalized.pdf : undefined

  return {
    artifact_kind: normalized.artifact_kind,
    artifact_version: normalized.artifact_version,
    document: normalized.document,
    ...(draft ? { draft } : {}),
    ...(pdf ? { pdf } : {}),
    ...(readOptionalRecord(normalized.operational_snapshot)
      ? { operational_snapshot: normalized.operational_snapshot }
      : {}),
  }
}

export function readCustomerSendVersionDraftInput(
  version:
    | Pick<EstimatePublicVersionRow, 'snapshot_json' | 'draft_json'>
    | null
    | undefined
): Record<string, unknown> {
  const snapshotState = readEstimatePublicPersistedSnapshotState(version?.snapshot_json ?? null)
  if (snapshotState.kind === 'canonical') {
    const snapshotDraft = readEstimatePublicVersionDraft(version)
    if (Object.keys(snapshotDraft).length > 0) return snapshotDraft
  }
  if (snapshotState.kind === 'legacy' && snapshotState.snapshot.draft) {
    const legacySnapshotDraft = snapshotState.snapshot.draft
    if (Object.keys(legacySnapshotDraft).length > 0) return legacySnapshotDraft
  }
  return readCustomerSendPersistedDraftInput(version?.draft_json ?? null)
}
