import { describe, expect, it } from 'vitest'
import {
  buildQuoteHomeBootstrapReadModel,
  buildQuoteHomeJobsPageReadModel,
  buildQuoteHomeSearchReadModel,
  buildQuoteHomeSummaryFromRow,
  buildQuoteHomeSummaryReadModel,
  buildQuoteJobVersionsReadModel,
  buildQuoteListPayload,
} from '../quoteHomeSummary'
import type { QuoteHomeJobsPageReadModel } from '../quoteHomeTypes'

function makeJob(id: string): QuoteHomeJobsPageReadModel['items'][number] {
  return {
    id,
    customer_id: `customer-${id}`,
    customer_name: 'Alice',
    customer_address: '123 Main',
    title: 'Kitchen',
    description: null,
    status: 'estimate_scheduled',
    created_at: '2026-04-21T10:00:00.000Z',
    estimate_date: null,
    estimate_sent_at: '2026-04-21T00:00:00.000Z',
    scheduled_date: null,
    scheduled_end_date: null,
    scheduled_email_sent_at: null,
    completed_at: null,
    completed_email_sent_at: null,
    closeout_notes: null,
    linked_estimate_id: null,
    version_count: 2,
  }
}

describe('quote home summary builders', () => {
  it('builds summary metrics across states and malformed totals', () => {
    expect(
      buildQuoteHomeSummaryReadModel([
        { version_state: 'draft', final_total: 100, is_sent_estimate: false },
        { version_state: 'live', final_total: 200, is_sent_estimate: true },
        { version_state: 'archived', final_total: 300, is_sent_estimate: false },
        { version_state: 'draft', final_total: null, is_sent_estimate: true },
        { version_state: 'live', final_total: -50, is_sent_estimate: false },
        { version_state: 'live', final_total: Number.NaN, is_sent_estimate: false },
      ]),
    ).toEqual({
      total_versions: 6,
      draft_count: 2,
      sent_or_awaiting_count: 2,
      live_count: 3,
      pipeline_total: 300,
    })
  })

  it('builds summary and bootstrap payloads without changing response shape', () => {
    const summary = buildQuoteHomeSummaryFromRow({
      total_versions: 3,
      draft_count: 1,
      sent_or_awaiting_count: 2,
      live_count: 1,
      pipeline_total: 1200,
    })
    const jobs = buildQuoteHomeJobsPageReadModel({
      query: '',
      limit: 25,
      nextCursor: null,
      items: [makeJob('job-1')],
    })

    expect(
      buildQuoteHomeBootstrapReadModel({
        summary,
        jobs,
        selectedJobVersions: null,
      }),
    ).toEqual({
      summary,
      jobs,
      selected_job_id: 'job-1',
      selected_job_versions: null,
    })
  })

  it('builds list, search, and paged version payloads from selected rows only', () => {
    const rows = [
      {
        id: 'estimate-1',
        estimate_id: 'estimate-1',
        job_id: 'job-a',
        customer_id: 'customer-a',
        status: 'draft',
        version_name: 'Version 1',
        version_state: 'draft',
        version_kind: 'standard',
        version_sort_order: 1,
        job_title: 'Kitchen',
        customer_name: 'Alice',
        final_total: 1200,
        updated_at: '2026-04-22T10:00:00.000Z',
        created_at: '2026-04-21T10:00:00.000Z',
        is_sent_estimate: true,
      },
      {
        id: 'estimate-2',
        estimate_id: 'estimate-2',
        job_id: 'job-b',
        customer_id: 'customer-b',
        status: 'live',
        version_name: 'Version 2',
        version_state: 'live',
        version_kind: 'alternate',
        version_sort_order: 2,
        job_title: 'Garage',
        customer_name: 'Bob',
        final_total: 900,
        updated_at: '2026-04-23T10:00:00.000Z',
        created_at: '2026-04-22T10:00:00.000Z',
        is_sent_estimate: false,
      },
    ]

    expect(buildQuoteListPayload(rows).estimates).toHaveLength(2)
    expect(buildQuoteHomeSearchReadModel(rows, 'version')).toEqual({
      query: 'version',
      items: [
        expect.objectContaining({ estimate_id: 'estimate-1' }),
        expect.objectContaining({ estimate_id: 'estimate-2' }),
      ],
    })
    expect(
      buildQuoteJobVersionsReadModel(rows, {
        jobId: 'job-a',
        totalVersions: 2,
        limit: 25,
        nextCursor: 'cursor-2',
      }),
    ).toEqual({
      job_id: 'job-a',
      total_versions: 2,
      limit: 25,
      next_cursor: 'cursor-2',
      items: [expect.objectContaining({ estimate_id: 'estimate-1' })],
    })
  })
})
