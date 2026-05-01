import { ensureAssembledCustomerEstimateDocument } from './assemble.ts'
import { asText } from './buildShared.ts'
import { normalizeEstimatePublicAcceptanceRecord } from './publicAcceptance.ts'
import type { CustomerEstimateDocument, EstimatePublicSnapshot, Unsafe } from './types.ts'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((entry) => asText(entry)).filter(Boolean)
    : []
}

function ensureCustomerEstimateDocument(value: unknown): CustomerEstimateDocument | null {
  const record = asRecord(value)
  if (!record) return null
  return ensureAssembledCustomerEstimateDocument({
    ...record,
    terms: asStringArray(record.terms),
  })
}

export function buildEstimatePublicSnapshot(params: {
  version: Unsafe
  document: CustomerEstimateDocument
  draft: Record<string, unknown>
  publicUrl: string | null
}): EstimatePublicSnapshot {
  return {
    estimate_id: params.document.meta.estimate_id,
    estimate_version_id: asText(params.version.id),
    version_number: Number(params.version.version_number ?? 0),
    status: (asText(params.version.status) || 'draft') as EstimatePublicSnapshot['status'],
    public_token: asText(params.version.public_token) || null,
    public_url: params.publicUrl,
    draft: params.draft,
    document: params.document,
    snapshot_json: {
      document: params.document,
      draft: params.draft,
    },
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
  const token = asText(params.version.public_token)
  const snapshotJson = asRecord(params.version.snapshot_json)
  if (!snapshotJson) return { error: 'Quote snapshot missing' }

  const rawDocument = asRecord(snapshotJson.document) ?? snapshotJson
  const document = ensureCustomerEstimateDocument(rawDocument)
  if (!document) return { error: 'Quote snapshot missing' }

  const draft = asRecord(snapshotJson.draft) ?? {}

  return buildEstimatePublicSnapshot({
    version: params.version,
    document,
    draft,
    publicUrl: params.origin && token ? `${params.origin}/quote/${token}` : null,
  })
}
