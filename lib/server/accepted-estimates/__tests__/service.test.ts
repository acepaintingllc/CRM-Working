import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
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
