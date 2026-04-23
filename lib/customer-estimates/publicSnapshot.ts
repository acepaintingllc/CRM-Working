import { asText } from './buildShared.ts'
import { ensureAssembledCustomerEstimateDocument } from './assemble.ts'
import type { CustomerEstimateDocument, EstimatePublicSnapshot, Unsafe } from './types.ts'

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
    sent_at: asText(params.version.sent_at) || null,
    viewed_at: asText(params.version.viewed_at) || null,
    accepted_at: asText(params.version.accepted_at) || null,
    declined_at: asText(params.version.declined_at) || null,
    locked_at: asText(params.version.locked_at) || null,
  }
}

function isNonEmptyRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0
}

export function buildEstimatePublicSnapshotFromVersion(params: {
  version: Unsafe
  origin?: string
}): EstimatePublicSnapshot | { error: string } {
  const token = asText(params.version.public_token)
  const snapshotJson = isNonEmptyRecord(params.version.snapshot_json)
    ? params.version.snapshot_json
    : null
  if (!snapshotJson) return { error: 'Quote snapshot missing' }

  const rawDocument = (
    isNonEmptyRecord(snapshotJson.document) ? snapshotJson.document : snapshotJson
  ) as CustomerEstimateDocument | Record<string, unknown>
  if (!isNonEmptyRecord(rawDocument)) return { error: 'Quote snapshot missing' }

  const document = ensureAssembledCustomerEstimateDocument(rawDocument)
  if (!document) return { error: 'Quote snapshot missing' }

  const draft = isNonEmptyRecord(snapshotJson.draft)
    ? snapshotJson.draft
    : {}

  return buildEstimatePublicSnapshot({
    version: params.version,
    document,
    draft,
    publicUrl: params.origin && token ? `${params.origin}/quote/${token}` : null,
  })
}
