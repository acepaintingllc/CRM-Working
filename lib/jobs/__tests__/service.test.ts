import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildJobAcceptedEstimateRecordResult,
  buildJobDetailRecord,
  buildJobSummaryRecord,
  normalizeCreateJobInput,
  normalizeUpdateJobInput,
} from '../serviceCore.ts'
import type { JobActualsStatus } from '../../../types/jobs/feedback.ts'

test('jobs service helpers normalize create input and apply the default status', () => {
  const result = normalizeCreateJobInput({
    customer_id: 'customer-1',
    title: ' Paint house ',
    description: 'Exterior',
  })

  assert.deepEqual(result, {
    ok: true,
    data: {
      customer_id: 'customer-1',
      title: 'Paint house',
      description: 'Exterior',
      status: 'estimate_scheduled',
      estimate_date: null,
      estimate_sent_at: null,
      scheduled_date: null,
      scheduled_end_date: null,
      completed_at: null,
      closeout_notes: null,
    },
  })
})

test('jobs service helpers infer scheduled status from a schedule patch', () => {
  const result = normalizeUpdateJobInput({
    scheduled_date: '2026-04-21T10:00:00.000Z',
    scheduled_end_date: '2026-04-21T18:00:00.000Z',
  })

  assert.deepEqual(result, {
    ok: true,
    data: {
      scheduled_date: '2026-04-21T10:00:00.000Z',
      scheduled_end_date: '2026-04-21T18:00:00.000Z',
      status: 'scheduled',
    },
  })
})

test('jobs service helpers build enriched summary and detail records', () => {
  const summary = buildJobSummaryRecord({
    row: {
      id: 'job-1',
      customer_id: 'customer-1',
      title: null,
      status: null,
      estimate_date: null,
      estimate_sent_at: null,
      scheduled_date: null,
      scheduled_end_date: null,
      completed_at: null,
    },
    optionalColumns: ['scheduled_email_sent_at', 'completed_email_sent_at'],
    customer: { id: 'customer-1', name: 'Alice', address: '123 Main St' },
    scheduleRange: {
      scheduled_date: '2026-04-22T14:00:00.000Z',
      scheduled_end_date: '2026-04-22T18:00:00.000Z',
    },
  })

  assert.equal(summary.title, 'Untitled job')
  assert.equal(summary.status, 'estimate_scheduled')
  assert.equal(summary.customer_name, 'Alice')
  assert.equal(summary.scheduled_date, '2026-04-22T14:00:00.000Z')

  const detail = buildJobDetailRecord({
    row: { ...summary, customer_id: 'customer-1' },
    optionalColumns: ['scheduled_email_sent_at', 'completed_email_sent_at'],
    customer: {
      id: 'customer-1',
      name: 'Alice',
      address: '123 Main St',
      email: 'alice@example.com',
      phone: '555-1234',
    },
    quoteNavigationEstimates: [
      {
        id: 'estimate-1',
        status: 'draft',
        version_name: 'V1',
        version_state: 'draft',
        version_kind: 'standard',
        version_sort_order: 1,
        updated_at: null,
        created_at: null,
      },
    ],
  })

  assert.equal(detail.customer_email, 'alice@example.com')
  assert.equal(detail.customer_phone, '555-1234')
  assert.equal(detail.linked_estimate_id, null)
  assert.equal(detail.estimate_navigation_id, 'estimate-1')
})

test('jobs service helpers do not populate canonical linked_estimate_id from the first estimate row', () => {
  const detail = buildJobDetailRecord({
    row: {
      id: 'job-1',
      customer_id: 'customer-1',
      title: 'Kitchen',
      linked_estimate_id: null,
    },
    optionalColumns: ['linked_estimate_id'],
    quoteNavigationEstimates: [
      {
        id: 'draft-estimate',
        status: 'draft',
        version_name: null,
        version_state: 'draft',
        version_kind: null,
        version_sort_order: 1,
        created_at: null,
        updated_at: null,
      },
    ],
  })

  assert.equal(detail.linked_estimate_id, null)
  assert.equal(detail.estimate_navigation_id, 'draft-estimate')
})

test('jobs service helpers keep quote navigation fallback separate from legacy accepted estimate source', () => {
  const detail = buildJobDetailRecord({
    row: {
      id: 'job-1',
      customer_id: 'customer-1',
      title: 'Kitchen',
      linked_estimate_id: null,
    },
    optionalColumns: ['linked_estimate_id'],
    quoteNavigationEstimates: [
      {
        id: 'navigation-only-estimate',
        status: 'draft',
        version_name: null,
        version_state: 'draft',
        version_kind: null,
        version_sort_order: 1,
        created_at: null,
        updated_at: null,
      },
    ],
    acceptedEstimate: {
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
      estimated_other_cost: 15,
      final_total: 3200,
    },
  })

  assert.equal(detail.linked_estimate_id, null)
  assert.equal(detail.accepted_estimate?.estimate_id, 'legacy-accepted-estimate')
  assert.equal(detail.estimate_navigation_id, 'navigation-only-estimate')
})

test('jobs service helpers include accepted estimate audit details', () => {
  const detail = buildJobDetailRecord({
    row: {
      id: 'job-1',
      customer_id: 'customer-1',
      title: 'Kitchen',
      linked_estimate_id: 'estimate-1',
    },
    optionalColumns: ['linked_estimate_id'],
    acceptedEstimate: {
      estimate_id: 'estimate-1',
      accepted_public_version_id: 'public-version-1',
      public_version_number: 3,
      public_token: 'public-token-1',
      accepted_at: '2026-04-29T10:00:00.000Z',
      accepted_by_legal_name: 'Jordan Customer',
      signature_type: 'typed',
      user_agent: 'Mozilla/5.0',
      ip: '127.0.0.1',
      version_name: 'Interior repaint',
      estimate_snapshot_id: 'snapshot-1',
      estimated_labor_hours: 32,
      estimated_paint_gallons: 7.5,
      estimated_supplies_cost: 180,
      estimated_other_cost: 45,
      final_total: 4250,
    },
  })

  assert.deepEqual(detail.accepted_estimate, {
    estimate_id: 'estimate-1',
    accepted_public_version_id: 'public-version-1',
    public_version_number: 3,
    public_token: 'public-token-1',
    accepted_at: '2026-04-29T10:00:00.000Z',
    accepted_by_legal_name: 'Jordan Customer',
    signature_type: 'typed',
    user_agent: 'Mozilla/5.0',
    ip: '127.0.0.1',
    version_name: 'Interior repaint',
    estimate_snapshot_id: 'snapshot-1',
    estimated_labor_hours: 32,
    estimated_paint_gallons: 7.5,
    estimated_supplies_cost: 180,
    estimated_other_cost: 45,
    final_total: 4250,
  })
})

test('jobs service helpers include shared job actuals workflow status in detail records', () => {
  const status: JobActualsStatus = 'submitted'
  const detail = buildJobDetailRecord({
    row: {
      id: 'job-1',
      customer_id: 'customer-1',
      title: 'Kitchen',
    },
    optionalColumns: [],
    jobActualsStatus: status,
  })

  assert.equal(detail.job_actuals_status, status)
})

test('jobs service helpers include public quote timeline events', () => {
  const detail = buildJobDetailRecord({
    row: {
      id: 'job-1',
      customer_id: 'customer-1',
      title: 'Kitchen',
    },
    optionalColumns: [],
    publicQuoteTimelineEvents: [
      {
        id: 'quote-event-1',
        type: 'quote_viewed',
        title: 'Quote viewed',
        body: 'Public version #1',
        created_at: '2026-04-22T11:00:00.000Z',
        created_by: null,
        link_path: '/quote/token-1',
        link_label: 'Open quote',
      },
    ],
  })

  assert.deepEqual(detail.public_quote_timeline_events, [
    {
      id: 'quote-event-1',
      type: 'quote_viewed',
      title: 'Quote viewed',
      body: 'Public version #1',
      created_at: '2026-04-22T11:00:00.000Z',
      created_by: null,
      link_path: '/quote/token-1',
      link_label: 'Open quote',
    },
  ])
})

test('jobs service helpers prefer explicit linked_estimate_id over first estimate row', () => {
  const detail = buildJobDetailRecord({
    row: {
      id: 'job-1',
      customer_id: 'customer-1',
      title: 'Kitchen',
      linked_estimate_id: 'accepted-estimate',
    },
    optionalColumns: ['linked_estimate_id'],
    quoteNavigationEstimates: [
      {
        id: 'draft-estimate',
        status: 'draft',
        version_name: null,
        version_state: 'draft',
        version_kind: null,
        version_sort_order: 1,
        created_at: null,
        updated_at: null,
      },
      {
        id: 'accepted-estimate',
        status: 'ready',
        version_name: null,
        version_state: 'live',
        version_kind: null,
        version_sort_order: 2,
        created_at: null,
        updated_at: null,
      },
    ],
  })

  assert.equal(detail.linked_estimate_id, 'accepted-estimate')
  assert.equal(detail.estimate_navigation_id, 'accepted-estimate')
})

test('jobs service helpers propagate accepted source errors instead of swallowing them', () => {
  const result = buildJobAcceptedEstimateRecordResult({
    ok: false,
    kind: 'server_error',
    message: 'Unable to load accepted estimate snapshot',
  })

  assert.deepEqual(result, {
    ok: false,
    kind: 'server_error',
    message: 'Unable to load accepted estimate snapshot',
  })
})
