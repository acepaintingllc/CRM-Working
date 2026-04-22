import { describe, expect, it } from 'vitest'
import { vi } from 'vitest'

vi.mock('@/lib/server/org', () => ({
  supabaseAdmin: {},
}))

import {
  buildJobDetailRecord,
  buildJobSummaryRecord,
  normalizeCreateJobInput,
  normalizeUpdateJobInput,
} from '@/lib/jobs/service'

describe('job service helpers', () => {
  it('normalizes create input and applies the default status', () => {
    const result = normalizeCreateJobInput({
      customer_id: 'customer-1',
      title: ' Paint house ',
      description: 'Exterior',
    })

    expect(result).toEqual({
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

  it('infers scheduled status from a schedule patch', () => {
    const result = normalizeUpdateJobInput({
      scheduled_date: '2026-04-21T10:00:00.000Z',
      scheduled_end_date: '2026-04-21T18:00:00.000Z',
    })

    expect(result).toEqual({
      ok: true,
      data: {
        scheduled_date: '2026-04-21T10:00:00.000Z',
        scheduled_end_date: '2026-04-21T18:00:00.000Z',
        status: 'scheduled',
      },
    })
  })

  it('builds enriched summary and detail records', () => {
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

    expect(summary.title).toBe('Untitled job')
    expect(summary.status).toBe('estimate_scheduled')
    expect(summary.customer_name).toBe('Alice')
    expect(summary.scheduled_date).toBe('2026-04-22T14:00:00.000Z')
    expect(summary.has_site_photos).toBe(true)

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

    expect(detail.customer_email).toBe('alice@example.com')
    expect(detail.customer_phone).toBe('555-1234')
    expect(detail.linked_estimate_id).toBe('estimate-1')
  })
})
