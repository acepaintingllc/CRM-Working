import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildJobAcceptedEstimateRecordResult,
  buildJobDetailRecord,
} from '../serviceCore.ts'

test('job detail keeps accepted-estimate ownership separate from quote navigation fallback', () => {
  const acceptedEstimateResult = buildJobAcceptedEstimateRecordResult({
    ok: true,
    data: {
      org_id: 'org-1',
      job_id: 'job-1',
      estimate_id: 'legacy-accepted-estimate',
      customer_id: 'customer-1',
      accepted_public_version_id: 'public-version-1',
      public_version_number: 2,
      public_token: 'token-1',
      accepted_at: '2026-04-29T10:00:00.000Z',
      accepted_by_legal_name: 'Jordan Customer',
      signature_type: 'typed',
      user_agent: 'Mozilla/5.0',
      ip: '127.0.0.1',
      version_name: 'Accepted legacy option',
      version_state: 'live',
      estimate_snapshot_id: null,
      estimated_labor_hours: 18,
      estimated_paint_gallons: 5,
      estimated_supplies_cost: 90,
      estimated_other_cost: 15,
      final_total: 3200,
      snapshot_json: {},
    },
  })

  assert.equal(acceptedEstimateResult.ok, true)
  if (!acceptedEstimateResult.ok) return

  const detail = buildJobDetailRecord({
    row: {
      id: 'job-1',
      customer_id: 'customer-1',
      title: 'Legacy accepted job',
      status: 'completed',
      linked_estimate_id: null,
    },
    optionalColumns: [],
    customer: {
      id: 'customer-1',
      name: 'Taylor Smith',
      address: '123 Main St',
      email: 'taylor@example.com',
      phone: '555-1234',
    },
    quoteNavigationEstimates: [
      {
        id: 'draft-estimate-1',
        status: 'draft',
        version_name: 'Draft option',
        version_state: 'draft',
        version_kind: 'standard',
        version_sort_order: 1,
        updated_at: null,
        created_at: null,
      },
    ],
    acceptedEstimate: acceptedEstimateResult.data,
  })

  assert.equal(detail.linked_estimate_id, null)
  assert.equal(detail.estimate_navigation_id, 'draft-estimate-1')
  assert.equal(detail.accepted_estimate?.estimate_id, 'legacy-accepted-estimate')
  assert.equal(detail.accepted_estimate?.accepted_public_version_id, 'public-version-1')
})

test('job detail leaves accepted_estimate null when the canonical loader result is missing', () => {
  const detail = buildJobDetailRecord({
    row: {
      id: 'job-1',
      customer_id: 'customer-1',
      title: 'Legacy accepted job',
      status: 'completed',
      linked_estimate_id: null,
    },
    optionalColumns: [],
    quoteNavigationEstimates: [
      {
        id: 'draft-estimate-1',
        status: 'draft',
        version_name: 'Draft option',
        version_state: 'draft',
        version_kind: 'standard',
        version_sort_order: 1,
        updated_at: null,
        created_at: null,
      },
    ],
    acceptedEstimate: null,
  })

  assert.equal(detail.accepted_estimate, null)
  assert.equal(detail.estimate_navigation_id, 'draft-estimate-1')
})
