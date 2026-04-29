import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  applyAcceptedEstimateSideEffects,
  buildAcceptedEstimateSource,
  buildAcceptedEstimateUpdatePlan,
  loadAcceptedEstimateSource,
} from '../service.ts'

type MockQueryResponse = {
  data: Record<string, unknown> | null
  error: { message?: string } | null
}

type MockQueryCall = {
  table: string
  columns: string
  filters: Record<string, unknown>
}

function createReadDb(responses: Record<string, MockQueryResponse>) {
  const calls: MockQueryCall[] = []
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
          calls.push({ table, columns: selectedColumns, filters: { ...filters } })
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
    status: 'scheduled',
  })
})

test('buildAcceptedEstimateSource uses rollup total and public snapshot as invoice/work-order source', () => {
  const source = buildAcceptedEstimateSource({
    estimate: {
      org_id: 'org-1',
      id: 'estimate-1',
      job_id: 'job-1',
      customer_id: 'customer-1',
      version_name: 'Interior repaint',
      version_state: 'live',
      accepted_at: '2026-04-29T10:00:00.000Z',
      accepted_public_version_id: 'public-version-1',
    },
    publicVersion: {
      id: 'public-version-1',
      snapshot_json: { document: { title: 'Quote' } },
    },
    rollup: {
      final_total: 4250,
    },
  })

  assert.deepEqual(source, {
    org_id: 'org-1',
    job_id: 'job-1',
    estimate_id: 'estimate-1',
    customer_id: 'customer-1',
    accepted_public_version_id: 'public-version-1',
    accepted_at: '2026-04-29T10:00:00.000Z',
    version_name: 'Interior repaint',
    version_state: 'live',
    final_total: 4250,
    snapshot_json: { document: { title: 'Quote' } },
  })
})

test('buildAcceptedEstimateSource returns empty snapshot for non-record public snapshots', () => {
  const baseParams = {
    estimate: {
      org_id: 'org-1',
      id: 'estimate-1',
      job_id: 'job-1',
      customer_id: 'customer-1',
      version_name: 'Interior repaint',
      version_state: 'live',
      accepted_at: '2026-04-29T10:00:00.000Z',
      accepted_public_version_id: 'public-version-1',
    },
    rollup: {
      final_total: 4250,
    },
  }

  assert.deepEqual(
    buildAcceptedEstimateSource({
      ...baseParams,
      publicVersion: { id: 'public-version-1', snapshot_json: null },
    }).snapshot_json,
    {}
  )
  assert.deepEqual(
    buildAcceptedEstimateSource({
      ...baseParams,
      publicVersion: { id: 'public-version-1', snapshot_json: 'not-a-record' },
    }).snapshot_json,
    {}
  )
  assert.deepEqual(
    buildAcceptedEstimateSource({
      ...baseParams,
      publicVersion: { id: 'public-version-1', snapshot_json: ['not-a-record'] },
    }).snapshot_json,
    {}
  )
})

test('buildAcceptedEstimateSource defaults absent and invalid rollup totals to zero', () => {
  const estimate = {
    org_id: 'org-1',
    id: 'estimate-1',
    job_id: 'job-1',
    customer_id: 'customer-1',
    version_name: 'Interior repaint',
    version_state: 'live',
    accepted_at: '2026-04-29T10:00:00.000Z',
    accepted_public_version_id: 'public-version-1',
  }
  const publicVersion = {
    id: 'public-version-1',
    snapshot_json: { document: { title: 'Quote' } },
  }

  assert.equal(
    buildAcceptedEstimateSource({ estimate, publicVersion, rollup: null }).final_total,
    0
  )
  assert.equal(
    buildAcceptedEstimateSource({
      estimate,
      publicVersion,
      rollup: { final_total: 'not-a-number' },
    }).final_total,
    0
  )
  assert.equal(
    buildAcceptedEstimateSource({
      estimate,
      publicVersion,
      rollup: { final_total: Infinity },
    }).final_total,
    0
  )
})

test('buildAcceptedEstimateSource normalizes blank optional text fields to null', () => {
  const source = buildAcceptedEstimateSource({
    estimate: {
      org_id: 'org-1',
      id: 'estimate-1',
      job_id: 'job-1',
      customer_id: '   ',
      version_name: null,
      version_state: '',
      accepted_at: '2026-04-29T10:00:00.000Z',
      accepted_public_version_id: 'public-version-1',
    },
    publicVersion: {
      id: 'public-version-1',
      snapshot_json: { document: { title: 'Quote' } },
    },
    rollup: {
      final_total: 4250,
    },
  })

  assert.equal(source.customer_id, null)
  assert.equal(source.version_name, null)
  assert.equal(source.version_state, null)
})

test('applyAcceptedEstimateSideEffects updates estimates first, then jobs with the accepted estimate plan payloads', async () => {
  const calls: Array<{
    table: string
    payload: Record<string, unknown>
    filters: Record<string, unknown>
  }> = []
  const db = {
    from(table: string) {
      return {
        update(payload: Record<string, unknown>) {
          return {
            eq(column: string, value: unknown) {
              const filters: Record<string, unknown> = { [column]: value }
              return {
                eq(nextColumn: string, nextValue: unknown) {
                  filters[nextColumn] = nextValue
                  calls.push({ table, payload, filters })
                  return Promise.resolve({ error: null })
                },
              }
            },
          }
        },
      }
    },
  }
  const input = {
    orgId: 'org-1',
    jobId: 'job-1',
    estimateId: 'estimate-1',
    publicVersionId: 'public-version-1',
    acceptedAt: '2026-04-29T10:00:00.000Z',
  }

  const result = await applyAcceptedEstimateSideEffects(db, input)
  const plan = buildAcceptedEstimateUpdatePlan(input)

  assert.equal(result.ok, true)
  assert.deepEqual(calls, [
    {
      table: 'estimates',
      payload: plan.estimateUpdate,
      filters: { org_id: 'org-1', id: 'estimate-1' },
    },
    {
      table: 'jobs',
      payload: plan.jobUpdate,
      filters: { org_id: 'org-1', id: 'job-1' },
    },
  ])
})

test('applyAcceptedEstimateSideEffects returns server_error and skips jobs when the estimate update fails', async () => {
  const calls: string[] = []
  const db = {
    from(table: string) {
      calls.push(table)
      return {
        update() {
          return {
            eq() {
              return {
                eq() {
                  return Promise.resolve({
                    error: table === 'estimates' ? { message: 'estimate update failed' } : null,
                  })
                },
              }
            },
          }
        },
      }
    },
  }

  const result = await applyAcceptedEstimateSideEffects(db, {
    orgId: 'org-1',
    jobId: 'job-1',
    estimateId: 'estimate-1',
    publicVersionId: 'public-version-1',
    acceptedAt: '2026-04-29T10:00:00.000Z',
  })

  assert.deepEqual(result, {
    ok: false,
    kind: 'server_error',
    message: 'estimate update failed',
  })
  assert.deepEqual(calls, ['estimates'])
})

test('applyAcceptedEstimateSideEffects returns server_error when the job update fails', async () => {
  const db = {
    from(table: string) {
      return {
        update() {
          return {
            eq() {
              return {
                eq() {
                  return Promise.resolve({
                    error: table === 'jobs' ? { message: 'job update failed' } : null,
                  })
                },
              }
            },
          }
        },
      }
    },
  }

  const result = await applyAcceptedEstimateSideEffects(db, {
    orgId: 'org-1',
    jobId: 'job-1',
    estimateId: 'estimate-1',
    publicVersionId: 'public-version-1',
    acceptedAt: '2026-04-29T10:00:00.000Z',
  })

  assert.deepEqual(result, {
    ok: false,
    kind: 'server_error',
    message: 'job update failed',
  })
})

test('loadAcceptedEstimateSource returns accepted estimate source from job link, public version, and rollup', async () => {
  const { db, calls } = createReadDb({
    jobs: {
      data: {
        id: 'job-1',
        linked_estimate_id: 'estimate-1',
      },
      error: null,
    },
    estimates: {
      data: {
        id: 'estimate-1',
        org_id: 'org-1',
        job_id: 'job-1',
        customer_id: 'customer-1',
        version_name: 'Interior repaint',
        version_state: 'live',
        accepted_at: '2026-04-29T10:00:00.000Z',
        accepted_public_version_id: 'public-version-1',
      },
      error: null,
    },
    estimate_public_versions: {
      data: {
        id: 'public-version-1',
        snapshot_json: { document: { title: 'Quote' } },
      },
      error: null,
    },
    estimate_version_rollups: {
      data: {
        final_total: 4250,
      },
      error: null,
    },
  })

  const result = await loadAcceptedEstimateSource(db, 'org-1', 'job-1')

  assert.deepEqual(calls, [
    {
      table: 'jobs',
      columns: 'id, linked_estimate_id',
      filters: { org_id: 'org-1', id: 'job-1' },
    },
    {
      table: 'estimates',
      columns:
        'id, org_id, job_id, customer_id, version_name, version_state, accepted_at, accepted_public_version_id',
      filters: { org_id: 'org-1', id: 'estimate-1' },
    },
    {
      table: 'estimate_public_versions',
      columns: 'id, snapshot_json',
      filters: { org_id: 'org-1', id: 'public-version-1' },
    },
    {
      table: 'estimate_version_rollups',
      columns: 'final_total',
      filters: { org_id: 'org-1', estimate_id: 'estimate-1' },
    },
  ])
  assert.deepEqual(result, {
    ok: true,
    data: {
      org_id: 'org-1',
      job_id: 'job-1',
      estimate_id: 'estimate-1',
      customer_id: 'customer-1',
      accepted_public_version_id: 'public-version-1',
      accepted_at: '2026-04-29T10:00:00.000Z',
      version_name: 'Interior repaint',
      version_state: 'live',
      final_total: 4250,
      snapshot_json: { document: { title: 'Quote' } },
    },
  })
})

test('loadAcceptedEstimateSource returns not_found when the job is missing', async () => {
  const { db } = createReadDb({
    jobs: {
      data: null,
      error: null,
    },
  })

  const result = await loadAcceptedEstimateSource(db, 'org-1', 'job-1')

  assert.deepEqual(result, {
    ok: false,
    kind: 'not_found',
    message: 'Job not found',
  })
})

test('loadAcceptedEstimateSource returns invalid_input when the job has no accepted estimate link', async () => {
  const { db } = createReadDb({
    jobs: {
      data: {
        id: 'job-1',
        linked_estimate_id: null,
      },
      error: null,
    },
  })

  const result = await loadAcceptedEstimateSource(db, 'org-1', 'job-1')

  assert.deepEqual(result, {
    ok: false,
    kind: 'invalid_input',
    message: 'Job has no accepted estimate',
  })
})

test('loadAcceptedEstimateSource returns invalid_input when the linked estimate is not accepted', async () => {
  const { db } = createReadDb({
    jobs: {
      data: {
        id: 'job-1',
        linked_estimate_id: 'estimate-1',
      },
      error: null,
    },
    estimates: {
      data: {
        id: 'estimate-1',
        org_id: 'org-1',
        job_id: 'job-1',
        customer_id: 'customer-1',
        version_name: 'Interior repaint',
        version_state: 'draft',
        accepted_at: null,
        accepted_public_version_id: null,
      },
      error: null,
    },
  })

  const result = await loadAcceptedEstimateSource(db, 'org-1', 'job-1')

  assert.deepEqual(result, {
    ok: false,
    kind: 'invalid_input',
    message: 'Linked estimate is not accepted',
  })
})

test('loadAcceptedEstimateSource allows a missing rollup and defaults final_total to zero', async () => {
  const { db } = createReadDb({
    jobs: {
      data: {
        id: 'job-1',
        linked_estimate_id: 'estimate-1',
      },
      error: null,
    },
    estimates: {
      data: {
        id: 'estimate-1',
        org_id: 'org-1',
        job_id: 'job-1',
        customer_id: 'customer-1',
        version_name: 'Interior repaint',
        version_state: 'live',
        accepted_at: '2026-04-29T10:00:00.000Z',
        accepted_public_version_id: 'public-version-1',
      },
      error: null,
    },
    estimate_public_versions: {
      data: {
        id: 'public-version-1',
        snapshot_json: { document: { title: 'Quote' } },
      },
      error: null,
    },
    estimate_version_rollups: {
      data: null,
      error: null,
    },
  })

  const result = await loadAcceptedEstimateSource(db, 'org-1', 'job-1')

  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.data.final_total, 0)
  }
})
