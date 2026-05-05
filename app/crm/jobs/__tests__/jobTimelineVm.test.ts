import { describe, expect, it } from 'vitest'
import type { JobDetail } from '@/types/jobs/api'
import {
  buildJobTimelineItems,
  formatJobTimelineRange,
  jobTimelineDateTimeLocalToIso,
} from '@/app/crm/jobs/_lib/jobTimelineVm'

function createJob(overrides: Partial<JobDetail> = {}): JobDetail {
  return {
    id: 'job-1',
    customer_id: 'customer-1',
    customer_name: 'Taylor Jones',
    customer_email: 'taylor@example.com',
    customer_phone: '812-555-0100',
    customer_address: '123 Main St',
    title: 'Exterior repaint',
    description: null,
    status: 'estimate_sent',
    created_at: '2026-04-20T10:00:00.000Z',
    estimate_date: null,
    estimate_sent_at: null,
    scheduled_date: null,
    scheduled_end_date: null,
    scheduled_email_sent_at: null,
    completed_at: null,
    completed_email_sent_at: null,
    ...overrides,
  } as JobDetail
}

describe('jobTimelineVm', () => {
  it('builds base lifecycle items with timeline labels and date range formatting', () => {
    const items = buildJobTimelineItems(
      createJob({
        scheduled_date: '2026-05-01T13:00:00.000Z',
        scheduled_end_date: '2026-05-03T21:00:00.000Z',
      })
    )

    expect(items.map((item) => item.key)).toContain('created_at')
    expect(items.find((item) => item.key === 'estimate_date')).toMatchObject({
      label: 'Quote date',
      value: '-',
      at: null,
      iconKey: 'calendar',
    })

    const scheduled = items.find((item) => item.key === 'scheduled_range')
    expect(scheduled?.label).toBe('Scheduled job date range')
    expect(scheduled?.value).toBe(
      formatJobTimelineRange('2026-05-01T13:00:00.000Z', '2026-05-03T21:00:00.000Z')
    )
  })

  it('merges public quote events with lifecycle entries in reverse chronological order', () => {
    const items = buildJobTimelineItems(
      createJob({
        created_at: '2026-04-20T10:00:00.000Z',
        estimate_sent_at: '2026-04-28T10:00:00.000Z',
        public_quote_timeline_events: [
          {
            id: 'quote-event-viewed',
            type: 'quote_viewed',
            title: 'Quote viewed',
            body: 'Public version #2',
            created_at: '2026-04-29T10:00:00.000Z',
            created_by: null,
            link_path: '/quote/public-token-1',
            link_label: 'Open quote',
          },
          {
            id: 'quote-event-accepted',
            type: 'quote_accepted',
            title: 'Quote accepted',
            body: 'Customer accepted online',
            created_at: '2026-04-30T10:00:00.000Z',
            created_by: null,
            link_path: 'https://example.com/quote/public-token-1',
            link_label: 'Open accepted quote',
          },
        ],
      })
    )

    expect(items.slice(0, 4).map((item) => item.key)).toEqual([
      'quote-event-accepted',
      'quote-event-viewed',
      'estimate_sent_at',
      'created_at',
    ])
    expect(items[0]).toMatchObject({
      iconKey: 'check',
      label: 'Quote accepted',
      value: 'Customer accepted online',
      href: 'https://example.com/quote/public-token-1',
      linkLabel: 'Open accepted quote',
    })
    expect(items[1]).toMatchObject({
      iconKey: 'eye',
      label: 'Quote viewed',
      value: 'Public version #2',
      href: '/quote/public-token-1',
      linkLabel: 'Open quote',
    })
  })

  it('creates stable fallback keys for repeated public quote event types', () => {
    const items = buildJobTimelineItems(
      createJob({
        public_quote_timeline_events: [
          {
            id: '',
            type: 'quote_sent',
            title: 'Quote sent',
            body: 'Public version #1',
            created_at: '2026-04-29T10:00:00.000Z',
            created_by: null,
            link_path: null,
            link_label: null,
          },
          {
            id: '',
            type: 'quote_sent',
            title: 'Quote sent',
            body: 'Public version #2',
            created_at: '2026-04-29T10:00:00.000Z',
            created_by: null,
            link_path: null,
            link_label: null,
          },
        ],
      })
    )

    const quoteKeys = items
      .filter((item) => item.key.startsWith('quote_sent-'))
      .map((item) => item.key)

    expect(quoteKeys).toEqual([
      'quote_sent-2026-04-29T10:00:00.000Z-0',
      'quote_sent-2026-04-29T10:00:00.000Z-1',
    ])
  })

  it('converts quote date datetime-local values for controller-owned updates', () => {
    expect(jobTimelineDateTimeLocalToIso('2026-05-01T09:30')).toBe(
      new Date('2026-05-01T09:30').toISOString()
    )
    expect(jobTimelineDateTimeLocalToIso('not-a-date')).toBeNull()
  })
})
