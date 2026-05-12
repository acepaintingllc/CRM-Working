import assert from 'node:assert/strict'
import { test } from 'vitest'
import {
  applyAcceptedEstimateSideEffects,
  buildAcceptedEstimateSource,
  buildAcceptedEstimateSourceFromSnapshot,
  buildAcceptedEstimateUpdatePlan,
  loadAcceptedEstimateSource,
  repairAcceptedEstimateSnapshotForJob,
} from '../service.ts'
import {
  buildCustomerSendPersistedSnapshot,
  CUSTOMER_SEND_OPERATIONAL_SNAPSHOT_KIND,
  CUSTOMER_SEND_OPERATIONAL_SNAPSHOT_VERSION,
  type CustomerSendOperationalSnapshot,
} from '@/lib/server/customer-send/types'
import { buildCustomerDocumentFromSendContext } from '@/lib/server/customer-send/document'
import { buildCustomerSendContractContext } from '@/lib/server/customer-send/__tests__/customerSendContractHarness'
import type {
  AcceptedEstimateAccessFeeRow,
  AcceptedEstimateOperationalSourcePayload,
} from '../types.ts'

type MockQueryResponse = {
  data: Record<string, unknown> | null
  error: { message?: string } | null
}

type MockQueryCall = {
  table: string
  columns: string
  filters: Record<string, unknown>
  notFilters?: Array<{ column: string; operator: string; value: unknown }>
  orderBy?: { column: string; ascending: boolean } | null
  limit?: number | null
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function createUpdateResultChain(
  result: MockQueryResponse,
  onUpdate?: (filters: Record<string, unknown>, orFilter: string | null) => void
) {
  const filters: Record<string, unknown> = {}
  let orFilter: string | null = null
  const chain = {
    eq(column: string, value: unknown) {
      filters[column] = value
      return chain
    },
    or(filter: string) {
      orFilter = filter
      return chain
    },
    is(column: string, value: unknown) {
      filters[column] = value
      return chain
    },
    select() {
      return chain
    },
    maybeSingle() {
      onUpdate?.({ ...filters }, orFilter)
      return Promise.resolve(result)
    },
  }
  return chain
}

function createReadDb(responses: Record<string, MockQueryResponse>) {
  const calls: MockQueryCall[] = []
  const db = {
    from(table: string) {
      const filters: Record<string, unknown> = {}
      let selectedColumns = ''
      const notFilters: Array<{ column: string; operator: string; value: unknown }> = []
      let orderBy: { column: string; ascending: boolean } | null = null
      let limit: number | null = null

      return {
        select(columns: string) {
          selectedColumns = columns
          return this
        },
        eq(column: string, value: unknown) {
          filters[column] = value
          return this
        },
        not(column: string, operator: string, value: unknown) {
          notFilters.push({ column, operator, value })
          return this
        },
        order(column: string, options?: { ascending?: boolean }) {
          orderBy = { column, ascending: options?.ascending ?? true }
          return this
        },
        limit(count: number) {
          limit = count
          return this
        },
        maybeSingle() {
          calls.push({
            table,
            columns: selectedColumns,
            filters: { ...filters },
            notFilters: [...notFilters],
            orderBy,
            limit,
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

function createSequentialReadDb(responses: Record<string, MockQueryResponse[]>) {
  const calls: MockQueryCall[] = []
  const db = {
    from(table: string) {
      const filters: Record<string, unknown> = {}
      let selectedColumns = ''
      const notFilters: Array<{ column: string; operator: string; value: unknown }> = []
      let orderBy: { column: string; ascending: boolean } | null = null
      let limit: number | null = null

      return {
        select(columns: string) {
          selectedColumns = columns
          return this
        },
        eq(column: string, value: unknown) {
          filters[column] = value
          return this
        },
        not(column: string, operator: string, value: unknown) {
          notFilters.push({ column, operator, value })
          return this
        },
        order(column: string, options?: { ascending?: boolean }) {
          orderBy = { column, ascending: options?.ascending ?? true }
          return this
        },
        limit(count: number) {
          limit = count
          return this
        },
        maybeSingle() {
          calls.push({
            table,
            columns: selectedColumns,
            filters: { ...filters },
            notFilters: [...notFilters],
            orderBy,
            limit,
          })
          return Promise.resolve(
            responses[table]?.shift() ?? {
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

function customerDraft(overrides: Record<string, unknown> = {}) {
  return {
    to_email: 'taylor@example.test',
    cc_email: '',
    bcc_email: '',
    subject: 'Accepted quote',
    body: 'Please review your accepted quote.',
    template_key: 'default',
    title: 'Accepted Quote',
    intro_paragraph: 'Thanks for reviewing this quote.',
    closing_paragraph: 'Let us know if you have questions.',
    terms_text: 'Standard quote terms.',
    scope_text_edits: {},
    quote_validity_days: 30,
    deposit_language: 'Deposit due on acceptance.',
    card_fee_note: 'Card fee may apply.',
    ...overrides,
  }
}

function persistedAcceptedArtifact(title = 'Accepted Quote') {
  const context = buildCustomerSendContractContext()
  const draft = customerDraft({ title, subject: title })
  const document = buildCustomerDocumentFromSendContext({
    context,
    overrides: {
      title,
      intro_paragraph: draft.intro_paragraph,
      closing_paragraph: draft.closing_paragraph,
      quote_validity_days: draft.quote_validity_days,
      deposit_language: draft.deposit_language,
      card_fee_note: draft.card_fee_note,
    },
  })

  return buildCustomerSendPersistedSnapshot({
    document,
    draft,
  })
}

function acceptedEstimateRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'estimate-1',
    org_id: 'org-1',
    job_id: 'job-1',
    customer_id: 'customer-1',
    version_name: 'Interior repaint',
    version_state: 'live',
    accepted_at: '2026-04-29T10:00:00.000Z',
    accepted_public_version_id: 'public-version-1',
    ...overrides,
  }
}

function acceptedPublicVersionRow(overrides: Record<string, unknown> = {}) {
  const snapshot = clone(persistedAcceptedArtifact('Accepted quote artifact'))

  return {
    id: 'public-version-1',
    estimate_id: 'estimate-1',
    version_number: 3,
    public_token: 'public-token-1',
    status: 'accepted',
    accepted_at: '2026-04-29T10:00:00.000Z',
    acceptance_json: {
      legal_name: 'Jordan Customer',
      signature_type: 'typed',
      signature_value: 'Jordan Customer',
      accepted_at: '2026-04-29T10:00:00.000Z',
      user_agent: 'Mozilla/5.0',
      ip: '127.0.0.1',
    },
    snapshot_json: snapshot,
    ...overrides,
  }
}

function acceptedSnapshotRow(overrides: Record<string, unknown> = {}) {
  const publicVersion = acceptedPublicVersionRow()
  return {
    id: 'snapshot-1',
    org_id: 'org-1',
    job_id: 'job-1',
    estimate_id: 'estimate-1',
    customer_id: 'customer-1',
    accepted_public_version_id: 'public-version-1',
    estimate_version_name: 'Interior repaint',
    estimate_version_state: 'live',
    estimated_labor_hours: 42,
    estimated_paint_gallons: 8.5,
    estimated_supplies_cost: 125,
    estimated_access_cost: 425,
    estimated_other_cost: 30,
    estimated_total: 5100,
    source_payload_json: {
      artifact_kind: 'accepted_estimate_operational_snapshot_source',
      artifact_version: 1,
      customer_artifact: clone(publicVersion.snapshot_json),
      customer_visible_source: 'customer_artifact.document',
      accepted_public_version: clone(publicVersion),
      internal_operational_estimate: {
        inputs: acceptedOperationalInputs({
          rooms: [{ id: 'room-row-1', room_id: 'R001', room_name: 'Kitchen' }],
          access_fees: [
            {
              id: 'access-job-1',
              room_id: null,
              access_fee_id: 'catalog-scaffold',
              label: 'Job-level scaffold setup',
              display_name: 'Scaffold setup',
              access_group: 'scaffolding',
              qty: 1,
              amount: 300,
              catalog_amount: 300,
              actual_cost_override: null,
              calculated_total: 300,
              effective_total: 300,
              final_total: 300,
              override_total: null,
              overridden: false,
              notes: 'Shared job access.',
              position: 1,
            },
            {
              id: 'access-room-1',
              room_id: 'R001',
              access_fee_id: 'catalog-ladder',
              label: 'Kitchen ladder work',
              display_name: 'Kitchen ladder work',
              access_group: 'ladders',
              qty: 2,
              amount: 75,
              catalog_amount: 75,
              actual_cost_override: 125,
              calculated_total: 150,
              effective_total: 125,
              final_total: 125,
              override_total: 125,
              overridden: true,
              notes: 'Room-specific access.',
              position: 2,
            },
          ],
          prejob: [{ id: 'prejob-1', trip_name: 'Wallpaper removal prep' }],
        }),
        pricing: acceptedOperationalPricing(artifactTotal(publicVersion.snapshot_json)),
      },
    },
    ...overrides,
  }
}

function artifactTotal(snapshot: unknown) {
  return (snapshot as { document: { total: number } }).document.total
}

function acceptedOperationalInputs(overrides: Record<string, unknown> = {}) {
  return {
    rooms: [],
    room_wall_scopes: [],
    segments: [],
    wall_segments: [],
    ceiling_segments: [],
    room_ceiling_scopes: [],
    ceiling_scope_segments: [],
    room_trim_scopes: [],
    room_door_scopes: [],
    drywall_repairs: [],
    access_fees: [],
    prejob: [],
    trim_items: [],
    other: [],
    jobsettings: {},
    org_defaults: {
      default_template_key: 'default',
      quote_validity_days: 30,
      terms_text: 'Standard quote terms.',
      walls_paint_id: null,
      walls_primer_id: null,
      ceiling_paint_id: null,
      ceiling_primer_id: null,
      trim_paint_id: null,
      trim_primer_id: null,
      labor_day_policy_enabled: true,
      dayhours: 8,
      rounding_increment_hours: 4,
      override_labor_rate: 0,
      job_minimum_enabled: false,
      job_minimum_amount: 0,
      standard_door_deduction_sf: 21,
      standard_window_deduction_sf: 15,
      baseboard_opening_deduction_lf: 3,
    },
    ...overrides,
  }
}

function acceptedOperationalPricing(finalTotal: number) {
  return {
    pricing_summary: { finalTotal },
    final_total: finalTotal,
    wall_calculations: { scopes: [] },
    ceiling_calculations: { scopes: [] },
    trim_calculations: { scopes: [] },
    door_calculations: { scopes: [] },
    drywall_calculations: { scopes: [] },
  }
}

function fullOperationalInputs() {
  return acceptedOperationalInputs({
    rooms: [{ id: 'room-row-1', room_id: 'R001', room_name: 'Kitchen' }],
    room_wall_scopes: [{ id: 'wall-1', room_id: 'R001', scope_name: 'Kitchen walls', final_total: 900 }],
    room_ceiling_scopes: [{ id: 'ceiling-1', room_id: 'R001', scope_name: 'Kitchen ceiling', final_total: 300 }],
    room_trim_scopes: [{ id: 'trim-1', room_id: 'R001', scope_name: 'Kitchen trim', final_total: 425 }],
    room_door_scopes: [{ id: 'door-1', room_id: 'R001', scope_name: 'Kitchen door', final_total: 175 }],
    drywall_repairs: [{ id: 'drywall-1', room_id: 'R001', repair_type: 'patch', final_total: 125 }],
    access_fees: [
      {
        id: 'access-job-1',
        room_id: null,
        access_fee_id: 'catalog-scaffold',
        label: 'Job-level scaffold setup',
        display_name: 'Scaffold setup',
        access_group: 'scaffolding',
        qty: 1,
        amount: 300,
        catalog_amount: 300,
        actual_cost_override: null,
        calculated_total: 300,
        effective_total: 300,
        final_total: 300,
        override_total: null,
        overridden: false,
        notes: 'Shared job access.',
        position: 1,
      },
      {
        id: 'access-room-1',
        room_id: 'R001',
        access_fee_id: 'catalog-ladder',
        label: 'Kitchen ladder work',
        display_name: 'Kitchen ladder work',
        access_group: 'ladders',
        qty: 2,
        amount: 75,
        catalog_amount: 75,
        actual_cost_override: 125,
        calculated_total: 150,
        effective_total: 125,
        final_total: 125,
        override_total: 125,
        overridden: true,
        notes: 'Room-specific access.',
        position: 2,
      },
    ],
    prejob: [{ id: 'prejob-1', room_id: 'R001', trip_name: 'Wallpaper removal prep', final_total: 250 }],
  })
}

function fullOperationalPricing(finalTotal: number) {
  return {
    pricing_summary: { finalTotal, effectiveLaborHours: 24, prepTripCost: 250 },
    final_total: finalTotal,
    wall_calculations: { scopes: [{ id: 'wall-1', effective_total: 900 }] },
    ceiling_calculations: { scopes: [{ id: 'ceiling-1', effective_total: 300 }] },
    trim_calculations: { scopes: [{ id: 'trim-1', effective_total: 425 }] },
    door_calculations: { scopes: [{ id: 'door-1', effective_total: 175 }] },
    drywall_calculations: { scopes: [{ id: 'drywall-1', effective_total: 125 }] },
  }
}

test('buildAcceptedEstimateUpdatePlan links the accepted estimate to its job', () => {
  const plan = buildAcceptedEstimateUpdatePlan({
    orgId: 'org-1',
    jobId: 'job-1',
    estimateId: 'estimate-1',
    publicVersionId: 'public-version-1',
    acceptedAt: '2026-04-29T10:00:00.000Z',
  })

  assert.deepEqual(plan.estimateUpdate, {
    accepted_at: '2026-04-29T10:00:00.000Z',
    accepted_public_version_id: 'public-version-1',
    version_state: 'live',
  })
  assert.deepEqual(plan.jobUpdate, {
    linked_estimate_id: 'estimate-1',
  })
})

test('buildAcceptedEstimateSource still normalizes live accepted version records for repair inputs', () => {
  const publicVersion = acceptedPublicVersionRow()
  const source = buildAcceptedEstimateSource({
    estimate: acceptedEstimateRow(),
    publicVersion,
    rollup: {
      final_total: 4250,
    },
  })

  assert.equal(source.final_total, artifactTotal(publicVersion.snapshot_json))
  assert.equal(source.estimate_snapshot_id, null)
  assert.equal(source.estimated_access_cost, 0)
  assert.deepEqual(source.snapshot_json, publicVersion.snapshot_json)
  assert.deepEqual(source.source_payload_json, {})
})

test('buildAcceptedEstimateSourceFromSnapshot uses the canonical embedded accepted artifact', () => {
  const sourcePayload = {
    artifact_kind: 'accepted_estimate_operational_snapshot_source' as const,
    artifact_version: 1 as const,
    customer_artifact: clone(persistedAcceptedArtifact('Accepted snapshot title')),
    accepted_public_version: clone(
      acceptedPublicVersionRow({
        snapshot_json: clone(persistedAcceptedArtifact('Mutated public version title')),
      })
    ),
    internal_operational_estimate: {
      inputs: acceptedOperationalInputs({ rooms: [{ room_id: 'R001' }] }),
      pricing: acceptedOperationalPricing(5100),
    },
  }
  const source = buildAcceptedEstimateSourceFromSnapshot({
    estimate: acceptedEstimateRow({ version_name: 'Mutable live version name' }),
    snapshot: acceptedSnapshotRow({
      source_payload_json: sourcePayload,
    }),
    artifactState: {
      kind: 'canonical',
      artifact: clone(persistedAcceptedArtifact('Accepted snapshot title')),
      source_payload: sourcePayload,
      operational_source: {
        rooms: [{ room_id: 'R001' }],
        room_wall_scopes: [],
        room_ceiling_scopes: [],
        room_trim_scopes: [],
        room_door_scopes: [],
        drywall_repairs: [],
        access_fees: [],
        prejob: [],
        pricing_summary: { finalTotal: 5100 },
        final_total: 5100,
        wall_calculations: { scopes: [] },
        ceiling_calculations: { scopes: [] },
        trim_calculations: { scopes: [] },
        door_calculations: { scopes: [] },
        drywall_calculations: { scopes: [] },
      },
      accepted_public_version: clone(
        acceptedPublicVersionRow({
          snapshot_json: clone(persistedAcceptedArtifact('Mutated public version title')),
        })
      ),
    },
  })

  assert.equal(source.public_version_number, 3)
  assert.equal(source.public_token, 'public-token-1')
  assert.equal(source.estimated_access_cost, 425)
  assert.equal(source.final_total, persistedAcceptedArtifact('Accepted snapshot title').document.total)
  assert.deepEqual(source.snapshot_json, persistedAcceptedArtifact('Accepted snapshot title'))
  assert.equal(
    source.source_payload_json.artifact_kind,
    'accepted_estimate_operational_snapshot_source'
  )
})

test('applyAcceptedEstimateSideEffects updates estimates first, then links the accepted estimate to its job', async () => {
  const calls: Array<{
    table: string
    payload: Record<string, unknown>
    filters: Record<string, unknown>
    orFilter: string | null
  }> = []
  const db = {
    from(table: string) {
      return {
        update(payload: Record<string, unknown>) {
          return createUpdateResultChain(
            { data: { id: `${table}-updated` }, error: null },
            (filters, orFilter) => calls.push({ table, payload, filters, orFilter })
          )
        },
      }
    },
  }

  const result = await applyAcceptedEstimateSideEffects(db as never, {
    orgId: 'org-1',
    jobId: 'job-1',
    estimateId: 'estimate-1',
    publicVersionId: 'public-version-1',
    acceptedAt: '2026-04-29T10:00:00.000Z',
  })

  assert.equal(result.ok, true)
  assert.deepEqual(calls.map((call) => call.table), ['estimates', 'jobs'])
})

test('loadAcceptedEstimateSource reads the canonical embedded accepted artifact', async () => {
  const { db, calls } = createReadDb({
    jobs: {
      data: {
        id: 'job-1',
        linked_estimate_id: 'estimate-1',
      },
      error: null,
    },
    estimates: {
      data: acceptedEstimateRow(),
      error: null,
    },
    estimate_snapshot: {
      data: acceptedSnapshotRow(),
      error: null,
    },
  })

  const result = await loadAcceptedEstimateSource(db as never, 'org-1', 'job-1')

  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.data.estimate_snapshot_id, 'snapshot-1')
    assert.equal(result.data.estimated_access_cost, 425)
    assert.equal(result.data.final_total, artifactTotal(acceptedPublicVersionRow().snapshot_json))
    assert.deepEqual(result.data.snapshot_json, acceptedPublicVersionRow().snapshot_json)
    assert.deepEqual(
      result.data.source_payload_json,
      acceptedSnapshotRow().source_payload_json
    )
    assert.deepEqual(
      result.data.operational_source.access_fees,
      (
        acceptedSnapshotRow().source_payload_json as AcceptedEstimateOperationalSourcePayload
      ).internal_operational_estimate.inputs.access_fees
    )
  }
  const snapshotCall = calls.find((call) => call.table === 'estimate_snapshot')
  assert.ok(snapshotCall?.columns.includes('estimated_access_cost'))
})

test('loadAcceptedEstimateSource exposes every invoice and work-order operational row through typed source', async () => {
  const acceptedArtifact = persistedAcceptedArtifact('Accepted full operational source')
  const sourcePayload = {
    artifact_kind: 'accepted_estimate_operational_snapshot_source',
    artifact_version: 1,
    customer_artifact: clone(acceptedArtifact),
    accepted_public_version: clone(
      acceptedPublicVersionRow({
        snapshot_json: clone(acceptedArtifact),
      })
    ),
    internal_operational_estimate: {
      inputs: fullOperationalInputs(),
      pricing: fullOperationalPricing(artifactTotal(acceptedArtifact)),
    },
  } satisfies AcceptedEstimateOperationalSourcePayload
  const { db } = createReadDb({
    jobs: {
      data: {
        id: 'job-1',
        linked_estimate_id: 'estimate-1',
      },
      error: null,
    },
    estimates: {
      data: acceptedEstimateRow(),
      error: null,
    },
    estimate_snapshot: {
      data: acceptedSnapshotRow({
        source_payload_json: sourcePayload,
      }),
      error: null,
    },
  })

  const result = await loadAcceptedEstimateSource(db as never, 'org-1', 'job-1')

  assert.equal(result.ok, true)
  if (!result.ok) return

  const source = result.data.operational_source
  const inputs = sourcePayload.internal_operational_estimate.inputs
  const pricing = sourcePayload.internal_operational_estimate.pricing
  assert.deepEqual(source.rooms, inputs.rooms)
  assert.deepEqual(source.room_wall_scopes, inputs.room_wall_scopes)
  assert.deepEqual(source.room_ceiling_scopes, inputs.room_ceiling_scopes)
  assert.deepEqual(source.room_trim_scopes, inputs.room_trim_scopes)
  assert.deepEqual(source.room_door_scopes, inputs.room_door_scopes)
  assert.deepEqual(source.drywall_repairs, inputs.drywall_repairs)
  assert.deepEqual(source.access_fees, inputs.access_fees)
  assert.deepEqual(source.prejob, inputs.prejob)
  assert.deepEqual(source.pricing_summary, pricing.pricing_summary)
  assert.deepEqual(source.wall_calculations, pricing.wall_calculations)
  assert.deepEqual(source.ceiling_calculations, pricing.ceiling_calculations)
  assert.deepEqual(source.trim_calculations, pricing.trim_calculations)
  assert.deepEqual(source.door_calculations, pricing.door_calculations)
  assert.deepEqual(source.drywall_calculations, pricing.drywall_calculations)
  const acceptedAccessRows: AcceptedEstimateAccessFeeRow[] = source.access_fees
  assert.equal(acceptedAccessRows[0]?.room_id, null)
  assert.equal(acceptedAccessRows[1]?.room_id, 'R001')
  assert.equal(acceptedAccessRows[0]?.display_name, 'Scaffold setup')
  assert.equal(acceptedAccessRows[1]?.access_fee_id, 'catalog-ladder')
  assert.equal(acceptedAccessRows[1]?.amount, 75)
  assert.equal(acceptedAccessRows[1]?.actual_cost_override, 125)
  assert.equal(acceptedAccessRows[1]?.calculated_total, 150)
  assert.equal(acceptedAccessRows[1]?.effective_total, 125)
  assert.equal(acceptedAccessRows[1]?.final_total, 125)
  assert.equal(acceptedAccessRows[1]?.override_total, 125)
  assert.equal(acceptedAccessRows[1]?.overridden, true)
  assert.deepEqual(source.access_fees, [
    {
      id: 'access-job-1',
      room_id: null,
      access_fee_id: 'catalog-scaffold',
      label: 'Job-level scaffold setup',
      display_name: 'Scaffold setup',
      access_group: 'scaffolding',
      qty: 1,
      amount: 300,
      catalog_amount: 300,
      actual_cost_override: null,
      calculated_total: 300,
      effective_total: 300,
      final_total: 300,
      override_total: null,
      overridden: false,
      notes: 'Shared job access.',
      position: 1,
    },
    {
      id: 'access-room-1',
      room_id: 'R001',
      access_fee_id: 'catalog-ladder',
      label: 'Kitchen ladder work',
      display_name: 'Kitchen ladder work',
      access_group: 'ladders',
      qty: 2,
      amount: 75,
      catalog_amount: 75,
      actual_cost_override: 125,
      calculated_total: 150,
      effective_total: 125,
      final_total: 125,
      override_total: 125,
      overridden: true,
      notes: 'Room-specific access.',
      position: 2,
    },
  ])
})

test('loadAcceptedEstimateSource exposes typed access fees and prejob from immutable snapshot source', async () => {
  const acceptedArtifact = clone(persistedAcceptedArtifact('Accepted typed operational rows'))
  acceptedArtifact.document.total = 600
  acceptedArtifact.document.pricing_block.total = 600
  const accessFees = [
    {
      id: 'access-job-1',
      room_id: null,
      access_fee_id: 'catalog-scaffold',
      label: 'Job-level scaffold setup',
      display_name: 'Scaffold setup',
      access_group: 'scaffolding',
      qty: 1,
      amount: 300,
      catalog_amount: 300,
      actual_cost_override: null,
      calculated_total: 300,
      effective_total: 300,
      final_total: 300,
      override_total: null,
      overridden: false,
      notes: 'Shared job access.',
      position: 1,
    },
    {
      id: 'access-room-1',
      room_id: 'R001',
      access_fee_id: 'catalog-ladder',
      label: 'Kitchen ladder work',
      display_name: 'Kitchen ladder work',
      access_group: 'ladders',
      qty: 2,
      amount: 75,
      catalog_amount: 75,
      actual_cost_override: 125,
      calculated_total: 150,
      effective_total: 125,
      final_total: 125,
      override_total: 125,
      overridden: true,
      notes: 'Room-specific access.',
      position: 2,
    },
  ]
  const prejob = [
    {
      id: 'prejob-1',
      room_id: 'R001',
      trip_name: 'Wallpaper removal prep',
      trip_num: 2,
      trip_rate: 75,
      calculated_total: 150,
      raw_total: 175,
      effective_total: 175,
      final_total: 175,
    },
  ]
  const sourcePayload = {
    artifact_kind: 'accepted_estimate_operational_snapshot_source',
    artifact_version: 1,
    customer_artifact: clone(acceptedArtifact),
    accepted_public_version: clone(
      acceptedPublicVersionRow({
        snapshot_json: clone(acceptedArtifact),
      })
    ),
    internal_operational_estimate: {
      inputs: acceptedOperationalInputs({
        rooms: [{ room_id: 'R001', room_name: 'Kitchen' }],
        access_fees: accessFees,
        prejob,
      }),
      pricing: {
        pricing_summary: {
          finalTotal: 600,
          sharedAccessCost: 425,
          prepTripCost: 175,
        },
        final_total: 600,
        wall_calculations: { scopes: [] },
        ceiling_calculations: { scopes: [] },
        trim_calculations: { scopes: [] },
        door_calculations: { scopes: [] },
        drywall_calculations: { scopes: [] },
      },
    },
  } satisfies AcceptedEstimateOperationalSourcePayload
  const { db } = createReadDb({
    jobs: {
      data: {
        id: 'job-1',
        linked_estimate_id: 'estimate-1',
      },
      error: null,
    },
    estimates: {
      data: acceptedEstimateRow(),
      error: null,
    },
    estimate_snapshot: {
      data: acceptedSnapshotRow({
        source_payload_json: sourcePayload,
      }),
      error: null,
    },
  })

  const result = await loadAcceptedEstimateSource(db as never, 'org-1', 'job-1')

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(result.data.operational_source.access_fees, accessFees)
  assert.equal(result.data.operational_source.access_fees[0]?.room_id, null)
  assert.equal(result.data.operational_source.access_fees[1]?.overridden, true)
  assert.deepEqual(result.data.operational_source.prejob, prejob)
  assert.equal(result.data.operational_source.pricing_summary.finalTotal, 600)
  assert.equal(result.data.operational_source.final_total, 600)
})

test('loadAcceptedEstimateSource preserves operational prejob rows from the customer artifact source payload', async () => {
  const context = buildCustomerSendContractContext()
  context.inputs.prejob = [
    {
      id: 'prejob-canonical-1',
      room_id: 'room-1',
      include: 'Y',
      trip_name: 'Customer walkthrough prep',
      trip_num: 1,
      trip_rate: 225,
      manual_adjustment: 25,
      calculated_total: 225,
      raw_total: 225,
      effective_total: 250,
      final_total: 250,
      notes: 'Accepted source should preserve this canonical calculated row.',
    },
  ]

  const draft = customerDraft()
  const document = buildCustomerDocumentFromSendContext({
    context,
    overrides: {
      title: draft.title,
      intro_paragraph: draft.intro_paragraph,
      closing_paragraph: draft.closing_paragraph,
      quote_validity_days: draft.quote_validity_days,
      deposit_language: draft.deposit_language,
      card_fee_note: draft.card_fee_note,
    },
  })
  const operationalSnapshot = {
    artifact_kind: CUSTOMER_SEND_OPERATIONAL_SNAPSHOT_KIND,
    artifact_version: CUSTOMER_SEND_OPERATIONAL_SNAPSHOT_VERSION,
    source_estimate_updated_at: context.estimate.updated_at ?? '',
    estimate_response: {
      estimate: context.estimate,
      inputs: context.inputs,
      wall_calculations: { scopes: [] },
      ceiling_calculations: { scopes: [] },
      trim_calculations: { scopes: [] },
      door_calculations: { scopes: [] },
      drywall_calculations: { scopes: [] },
      pricing_summary: { finalTotal: 250, prepTripCost: 250 },
    },
  } satisfies CustomerSendOperationalSnapshot
  const customerArtifact = buildCustomerSendPersistedSnapshot({
    document,
    draft,
    operationalSnapshot,
  })
  const acceptedPublicVersion = acceptedPublicVersionRow({
    snapshot_json: clone(customerArtifact),
  })
  const sourcePayload = {
    artifact_kind: 'accepted_estimate_operational_snapshot_source',
    artifact_version: 1,
    customer_artifact: clone(customerArtifact),
    accepted_public_version: clone(acceptedPublicVersion),
    internal_operational_estimate: {
      inputs: clone(operationalSnapshot.estimate_response.inputs),
      pricing: {
        pricing_summary: clone(operationalSnapshot.estimate_response.pricing_summary),
        final_total: 250,
        wall_calculations: { scopes: [] },
        ceiling_calculations: { scopes: [] },
        trim_calculations: { scopes: [] },
        door_calculations: { scopes: [] },
        drywall_calculations: { scopes: [] },
      },
    },
  } satisfies AcceptedEstimateOperationalSourcePayload
  const { db } = createReadDb({
    jobs: {
      data: {
        id: 'job-1',
        linked_estimate_id: 'estimate-1',
      },
      error: null,
    },
    estimates: {
      data: acceptedEstimateRow(),
      error: null,
    },
    estimate_snapshot: {
      data: acceptedSnapshotRow({
        estimated_total: 250,
        source_payload_json: sourcePayload,
      }),
      error: null,
    },
  })

  const result = await loadAcceptedEstimateSource(db as never, 'org-1', 'job-1')

  assert.equal(result.ok, true)
  if (result.ok) {
    const resultSource =
      result.data.source_payload_json as AcceptedEstimateOperationalSourcePayload
    const artifactOperational =
      customerArtifact.operational_snapshot as CustomerSendOperationalSnapshot
    assert.deepEqual(
      resultSource.internal_operational_estimate.inputs.prejob,
      artifactOperational.estimate_response.inputs.prejob
    )
    assert.deepEqual(
      result.data.operational_source.prejob,
      artifactOperational.estimate_response.inputs.prejob
    )
  }
})

test('loadAcceptedEstimateSource exposes artifact total even when snapshot estimated_total drifted', async () => {
  const acceptedArtifact = persistedAcceptedArtifact('Accepted drift-proof artifact')
  const { db } = createReadDb({
    jobs: {
      data: {
        id: 'job-1',
        linked_estimate_id: 'estimate-1',
      },
      error: null,
    },
    estimates: {
      data: acceptedEstimateRow(),
      error: null,
    },
    estimate_snapshot: {
      data: acceptedSnapshotRow({
        estimated_total: 99_999,
        source_payload_json: {
          artifact_kind: 'accepted_estimate_operational_snapshot_source',
          artifact_version: 1,
          customer_artifact: clone(acceptedArtifact),
          accepted_public_version: clone(
            acceptedPublicVersionRow({
              snapshot_json: clone(persistedAcceptedArtifact('Mutated public version title')),
            })
          ),
          internal_operational_estimate: {
            inputs: acceptedOperationalInputs({ rooms: [{ room_id: 'R001' }] }),
            pricing: acceptedOperationalPricing(artifactTotal(acceptedArtifact)),
          },
        },
      }),
      error: null,
    },
  })

  const result = await loadAcceptedEstimateSource(db as never, 'org-1', 'job-1')

  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.data.final_total, acceptedArtifact.document.total)
    assert.deepEqual(result.data.snapshot_json, acceptedArtifact)
  }
})

test('loadAcceptedEstimateSource returns an immutable operational source clone', async () => {
  const snapshot = acceptedSnapshotRow()
  const { db } = createReadDb({
    jobs: {
      data: {
        id: 'job-1',
        linked_estimate_id: 'estimate-1',
      },
      error: null,
    },
    estimates: {
      data: acceptedEstimateRow(),
      error: null,
    },
    estimate_snapshot: {
      data: snapshot,
      error: null,
    },
  })

  const result = await loadAcceptedEstimateSource(db as never, 'org-1', 'job-1')

  assert.equal(result.ok, true)
  if (result.ok) {
    ;(
      snapshot.source_payload_json.internal_operational_estimate as {
        inputs: {
          rooms: Array<{ room_name: string }>
          access_fees: Array<{ effective_total: number }>
        }
      }
    ).inputs.rooms[0].room_name = 'Live mutation'
    ;(
      snapshot.source_payload_json.internal_operational_estimate as {
        inputs: {
          rooms: Array<{ room_name: string }>
          access_fees: Array<{ effective_total: number }>
        }
      }
    ).inputs.access_fees[1].effective_total = 999
    assert.equal(
      (
        result.data.source_payload_json.internal_operational_estimate as {
          inputs: { rooms: Array<{ room_name: string }> }
        }
      ).inputs.rooms[0].room_name,
      'Kitchen'
    )
    assert.equal(result.data.operational_source.access_fees[1]?.effective_total, 125)
  }
})

test('loadAcceptedEstimateSource fails closed when the accepted snapshot is missing', async () => {
  const { db } = createReadDb({
    jobs: {
      data: {
        id: 'job-1',
        linked_estimate_id: 'estimate-1',
      },
      error: null,
    },
    estimates: {
      data: acceptedEstimateRow(),
      error: null,
    },
    estimate_snapshot: {
      data: null,
      error: null,
    },
  })

  const result = await loadAcceptedEstimateSource(db as never, 'org-1', 'job-1')

  assert.deepEqual(result, {
    ok: false,
    kind: 'invalid_input',
    message:
      'Accepted estimate snapshot is missing. Repair the snapshot before loading accepted estimate data.',
  })
})

test('loadAcceptedEstimateSource fails closed when the embedded accepted artifact is missing', async () => {
  const { db } = createReadDb({
    jobs: {
      data: {
        id: 'job-1',
        linked_estimate_id: 'estimate-1',
      },
      error: null,
    },
    estimates: {
      data: acceptedEstimateRow(),
      error: null,
    },
    estimate_snapshot: {
      data: acceptedSnapshotRow({
        source_payload_json: {
          accepted_public_version: clone(acceptedPublicVersionRow()),
        },
      }),
      error: null,
    },
  })

  const result = await loadAcceptedEstimateSource(db as never, 'org-1', 'job-1')

  assert.deepEqual(result, {
    ok: false,
    kind: 'invalid_input',
    message:
      'Accepted estimate snapshot customer artifact is missing. Repair the snapshot before loading accepted estimate data.',
  })
})

test('loadAcceptedEstimateSource fails closed when the embedded accepted artifact is unreadable', async () => {
  const { db } = createReadDb({
    jobs: {
      data: {
        id: 'job-1',
        linked_estimate_id: 'estimate-1',
      },
      error: null,
    },
    estimates: {
      data: acceptedEstimateRow(),
      error: null,
    },
    estimate_snapshot: {
      data: acceptedSnapshotRow({
        source_payload_json: {
          customer_artifact: { document: { title: 'corrupt' } },
          accepted_public_version: clone(acceptedPublicVersionRow()),
        },
      }),
      error: null,
    },
  })

  const result = await loadAcceptedEstimateSource(db as never, 'org-1', 'job-1')

  assert.deepEqual(result, {
    ok: false,
    kind: 'invalid_input',
    message:
      'Accepted estimate snapshot customer artifact is unreadable. Repair the snapshot before loading accepted estimate data.',
  })
})

test('loadAcceptedEstimateSource fails closed when the embedded accepted snapshot payload is legacy-only', async () => {
  const { db } = createReadDb({
    jobs: {
      data: {
        id: 'job-1',
        linked_estimate_id: 'estimate-1',
      },
      error: null,
    },
    estimates: {
      data: acceptedEstimateRow(),
      error: null,
    },
    estimate_snapshot: {
      data: acceptedSnapshotRow({
        source_payload_json: {
          customer_send_snapshot_json: clone(persistedAcceptedArtifact('Accepted snapshot title')),
        },
      }),
      error: null,
    },
  })

  const result = await loadAcceptedEstimateSource(db as never, 'org-1', 'job-1')

  assert.deepEqual(result, {
    ok: false,
    kind: 'invalid_input',
    message:
      'Accepted estimate snapshot payload is legacy. Repair the snapshot before loading accepted estimate data.',
  })
})

test('loadAcceptedEstimateSource fails closed when the operational source contract is missing', async () => {
  const { db } = createReadDb({
    jobs: {
      data: {
        id: 'job-1',
        linked_estimate_id: 'estimate-1',
      },
      error: null,
    },
    estimates: {
      data: acceptedEstimateRow(),
      error: null,
    },
    estimate_snapshot: {
      data: acceptedSnapshotRow({
        source_payload_json: {
          customer_artifact: clone(persistedAcceptedArtifact('Accepted snapshot title')),
          accepted_public_version: clone(acceptedPublicVersionRow()),
        },
      }),
      error: null,
    },
  })

  const result = await loadAcceptedEstimateSource(db as never, 'org-1', 'job-1')

  assert.deepEqual(result, {
    ok: false,
    kind: 'invalid_input',
    message:
      'Accepted estimate snapshot operational source payload is missing or incomplete. Repair the snapshot before loading accepted estimate data.',
  })
})

test('loadAcceptedEstimateSource fails closed when a required operational array is missing', async () => {
  const sourcePayload = clone(
    acceptedSnapshotRow().source_payload_json
  ) as AcceptedEstimateOperationalSourcePayload
  delete (
    sourcePayload.internal_operational_estimate.inputs as Record<string, unknown>
  ).access_fees
  const { db } = createReadDb({
    jobs: {
      data: {
        id: 'job-1',
        linked_estimate_id: 'estimate-1',
      },
      error: null,
    },
    estimates: {
      data: acceptedEstimateRow(),
      error: null,
    },
    estimate_snapshot: {
      data: acceptedSnapshotRow({
        source_payload_json: sourcePayload,
      }),
      error: null,
    },
  })

  const result = await loadAcceptedEstimateSource(db as never, 'org-1', 'job-1')

  assert.deepEqual(result, {
    ok: false,
    kind: 'invalid_input',
    message:
      'Accepted estimate snapshot operational source payload is missing or incomplete. Repair the snapshot before loading accepted estimate data.',
  })
})

test('loadAcceptedEstimateSource fails closed when a required operational pricing object is missing', async () => {
  const sourcePayload = clone(
    acceptedSnapshotRow().source_payload_json
  ) as AcceptedEstimateOperationalSourcePayload
  delete (
    sourcePayload.internal_operational_estimate.pricing as Record<string, unknown>
  ).wall_calculations
  const { db } = createReadDb({
    jobs: {
      data: {
        id: 'job-1',
        linked_estimate_id: 'estimate-1',
      },
      error: null,
    },
    estimates: {
      data: acceptedEstimateRow(),
      error: null,
    },
    estimate_snapshot: {
      data: acceptedSnapshotRow({
        source_payload_json: sourcePayload,
      }),
      error: null,
    },
  })

  const result = await loadAcceptedEstimateSource(db as never, 'org-1', 'job-1')

  assert.deepEqual(result, {
    ok: false,
    kind: 'invalid_input',
    message:
      'Accepted estimate snapshot operational source payload is missing or incomplete. Repair the snapshot before loading accepted estimate data.',
  })
})

test('loadAcceptedEstimateSource still allows legacy accepted-job resolution when the canonical snapshot exists', async () => {
  const { db, calls } = createReadDb({
    jobs: {
      data: {
        id: 'job-legacy',
        linked_estimate_id: null,
      },
      error: null,
    },
    estimates: {
      data: acceptedEstimateRow({
        id: 'legacy-estimate-1',
        job_id: 'job-legacy',
        accepted_public_version_id: 'public-version-legacy-1',
      }),
      error: null,
    },
    estimate_snapshot: {
      data: acceptedSnapshotRow({
        id: 'snapshot-legacy-1',
        job_id: 'job-legacy',
        estimate_id: 'legacy-estimate-1',
        accepted_public_version_id: 'public-version-legacy-1',
      }),
      error: null,
    },
  })

  const result = await loadAcceptedEstimateSource(db as never, 'org-1', 'job-legacy')

  assert.equal(result.ok, true)
  assert.equal(calls[0]?.table, 'jobs')
  assert.equal(calls[1]?.table, 'estimates')
})

test('repairAcceptedEstimateSnapshotForJob creates a missing accepted snapshot and reuses it on reload', async () => {
  const { db, calls } = createSequentialReadDb({
    jobs: [
      {
        data: {
          id: 'job-1',
          linked_estimate_id: 'estimate-1',
        },
        error: null,
      },
      {
        data: {
          id: 'job-1',
          linked_estimate_id: 'estimate-1',
        },
        error: null,
      },
      {
        data: {
          id: 'job-1',
          linked_estimate_id: 'estimate-1',
        },
        error: null,
      },
    ],
    estimates: [
      {
        data: acceptedEstimateRow(),
        error: null,
      },
      {
        data: acceptedEstimateRow(),
        error: null,
      },
      {
        data: acceptedEstimateRow(),
        error: null,
      },
    ],
    estimate_snapshot: [
      {
        data: null,
        error: null,
      },
      {
        data: acceptedSnapshotRow(),
        error: null,
      },
    ],
  })

  let ensureCalled = 0
  const result = await repairAcceptedEstimateSnapshotForJob(
    {
      requestOrigin: 'http://localhost',
      orgId: 'org-1',
      userId: 'user-1',
      jobId: 'job-1',
    },
    {
      db: db as never,
      ensureSnapshot: async (input) => {
        ensureCalled += 1
        assert.deepEqual(input, {
          requestOrigin: 'http://localhost',
          orgId: 'org-1',
          userId: 'user-1',
          estimateId: 'estimate-1',
          publicVersionId: 'public-version-1',
        })
        return {
          ok: true as const,
          data: { id: 'snapshot-1' },
        }
      },
    }
  )

  assert.equal(result.ok, true)
  assert.equal(ensureCalled, 1)
  assert.equal(calls.filter((call) => call.table === 'estimate_snapshot').length, 2)
})

test('repairAcceptedEstimateSnapshotForJob returns an existing canonical snapshot without repairing', async () => {
  const { db } = createReadDb({
    jobs: {
      data: {
        id: 'job-1',
        linked_estimate_id: 'estimate-1',
      },
      error: null,
    },
    estimates: {
      data: acceptedEstimateRow(),
      error: null,
    },
    estimate_snapshot: {
      data: acceptedSnapshotRow(),
      error: null,
    },
  })

  let ensureCalled = 0
  const result = await repairAcceptedEstimateSnapshotForJob(
    {
      requestOrigin: 'http://localhost',
      orgId: 'org-1',
      userId: 'user-1',
      jobId: 'job-1',
    },
    {
      db: db as never,
      ensureSnapshot: async () => {
        ensureCalled += 1
        return {
          ok: true as const,
          data: { id: 'snapshot-1' },
        }
      },
    }
  )

  assert.equal(result.ok, true)
  assert.equal(ensureCalled, 0)
})

test('repairAcceptedEstimateSnapshotForJob fails closed for legacy snapshots because snapshot rows are immutable', async () => {
  const { db } = createSequentialReadDb({
    jobs: [
      {
        data: {
          id: 'job-1',
          linked_estimate_id: 'estimate-1',
        },
        error: null,
      },
    ],
    estimates: [
      {
        data: acceptedEstimateRow(),
        error: null,
      },
    ],
    estimate_snapshot: [
      {
        data: acceptedSnapshotRow({
          source_payload_json: {
            customer_send_snapshot_json: clone(persistedAcceptedArtifact('Legacy accepted snapshot')),
          },
        }),
        error: null,
      },
    ],
  })

  let ensureCalled = 0
  const result = await repairAcceptedEstimateSnapshotForJob(
    {
      requestOrigin: 'http://localhost',
      orgId: 'org-1',
      userId: 'user-1',
      jobId: 'job-1',
    },
    {
      db: db as never,
      ensureSnapshot: async () => {
        ensureCalled += 1
        return {
          ok: true as const,
          data: { id: 'snapshot-1' },
        }
      },
    }
  )

  assert.deepEqual(result, {
    ok: false,
    kind: 'invalid_input',
    message:
      'Accepted estimate snapshot is legacy or incomplete and cannot be repaired in place because snapshot rows are immutable. Run an additive snapshot replacement migration.',
  })
  assert.equal(ensureCalled, 0)
})
