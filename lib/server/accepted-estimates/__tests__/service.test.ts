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
import { buildCustomerSendPersistedSnapshot } from '@/lib/server/customer-send/types'
import { buildCustomerDocumentFromSendContext } from '@/lib/server/customer-send/document'
import { buildCustomerSendContractContext } from '@/lib/server/customer-send/__tests__/customerSendContractHarness'

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
    estimated_other_cost: 30,
    estimated_total: 5100,
    source_payload_json: {
      customer_artifact: clone(publicVersion.snapshot_json),
      accepted_public_version: clone(publicVersion),
    },
    ...overrides,
  }
}

function artifactTotal(snapshot: unknown) {
  return (snapshot as { document: { total: number } }).document.total
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
  assert.deepEqual(source.snapshot_json, publicVersion.snapshot_json)
})

test('buildAcceptedEstimateSourceFromSnapshot uses the canonical embedded accepted artifact', () => {
  const source = buildAcceptedEstimateSourceFromSnapshot({
    estimate: acceptedEstimateRow({ version_name: 'Mutable live version name' }),
    snapshot: acceptedSnapshotRow({
      source_payload_json: {
        customer_artifact: clone(persistedAcceptedArtifact('Accepted snapshot title')),
        accepted_public_version: clone(
          acceptedPublicVersionRow({
            snapshot_json: clone(persistedAcceptedArtifact('Mutated public version title')),
          })
        ),
      },
    }),
    artifactState: {
      kind: 'canonical',
      artifact: clone(persistedAcceptedArtifact('Accepted snapshot title')),
      accepted_public_version: clone(
        acceptedPublicVersionRow({
          snapshot_json: clone(persistedAcceptedArtifact('Mutated public version title')),
        })
      ),
    },
  })

  assert.equal(source.public_version_number, 3)
  assert.equal(source.public_token, 'public-token-1')
  assert.equal(source.final_total, persistedAcceptedArtifact('Accepted snapshot title').document.total)
  assert.deepEqual(source.snapshot_json, persistedAcceptedArtifact('Accepted snapshot title'))
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

  const result = await loadAcceptedEstimateSource(db as never, 'org-1', 'job-1')

  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.data.estimate_snapshot_id, 'snapshot-1')
    assert.equal(result.data.final_total, artifactTotal(acceptedPublicVersionRow().snapshot_json))
    assert.deepEqual(result.data.snapshot_json, acceptedPublicVersionRow().snapshot_json)
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
          customer_artifact: clone(acceptedArtifact),
          accepted_public_version: clone(
            acceptedPublicVersionRow({
              snapshot_json: clone(persistedAcceptedArtifact('Mutated public version title')),
            })
          ),
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
