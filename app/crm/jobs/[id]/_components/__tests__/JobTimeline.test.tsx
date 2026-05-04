import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { JobDetail } from '@/types/jobs/api'
import JobTimeline from '../JobTimeline'

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

describe('JobTimeline', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders repeated public quote event types without duplicate React keys', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    render(
      <JobTimeline
        job={createJob({
          public_quote_timeline_events: [
            {
              id: 'quote-sent-1',
              type: 'quote_sent',
              title: 'Quote sent',
              body: 'Public version #1',
              created_at: '2026-04-29T10:00:00.000Z',
              created_by: null,
              link_path: '/quote/token-1',
              link_label: 'Open quote',
            },
            {
              id: 'quote-sent-2',
              type: 'quote_sent',
              title: 'Quote sent',
              body: 'Public version #2',
              created_at: '2026-04-30T10:00:00.000Z',
              created_by: null,
              link_path: '/quote/token-2',
              link_label: 'Open quote',
            },
          ],
        })}
        open
        onToggle={vi.fn()}
        onEstimateDateChange={vi.fn()}
        formatDate={(value) => value ?? ''}
        formatRange={() => ''}
      />
    )

    expect(screen.getByText('Public version #1')).toBeTruthy()
    expect(screen.getByText('Public version #2')).toBeTruthy()
    expect(
      consoleError.mock.calls.some((args) =>
        args.some(
          (arg) =>
            typeof arg === 'string' &&
            arg.includes('Encountered two children with the same key')
        )
      )
    ).toBe(false)
  })
})
