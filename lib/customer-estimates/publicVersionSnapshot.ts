import { ensureAssembledCustomerEstimateDocument } from './assemble.ts'
import { asText } from './buildShared.ts'
import { normalizeEstimatePublicAcceptanceRecord } from './publicAcceptance.ts'
import type { CustomerEstimateDocument, EstimatePublicSnapshot, Unsafe } from './types'
import type { CustomerSendOperationalSnapshot } from '@/lib/server/customer-send/contextTypes'

type UnknownRecord = Record<string, unknown>

export const ESTIMATE_PUBLIC_PERSISTED_SNAPSHOT_KIND = 'customer_estimate_artifact'
export const ESTIMATE_PUBLIC_PERSISTED_SNAPSHOT_VERSION = 1

export type EstimatePublicPersistedSnapshot = {
  artifact_kind: typeof ESTIMATE_PUBLIC_PERSISTED_SNAPSHOT_KIND
  artifact_version: typeof ESTIMATE_PUBLIC_PERSISTED_SNAPSHOT_VERSION
  document: CustomerEstimateDocument
  draft?: Record<string, unknown>
  pdf?: Record<string, unknown>
  operational_snapshot?: CustomerSendOperationalSnapshot | Record<string, unknown>
}

export type EstimatePublicPersistedSnapshotState =
  | { kind: 'missing' }
  | {
      kind: 'canonical'
      snapshot: EstimatePublicPersistedSnapshot
    }
  | {
      kind: 'legacy'
      snapshot: EstimatePublicPersistedSnapshot
      legacy_reason: 'legacy_wrapped_snapshot' | 'legacy_bare_document'
    }
  | {
      kind: 'invalid'
      reason: 'snapshot_unreadable' | 'snapshot_missing_document'
      message: string
    }

type EstimatePublicVersionLike = {
  id?: unknown
  status?: unknown
  public_token?: unknown
  version_number?: unknown
  estimate_id?: unknown
  snapshot_json?: unknown
  acceptance_json?: unknown
  sent_at?: unknown
  viewed_at?: unknown
  accepted_at?: unknown
  declined_at?: unknown
  locked_at?: unknown
  [key: string]: unknown
}

function isRecord(value: unknown): value is UnknownRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((entry) => asText(entry)).filter(Boolean)
    : []
}

function isNullableString(value: unknown): value is string | null {
  return value == null || typeof value === 'string'
}

function hasCustomerEstimateDocumentMeta(
  value: unknown
): value is CustomerEstimateDocument['meta'] {
  if (!isRecord(value)) return false

  return (
    typeof value.estimate_id === 'string' &&
    typeof value.version_name === 'string' &&
    typeof value.version_state === 'string' &&
    typeof value.flow_version === 'string' &&
    typeof value.title === 'string' &&
    typeof value.quote_date === 'string' &&
    typeof value.status === 'string' &&
    isNullableString(value.sent_at) &&
    isNullableString(value.viewed_at) &&
    isNullableString(value.accepted_at) &&
    isNullableString(value.declined_at) &&
    isNullableString(value.public_token)
  )
}

function isLegacyCustomerEstimateDocument(value: unknown): value is UnknownRecord {
  return isRecord(value) && hasCustomerEstimateDocumentMeta(value.meta)
}

function isCanonicalEstimatePublicPersistedSnapshotRecord(
  value: unknown
): value is EstimatePublicPersistedSnapshot {
  return (
    isRecord(value) &&
    asText(value.artifact_kind) === ESTIMATE_PUBLIC_PERSISTED_SNAPSHOT_KIND &&
    Number(value.artifact_version) === ESTIMATE_PUBLIC_PERSISTED_SNAPSHOT_VERSION &&
    'document' in value
  )
}

function toPersistedDocumentRecord(value: unknown): UnknownRecord | null {
  const record = isRecord(value) ? value : null
  if (!record) return null
  const documentRecord = { ...record }
  delete documentRecord.draft
  delete documentRecord.pdf
  return documentRecord
}

function buildNormalizedCustomerEstimateDocument(
  value: unknown
): CustomerEstimateDocument | null {
  const record = toPersistedDocumentRecord(value)
  if (!record) return null
  return ensureAssembledCustomerEstimateDocument({
    ...record,
    terms: asStringArray(record.terms),
  })
}

function readPersistedDocumentRecord(snapshot: unknown): UnknownRecord | null {
  const record = isRecord(snapshot) ? snapshot : null
  if (isLegacyCustomerEstimateDocument(record?.document)) {
    return toPersistedDocumentRecord(record.document)
  }
  if (!isLegacyCustomerEstimateDocument(snapshot)) return null
  return toPersistedDocumentRecord(snapshot)
}

function readOptionalRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined
}

function readPersistedSnapshotParts(snapshot: unknown): {
  source: 'canonical' | 'legacy_wrapped_snapshot' | 'legacy_bare_document'
  canonicalDocument?: CustomerEstimateDocument
  documentRecord: UnknownRecord | null
  draft?: Record<string, unknown>
  pdf?: Record<string, unknown>
  operationalSnapshot?: CustomerSendOperationalSnapshot | Record<string, unknown>
} | null {
  const record = isRecord(snapshot) ? snapshot : null
  if (isCanonicalEstimatePublicPersistedSnapshotRecord(record)) {
    const documentRecord = readPersistedDocumentRecord(snapshot)
    if (!documentRecord) return null

    return {
      source: 'canonical',
      canonicalDocument: record.document,
      documentRecord,
      draft: readOptionalRecord(record.draft),
      pdf: readOptionalRecord(record.pdf),
      operationalSnapshot: readOptionalRecord(record.operational_snapshot),
    }
  }

  const documentRecord = readPersistedDocumentRecord(snapshot)
  if (!documentRecord) return null

  if (record && 'document' in record && isLegacyCustomerEstimateDocument(record.document)) {
    return {
      source: 'legacy_wrapped_snapshot',
      canonicalDocument: record.document as CustomerEstimateDocument,
      documentRecord,
      draft: readOptionalRecord(record?.draft),
      pdf: readOptionalRecord(record?.pdf),
      operationalSnapshot: readOptionalRecord(record?.operational_snapshot),
    }
  }

  return {
    source: 'legacy_bare_document',
    documentRecord,
    draft: readOptionalRecord(record?.draft),
    pdf: readOptionalRecord(record?.pdf),
    operationalSnapshot: readOptionalRecord(record?.operational_snapshot),
  }
}

export function deriveEstimatePublicUrl(origin?: string, publicToken?: string | null) {
  const normalizedOrigin = asText(origin)
  const normalizedToken = asText(publicToken)
  if (!normalizedOrigin || !normalizedToken) return null
  return `${normalizedOrigin}/quote/${normalizedToken}`
}

export function readEstimatePublicPersistedDocument(
  snapshot: unknown
): CustomerEstimateDocument | null {
  const state = readEstimatePublicPersistedSnapshotState(snapshot)
  if (state.kind === 'canonical' || state.kind === 'legacy') {
    return state.snapshot.document
  }
  return null
}

export function readEstimatePublicPersistedDraft(
  snapshot: unknown
): Record<string, unknown> {
  const state = readEstimatePublicPersistedSnapshotState(snapshot)
  if (state.kind === 'canonical' || state.kind === 'legacy') {
    return state.snapshot.draft ?? {}
  }
  return {}
}

export function readEstimatePublicPersistedSnapshot(
  snapshot: unknown
): EstimatePublicPersistedSnapshot | null {
  const state = readEstimatePublicPersistedSnapshotState(snapshot)
  if (state.kind !== 'canonical' && state.kind !== 'legacy') return null
  return state.snapshot
}

export type CanonicalEstimatePublicPersistedSnapshotResult =
  | { ok: true; snapshot: EstimatePublicPersistedSnapshot }
  | {
      ok: false
      reason: 'missing' | 'legacy' | 'invalid'
      message: string
    }

export function readCanonicalEstimatePublicPersistedSnapshot(
  snapshot: unknown
): CanonicalEstimatePublicPersistedSnapshotResult {
  const state = readEstimatePublicPersistedSnapshotState(snapshot)
  if (state.kind === 'canonical') {
    return {
      ok: true,
      snapshot: state.snapshot,
    }
  }
  if (state.kind === 'legacy') {
    return {
      ok: false,
      reason: 'legacy',
      message:
        'Quote snapshot requires migration to the canonical customer artifact before public rendering.',
    }
  }
  if (state.kind === 'invalid') {
    return {
      ok: false,
      reason: 'invalid',
      message: state.message,
    }
  }
  return {
    ok: false,
    reason: 'missing',
    message: 'Quote snapshot missing',
  }
}

export function normalizeEstimatePublicPersistedSnapshot(
  snapshot: unknown
): EstimatePublicPersistedSnapshot | null {
  const parts = readPersistedSnapshotParts(snapshot)
  if (!parts) return null

  const document =
    parts.canonicalDocument ??
    buildNormalizedCustomerEstimateDocument(parts.documentRecord)
  if (!document) return null

  return buildEstimatePublicPersistedSnapshot({
    document,
    draft: parts.draft,
    pdf: parts.pdf,
    operationalSnapshot: parts.operationalSnapshot,
  })
}

export function readEstimatePublicPersistedSnapshotState(
  snapshot: unknown
): EstimatePublicPersistedSnapshotState {
  if (snapshot == null) {
    return { kind: 'missing' }
  }

  const parts = readPersistedSnapshotParts(snapshot)
  if (!parts) {
    return {
      kind: 'invalid',
      reason: 'snapshot_unreadable',
      message: 'Quote snapshot is unreadable',
    }
  }

  const document =
    parts.canonicalDocument ??
    buildNormalizedCustomerEstimateDocument(parts.documentRecord)
  if (!document) {
    return {
      kind: 'invalid',
      reason: 'snapshot_missing_document',
      message: 'Quote snapshot document is missing',
    }
  }

  const normalizedSnapshot = buildEstimatePublicPersistedSnapshot({
    document,
    draft: parts.draft,
    pdf: parts.pdf,
    operationalSnapshot: parts.operationalSnapshot,
  })

  if (parts.source === 'canonical') {
    return {
      kind: 'canonical',
      snapshot: normalizedSnapshot,
    }
  }

  return {
    kind: 'legacy',
    snapshot: normalizedSnapshot,
    legacy_reason: parts.source,
  }
}

export function buildEstimatePublicPersistedSnapshot(params: {
  document: CustomerEstimateDocument
  draft?: Record<string, unknown>
  pdf?: Record<string, unknown>
  operationalSnapshot?: CustomerSendOperationalSnapshot | Record<string, unknown>
}): EstimatePublicPersistedSnapshot {
  return {
    artifact_kind: ESTIMATE_PUBLIC_PERSISTED_SNAPSHOT_KIND,
    artifact_version: ESTIMATE_PUBLIC_PERSISTED_SNAPSHOT_VERSION,
    document: params.document,
    ...(readOptionalRecord(params.draft) ? { draft: params.draft } : {}),
    ...(readOptionalRecord(params.pdf) ? { pdf: params.pdf } : {}),
    ...(readOptionalRecord(params.operationalSnapshot)
      ? { operational_snapshot: params.operationalSnapshot }
      : {}),
  }
}

export function appendEstimatePublicPersistedPdf(params: {
  snapshot: unknown
  document: CustomerEstimateDocument
  pdf: Record<string, unknown>
}): EstimatePublicPersistedSnapshot {
  const current = readEstimatePublicPersistedSnapshot(params.snapshot)
  return buildEstimatePublicPersistedSnapshot({
    document: params.document,
    draft: current?.draft,
    pdf: params.pdf,
    operationalSnapshot: current?.operational_snapshot,
  })
}

export function readEstimatePublicVersionDocument(
  version: Pick<EstimatePublicVersionLike, 'snapshot_json'> | null | undefined
): CustomerEstimateDocument | null {
  return readEstimatePublicPersistedDocument(version?.snapshot_json ?? null)
}

export function readEstimatePublicVersionDraft(
  version: Pick<EstimatePublicVersionLike, 'snapshot_json'> | null | undefined
): Record<string, unknown> {
  return readEstimatePublicPersistedDraft(version?.snapshot_json ?? null)
}

export function selectCurrentEstimatePublicVersionRows<T extends EstimatePublicVersionLike>(
  versions: T[]
): {
  draftVersion: T | null
  sentVersion: T | null
  latestVersion: T | null
} {
  const draftVersion = versions.find((row) => asText(row.status) === 'draft') ?? null
  const sentVersion =
    versions.find(
      (row) => asText(row.status) !== 'draft' && asText(row.public_token) !== ''
    ) ?? null
  const latestVersion = draftVersion ?? sentVersion ?? versions[0] ?? null

  return {
    draftVersion,
    sentVersion,
    latestVersion,
  }
}

export function buildEstimatePublicSnapshot(params: {
  version: Unsafe
  document: CustomerEstimateDocument
  draft?: Record<string, unknown>
  pdf?: Record<string, unknown>
  operationalSnapshot?: CustomerSendOperationalSnapshot | Record<string, unknown>
  publicUrl: string | null
}): EstimatePublicSnapshot {
  return {
    estimate_id: params.document.meta.estimate_id,
    estimate_version_id: asText(params.version.id),
    version_number: Number(params.version.version_number ?? 0),
    status: (asText(params.version.status) || 'draft') as EstimatePublicSnapshot['status'],
    public_token: asText(params.version.public_token) || null,
    public_url: params.publicUrl,
    draft: readOptionalRecord(params.draft) ?? {},
    document: params.document,
    snapshot_json: buildEstimatePublicPersistedSnapshot({
      document: params.document,
      draft: params.draft,
      pdf: params.pdf,
      operationalSnapshot: params.operationalSnapshot,
    }),
    acceptance_json: normalizeEstimatePublicAcceptanceRecord(params.version.acceptance_json),
    sent_at: asText(params.version.sent_at) || null,
    viewed_at: asText(params.version.viewed_at) || null,
    accepted_at: asText(params.version.accepted_at) || null,
    declined_at: asText(params.version.declined_at) || null,
    locked_at: asText(params.version.locked_at) || null,
  }
}

export function buildEstimatePublicSnapshotFromVersion(params: {
  version: Unsafe
  origin?: string
}): EstimatePublicSnapshot | { error: string } {
  const snapshotResult = readCanonicalEstimatePublicPersistedSnapshot(
    params.version.snapshot_json
  )
  if (!snapshotResult.ok) return { error: snapshotResult.message }
  const snapshot = snapshotResult.snapshot
  const document = buildNormalizedCustomerEstimateDocument(snapshot.document)
  if (!document) return { error: 'Quote snapshot missing' }

  return buildEstimatePublicSnapshot({
    version: params.version,
    document,
    draft: snapshot.draft,
    pdf: snapshot.pdf,
    operationalSnapshot: snapshot.operational_snapshot,
    publicUrl: deriveEstimatePublicUrl(
      params.origin,
      asText(params.version.public_token) || null
    ),
  })
}
