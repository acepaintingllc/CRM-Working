import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ESTIMATE_PUBLIC_PERSISTED_SNAPSHOT_KIND,
  ESTIMATE_PUBLIC_PERSISTED_SNAPSHOT_VERSION,
  buildEstimatePublicSnapshotFromVersion,
  deriveEstimatePublicUrl,
  normalizeEstimatePublicPersistedSnapshot,
  readCanonicalEstimatePublicPersistedSnapshot,
  readEstimatePublicPersistedSnapshot,
  readEstimatePublicPersistedSnapshotState,
  selectCurrentEstimatePublicVersionRows,
} from '../publicSnapshot.ts'
import type { CustomerEstimateDocument } from '../types'

function buildDocument(overrides: Partial<CustomerEstimateDocument> = {}): CustomerEstimateDocument {
  return {
    meta: {
      estimate_id: 'estimate-1',
      version_name: 'Kitchen Quote',
      version_state: 'draft',
      flow_version: 'v2',
      title: 'Kitchen Quote',
      quote_date: '2026-05-01',
      sent_at: null,
      viewed_at: null,
      accepted_at: null,
      declined_at: null,
      status: 'draft',
      public_token: null,
    },
    company: {
      business_name: 'ACE Painting',
      timezone: 'America/Chicago',
      main_phone: '555-0100',
      business_email: 'hello@example.test',
      address: '123 Main St',
      website: '',
      sender_signature: '',
      logo_url: '',
    },
    customer: {
      name: 'Taylor',
      email: 'taylor@example.test',
      phone: '555-0123',
      address: '123 Main St',
      street: '123 Main St',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
    },
    intro_paragraph: '',
    closing_paragraph: '',
    quote_validity_days: 30,
    deposit_language: '',
    card_fee_note: '',
    quote_rows: [],
    scopes: [],
    total: 1200,
    terms: ['Terms line'],
    source_meta: {
      company: {
        business_name: true,
        main_phone: true,
        business_email: true,
        address: true,
        website: false,
        sender_signature: false,
        logo_url: false,
      },
      settings: {
        quote_validity_days: true,
        terms_text: true,
      },
      overrides: {
        title: false,
        intro_paragraph: false,
        closing_paragraph: false,
        deposit_language: false,
        card_fee_note: false,
      },
    },
    header: {
      company_name: 'ACE Painting',
      contact_lines: ['555-0100', 'hello@example.test'],
      logo_url: '',
      document_label: 'QUOTE',
      quote_date_label: '2026-05-01',
    },
    customer_block: {
      lines: ['Taylor', '123 Main St'],
    },
    pricing_block: {
      rows: [],
      total: 1200,
      footer_note: 'Footer note',
    },
    terms_page: {
      title: 'QUOTE TERMS',
      sections: [],
    },
    assembly_meta: {
      missing_company_fields: [],
      missing_payment_fields: [],
      missing_legal_fields: [],
      used_placeholder_fallbacks: false,
      used_explicit_terms_text: true,
    },
    ...overrides,
  }
}

describe('public version snapshot contract', () => {
  it('reads the canonical persisted snapshot shape', () => {
    const document = buildDocument()
    const snapshot = readEstimatePublicPersistedSnapshot({
      artifact_kind: ESTIMATE_PUBLIC_PERSISTED_SNAPSHOT_KIND,
      artifact_version: ESTIMATE_PUBLIC_PERSISTED_SNAPSHOT_VERSION,
      document,
      draft: { subject: 'Quote ready' },
      pdf: { filename: 'quote.pdf' },
    })

    assert.deepEqual(snapshot, {
      artifact_kind: ESTIMATE_PUBLIC_PERSISTED_SNAPSHOT_KIND,
      artifact_version: ESTIMATE_PUBLIC_PERSISTED_SNAPSHOT_VERSION,
      document,
      draft: { subject: 'Quote ready' },
      pdf: { filename: 'quote.pdf' },
    })
  })

  it('keeps legacy bare-document rows readable only through the migration reader', () => {
    const legacyDocument = {
      ...buildDocument(),
      draft: { subject: 'Legacy draft' },
      pdf: { filename: 'legacy.pdf' },
    }

    assert.deepEqual(readCanonicalEstimatePublicPersistedSnapshot(legacyDocument), {
      ok: false,
      reason: 'legacy',
      message:
        'Quote snapshot requires migration to the canonical customer artifact before public rendering.',
    })
    const normalized = normalizeEstimatePublicPersistedSnapshot(legacyDocument)
    assert.ok(normalized)
    assert.equal(normalized.artifact_kind, ESTIMATE_PUBLIC_PERSISTED_SNAPSHOT_KIND)
    assert.equal(normalized.artifact_version, ESTIMATE_PUBLIC_PERSISTED_SNAPSHOT_VERSION)
    assert.deepEqual(normalized.draft, { subject: 'Legacy draft' })
    assert.deepEqual(normalized.pdf, { filename: 'legacy.pdf' })
  })

  it('rewrites legacy bare-document rows into the canonical wrapped snapshot shape', () => {
    const legacyDocument = {
      ...buildDocument(),
      draft: { subject: 'Legacy draft' },
      pdf: { filename: 'legacy.pdf' },
    }

    assert.deepEqual(normalizeEstimatePublicPersistedSnapshot(legacyDocument), {
      artifact_kind: ESTIMATE_PUBLIC_PERSISTED_SNAPSHOT_KIND,
      artifact_version: ESTIMATE_PUBLIC_PERSISTED_SNAPSHOT_VERSION,
      document: buildDocument(),
      draft: { subject: 'Legacy draft' },
      pdf: { filename: 'legacy.pdf' },
    })
  })

  it('fails closed when building a public snapshot from a legacy persisted row', () => {
    const document = buildDocument()
    const snapshot = buildEstimatePublicSnapshotFromVersion({
      version: {
        id: 'version-1',
        version_number: 3,
        status: 'sent',
        public_token: 'token-1',
        snapshot_json: {
          ...document,
          draft: { body: 'Legacy body' },
          pdf: { filename: 'legacy.pdf' },
        },
      },
      origin: 'https://example.test',
    })

    assert.deepEqual(snapshot, {
      error:
        'Quote snapshot requires migration to the canonical customer artifact before public rendering.',
    })
  })

  it('builds a public snapshot from a canonical persisted row', () => {
    const document = buildDocument()
    const snapshot = buildEstimatePublicSnapshotFromVersion({
      version: {
        id: 'version-1',
        version_number: 3,
        status: 'sent',
        public_token: 'token-1',
        snapshot_json: {
          artifact_kind: ESTIMATE_PUBLIC_PERSISTED_SNAPSHOT_KIND,
          artifact_version: ESTIMATE_PUBLIC_PERSISTED_SNAPSHOT_VERSION,
          document,
          draft: { body: 'Canonical body' },
        },
      },
      origin: 'https://example.test',
    })

    assert.ok(!('error' in snapshot))
    assert.equal(snapshot.estimate_id, 'estimate-1')
    assert.equal(snapshot.estimate_version_id, 'version-1')
    assert.equal(snapshot.status, 'sent')
    assert.equal(snapshot.public_url, 'https://example.test/quote/token-1')
    assert.deepEqual(snapshot.draft, { body: 'Canonical body' })
    assert.deepEqual(snapshot.document, document)
  })

  it('selects the current draft, sent, and latest version rows from one shared policy', () => {
    const rows = [
      { id: 'sent-2', status: 'sent', public_token: 'token-2' },
      { id: 'draft-3', status: 'draft', public_token: null },
      { id: 'sent-1', status: 'viewed', public_token: 'token-1' },
    ]

    assert.deepEqual(selectCurrentEstimatePublicVersionRows(rows), {
      draftVersion: rows[1],
      sentVersion: rows[0],
      latestVersion: rows[1],
    })
    assert.equal(
      deriveEstimatePublicUrl('https://example.test', 'token-2'),
      'https://example.test/quote/token-2'
    )
  })

  it('classifies the versioned envelope as canonical and old wrapped rows as legacy', () => {
    const canonicalSnapshot = readEstimatePublicPersistedSnapshot({
      artifact_kind: ESTIMATE_PUBLIC_PERSISTED_SNAPSHOT_KIND,
      artifact_version: ESTIMATE_PUBLIC_PERSISTED_SNAPSHOT_VERSION,
      document: buildDocument(),
      draft: { subject: 'Quote ready' },
    })
    const legacySnapshotState = readEstimatePublicPersistedSnapshotState({
      document: buildDocument(),
      draft: { subject: 'Legacy draft' },
    })

    assert.deepEqual(canonicalSnapshot, {
      artifact_kind: ESTIMATE_PUBLIC_PERSISTED_SNAPSHOT_KIND,
      artifact_version: ESTIMATE_PUBLIC_PERSISTED_SNAPSHOT_VERSION,
      document: buildDocument(),
      draft: { subject: 'Quote ready' },
    })
    assert.deepEqual(legacySnapshotState, {
      kind: 'legacy',
      legacy_reason: 'legacy_wrapped_snapshot',
      snapshot: {
        artifact_kind: ESTIMATE_PUBLIC_PERSISTED_SNAPSHOT_KIND,
        artifact_version: ESTIMATE_PUBLIC_PERSISTED_SNAPSHOT_VERSION,
        document: buildDocument(),
        draft: { subject: 'Legacy draft' },
      },
    })
  })
})
