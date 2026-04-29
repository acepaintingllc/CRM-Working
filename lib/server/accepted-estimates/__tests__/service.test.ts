import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  applyAcceptedEstimateSideEffects,
  buildAcceptedEstimateSource,
  buildAcceptedEstimateUpdatePlan,
} from '../service.ts'

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
