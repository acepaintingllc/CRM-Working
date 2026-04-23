import { asText } from './buildShared.ts'
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
  const meta = asRecord(record?.meta)
  const company = asRecord(record?.company)
  const customer = asRecord(record?.customer)

  if (!record || !meta || !company || !customer) return null

  return {
    meta: {
      estimate_id: asText(meta.estimate_id),
      version_name: asText(meta.version_name),
      version_state: asText(meta.version_state),
      flow_version: asText(meta.flow_version),
      title: asText(meta.title),
      quote_date: asText(meta.quote_date),
      sent_at: asText(meta.sent_at) || null,
      viewed_at: asText(meta.viewed_at) || null,
      accepted_at: asText(meta.accepted_at) || null,
      declined_at: asText(meta.declined_at) || null,
      status: asText(meta.status),
      public_token: asText(meta.public_token) || null,
    },
    company: {
      business_name: asText(company.business_name),
      timezone: asText(company.timezone),
      main_phone: asText(company.main_phone),
      business_email: asText(company.business_email),
      address: asText(company.address),
      website: asText(company.website),
      sender_signature: asText(company.sender_signature),
      logo_url: asText(company.logo_url),
    },
    customer: {
      name: asText(customer.name),
      email: asText(customer.email),
      phone: asText(customer.phone),
      address: asText(customer.address),
      street: asText(customer.street),
      city: asText(customer.city),
      state: asText(customer.state),
      zip: asText(customer.zip),
    },
    intro_paragraph: asText(record.intro_paragraph),
    closing_paragraph: asText(record.closing_paragraph),
    quote_validity_days: Number(record.quote_validity_days ?? 0),
    deposit_language: asText(record.deposit_language),
    card_fee_note: asText(record.card_fee_note),
    quote_rows: Array.isArray(record.quote_rows)
      ? record.quote_rows
          .map((entry) => {
            const row = asRecord(entry)
            if (!row) return null
            return {
              key: asText(row.key) as CustomerEstimateDocument['quote_rows'][number]['key'],
              label: asText(row.label),
              description: asText(row.description),
              price: Number(row.price ?? 0),
            }
          })
          .filter((entry): entry is CustomerEstimateDocument['quote_rows'][number] => !!entry)
      : [],
    scopes: Array.isArray(record.scopes)
      ? record.scopes
          .map((entry) => {
            const scope = asRecord(entry)
            if (!scope) return null
            return {
              key: asText(scope.key) as CustomerEstimateDocument['scopes'][number]['key'],
              label: asText(scope.label),
              text: asText(scope.text),
              price:
                scope.price == null || scope.price === ''
                  ? null
                  : Number(scope.price),
            }
          })
          .filter((entry): entry is CustomerEstimateDocument['scopes'][number] => !!entry)
      : [],
    total:
      record.total == null || record.total === '' ? null : Number(record.total),
    terms: asStringArray(record.terms),
  }
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
