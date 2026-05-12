import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildJobAcceptedEstimateRecordResult,
  buildJobDetailRecord,
} from '../serviceCore.ts'
import {
  ACCEPTED_ESTIMATE_OPERATIONAL_SOURCE_KIND,
  ACCEPTED_ESTIMATE_OPERATIONAL_SOURCE_VERSION,
} from '../../server/accepted-estimates/types.ts'

function acceptedOperationalInputs() {
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
    org_defaults: {} as never,
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
      estimated_access_cost: 0,
      estimated_other_cost: 15,
      final_total: 3200,
      snapshot_json: {},
      source_payload_json: {
        artifact_kind: ACCEPTED_ESTIMATE_OPERATIONAL_SOURCE_KIND,
        artifact_version: ACCEPTED_ESTIMATE_OPERATIONAL_SOURCE_VERSION,
        accepted_public_version: {
          version_number: 2,
          public_token: 'token-1',
          accepted_at: '2026-04-29T10:00:00.000Z',
          acceptance_json: {},
        },
        customer_artifact: {
          artifact_kind: 'customer_estimate_artifact',
          artifact_version: 1,
          document: { total: 3200 },
        } as never,
        internal_operational_estimate: {
          inputs: acceptedOperationalInputs(),
          pricing: acceptedOperationalPricing(3200),
        },
      },
      operational_source: {
        rooms: [],
        room_wall_scopes: [],
        room_ceiling_scopes: [],
        room_trim_scopes: [],
        room_door_scopes: [],
        drywall_repairs: [],
        access_fees: [],
        prejob: [],
        pricing_summary: { finalTotal: 3200 },
        final_total: 3200,
        wall_calculations: { scopes: [] },
        ceiling_calculations: { scopes: [] },
        trim_calculations: { scopes: [] },
        door_calculations: { scopes: [] },
        drywall_calculations: { scopes: [] },
      },
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
  const acceptedEstimate = detail.accepted_estimate
  assert.notEqual(acceptedEstimate, null)
  if (!acceptedEstimate) return
  assert.deepEqual(acceptedEstimate, {
    estimate_id: 'legacy-accepted-estimate',
    accepted_public_version_id: 'public-version-1',
    public_version_number: 2,
    public_token: 'token-1',
    accepted_at: '2026-04-29T10:00:00.000Z',
    accepted_by_legal_name: 'Jordan Customer',
    signature_type: 'typed',
    user_agent: 'Mozilla/5.0',
    ip: '127.0.0.1',
    version_name: 'Accepted legacy option',
    estimate_snapshot_id: null,
    estimated_labor_hours: 18,
    estimated_paint_gallons: 5,
    estimated_supplies_cost: 90,
    estimated_access_cost: 0,
    estimated_other_cost: 15,
    final_total: 3200,
  })
  assert.equal('operational_source' in acceptedEstimate, false)
  assert.equal('source_payload_json' in acceptedEstimate, false)
  assert.equal('access_fees' in acceptedEstimate, false)
  assert.equal('prejob' in acceptedEstimate, false)
  assert.equal('other' in acceptedEstimate, false)
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
