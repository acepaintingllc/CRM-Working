import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildJobDetailRecord,
  buildJobSummaryRecord,
  normalizeCreateJobInput,
  normalizeUpdateJobInput,
} from '../serviceCore.ts'

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
    sitePhotoCount: 2,
  })

  assert.equal(summary.title, 'Untitled job')
  assert.equal(summary.status, 'estimate_scheduled')
  assert.equal(summary.customer_name, 'Alice')
  assert.equal(summary.scheduled_date, '2026-04-22T14:00:00.000Z')
  assert.equal(summary.has_site_photos, true)

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
    linkedEstimates: [
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
  assert.equal(detail.linked_estimate_id, 'estimate-1')
})
