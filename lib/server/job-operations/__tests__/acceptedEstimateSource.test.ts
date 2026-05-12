import assert from 'node:assert/strict'
import { test } from 'vitest'
import {
  buildAcceptedEstimateOperationalSource,
  loadAcceptedEstimateOperationalSource,
} from '../acceptedEstimateSource.ts'
import type { AcceptedEstimateSource } from '@/lib/server/accepted-estimates/types'

type MockQueryResponse = {
  data: Record<string, unknown> | null
  error: { message?: string } | null
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function createReadDb(responses: Record<string, MockQueryResponse>) {
  const calls: Array<{
    table: string
    columns: string
    filters: Record<string, unknown>
  }> = []
  const db = {
    from(table: string) {
      const filters: Record<string, unknown> = {}
      let selectedColumns = ''

      return {
        select(columns: string) {
          selectedColumns = columns
          return this
        },
        eq(column: string, value: unknown) {
          filters[column] = value
          return this
        },
        maybeSingle() {
          calls.push({
            table,
            columns: selectedColumns,
            filters: { ...filters },
          })
          return Promise.resolve(
            responses[table] ?? {
              data: null,
              error: null,
            }
          )
        },
      }
    },
  }

  return { db, calls }
}

function acceptedSource(): AcceptedEstimateSource {
  const publicDocumentSnapshot = {
    artifact_kind: 'customer_estimate_artifact',
    artifact_version: 1,
    document: {
      meta: {
        estimate_id: 'estimate-1',
        version_name: 'Interior repaint',
        version_state: 'live',
        flow_version: 'v2',
        title: 'Accepted quote',
        quote_date: '2026-04-30',
        sent_at: '2026-04-29T09:00:00.000Z',
        viewed_at: '2026-04-29T09:30:00.000Z',
        accepted_at: '2026-04-29T10:00:00.000Z',
        declined_at: null,
        status: 'accepted',
        public_token: 'quote-token-1',
      },
      company: {
        business_name: 'Ace Painting',
        timezone: 'America/Chicago',
        main_phone: '555-0101',
        business_email: 'office@example.test',
        address: '1 Main St',
        website: '',
        sender_signature: '',
        logo_url: '',
      },
      customer: {
        name: 'Jordan Customer',
        email: 'jordan@example.test',
        phone: '555-0102',
        address: '10 Home St',
        street: '10 Home St',
        city: 'Austin',
        state: 'TX',
        zip: '78701',
      },
      intro_paragraph: 'Accepted interior scope.',
      closing_paragraph: '',
      quote_validity_days: 30,
      deposit_language: '',
      card_fee_note: '',
      quote_rows: [],
      scopes: [],
      total: 5100,
      terms: [],
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
          title: true,
          intro_paragraph: true,
          closing_paragraph: false,
          deposit_language: false,
          card_fee_note: false,
        },
      },
      header: {
        company_name: 'Ace Painting',
        contact_lines: [],
        logo_url: '',
        document_label: 'Quote',
        quote_date_label: 'Quote date',
      },
      customer_block: { lines: [] },
      pricing_block: { rows: [], total: 5100, footer_note: '' },
      terms_page: { title: 'Terms', sections: [] },
      assembly_meta: {
        missing_company_fields: [],
        missing_payment_fields: [],
        missing_legal_fields: [],
        used_placeholder_fallbacks: false,
        used_explicit_terms_text: true,
      },
    },
  } as const

  const internalEstimateSnapshot = {
    inputs: {
      rooms: [{ id: 'room-row-1', room_id: 'R001', room_name: 'Kitchen' }],
      room_wall_scopes: [
        {
          id: 'wall-1',
          room_id: 'R001',
          scope_name: 'Kitchen walls',
          paint_product_id: 'paint-1',
          paint_product_label: 'Emerald',
          effective_quantity: 300,
          final_total: 900,
          notes: 'Patch nail holes.',
        },
      ],
      segments: [],
      wall_segments: [],
      ceiling_segments: [],
      room_ceiling_scopes: [],
      ceiling_scope_segments: [],
      room_trim_scopes: [
        {
          id: 'trim-1',
          room_id: 'R001',
          scope_name: 'Kitchen trim',
          paint_product_id: 'paint-2',
          paint_product_label: 'ProClassic',
          final_total: 425,
        },
      ],
      room_door_scopes: [],
      drywall_repairs: [
        {
          id: 'drywall-1',
          room_id: 'R001',
          repair_type: 'patch',
          quantity: 2,
          final_total: 125,
        },
      ],
      access_fees: [],
      prejob: [],
      trim_items: [],
      other: [],
      jobsettings: {},
      org_defaults: {},
    },
    pricing: {
      pricing_summary: { finalTotal: 5100, supplyCost: 225 },
      final_total: 5100,
      wall_calculations: { scopes: [{ id: 'wall-1', effective_quantity: 300 }] },
      ceiling_calculations: { scopes: [] },
      trim_calculations: { scopes: [{ id: 'trim-1' }] },
      door_calculations: { scopes: [] },
      drywall_calculations: { scopes: [{ id: 'drywall-1', effective_quantity: 2 }] },
    },
  }

  return {
    org_id: 'org-1',
    job_id: 'job-1',
    estimate_id: 'estimate-1',
    customer_id: 'customer-1',
    accepted_public_version_id: 'public-version-1',
    public_version_number: 2,
    public_token: 'quote-token-1',
    accepted_at: '2026-04-29T10:00:00.000Z',
    accepted_by_legal_name: 'Jordan Customer',
    signature_type: 'typed',
    user_agent: 'Mozilla/5.0',
    ip: '127.0.0.1',
    version_name: 'Interior repaint',
    version_state: 'live',
    estimate_snapshot_id: 'snapshot-1',
    estimated_labor_hours: 42,
    estimated_paint_gallons: 8.5,
    estimated_supplies_cost: 225,
    estimated_access_cost: 0,
    estimated_other_cost: 0,
    final_total: 5100,
    snapshot_json: clone(publicDocumentSnapshot),
    source_payload_json: {
      artifact_kind: 'accepted_estimate_operational_snapshot_source',
      artifact_version: 1,
      accepted_public_version: {
        id: 'public-version-1',
        version_number: 2,
        public_token: 'quote-token-1',
        accepted_at: '2026-04-29T10:00:00.000Z',
        acceptance_json: {
          legal_name: 'Jordan Customer',
          signature_type: 'typed',
          signature_value: 'Jordan Customer',
          accepted_terms: true,
          accepted_at: '2026-04-29T10:00:00.000Z',
          user_agent: 'Mozilla/5.0',
          ip: '127.0.0.1',
        },
      },
      customer_artifact: clone(publicDocumentSnapshot) as never,
      customer_visible_source: 'customer_artifact.document',
      internal_operational_estimate: clone(internalEstimateSnapshot) as never,
    },
    operational_source: {
      rooms: clone(internalEstimateSnapshot.inputs.rooms),
      room_wall_scopes: clone(internalEstimateSnapshot.inputs.room_wall_scopes),
      room_ceiling_scopes: clone(internalEstimateSnapshot.inputs.room_ceiling_scopes),
      room_trim_scopes: clone(internalEstimateSnapshot.inputs.room_trim_scopes),
      room_door_scopes: clone(internalEstimateSnapshot.inputs.room_door_scopes),
      drywall_repairs: clone(internalEstimateSnapshot.inputs.drywall_repairs),
      access_fees: clone(internalEstimateSnapshot.inputs.access_fees),
      prejob: clone(internalEstimateSnapshot.inputs.prejob),
      pricing_summary: clone(internalEstimateSnapshot.pricing.pricing_summary),
      final_total: 5100,
      wall_calculations: clone(internalEstimateSnapshot.pricing.wall_calculations),
      ceiling_calculations: clone(internalEstimateSnapshot.pricing.ceiling_calculations),
      trim_calculations: clone(internalEstimateSnapshot.pricing.trim_calculations),
      door_calculations: clone(internalEstimateSnapshot.pricing.door_calculations),
      drywall_calculations: clone(internalEstimateSnapshot.pricing.drywall_calculations),
    },
  }
}

test('buildAcceptedEstimateOperationalSource exposes accepted job operations data from one contract', () => {
  const model = buildAcceptedEstimateOperationalSource(acceptedSource(), {
    job: {
      id: 'job-1',
      title: 'Kitchen repaint',
      status: 'scheduled',
      customer_id: 'customer-1',
      linked_estimate_id: 'estimate-1',
    },
    customer: {
      id: 'customer-1',
      name: 'Jordan Customer',
      email: 'latest@example.test',
      phone: '555-0103',
      address: '10 Home St',
    },
  })

  assert.equal(model.job.linked_estimate_id, 'estimate-1')
  assert.equal(model.customer.email, 'latest@example.test')
  assert.equal(model.acceptance.accepted_by_legal_name, 'Jordan Customer')
  assert.equal(model.estimate.estimate_snapshot_id, 'snapshot-1')
  assert.equal(model.publicDocumentSnapshot.document.total, 5100)
  assert.equal(model.internalEstimateSnapshot.pricing.final_total, 5100)
  assert.equal(model.rooms[0]?.room_name, 'Kitchen')
  assert.equal(model.scopes.walls[0]?.final_total, 900)
  assert.deepEqual(
    model.products.map((product) => [product.scope_kind, product.id, product.label]),
    [
      ['walls', 'paint-1', 'Emerald'],
      ['trim', 'paint-2', 'ProClassic'],
    ]
  )
  assert.equal(model.materials.wall_calculations.scopes[0]?.effective_quantity, 300)
  assert.equal(model.totals.accepted_total, 5100)
  assert.equal(model.notes.some((note) => note.text === 'Patch nail holes.'), true)
})

test('loadAcceptedEstimateOperationalSource enriches the accepted source with job and customer records', async () => {
  const source = acceptedSource()
  const { db, calls } = createReadDb({
    jobs: {
      data: {
        id: 'job-1',
        title: 'Current job title',
        status: 'scheduled',
        customer_id: 'customer-1',
        linked_estimate_id: 'estimate-1',
      },
      error: null,
    },
    customers: {
      data: {
        id: 'customer-1',
        name: 'Jordan Customer',
        email: 'current@example.test',
        phone: '555-0104',
        address: '10 Home St',
        street: '10 Home St',
        city: 'Austin',
        state: 'TX',
        zip: '78701',
      },
      error: null,
    },
  })

  const result = await loadAcceptedEstimateOperationalSource(
    { orgId: 'org-1', jobId: 'job-1' },
    {
      db: db as never,
      loadAcceptedEstimateSource: async (_db, orgId, jobId) => {
        assert.equal(orgId, 'org-1')
        assert.equal(jobId, 'job-1')
        return { ok: true, data: source }
      },
    }
  )

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.data.job.title, 'Current job title')
  assert.equal(result.data.customer.email, 'current@example.test')
  assert.equal(result.data.scopes.drywall[0]?.quantity, 2)
  assert.equal(result.data.materials.estimated_paint_gallons, 8.5)
  assert.deepEqual(calls.map((call) => call.table), ['jobs', 'customers'])
})
