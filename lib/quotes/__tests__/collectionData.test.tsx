import { describe, expect, it } from 'vitest'
import {
  buildQuoteHomeData,
  buildQuoteListPayload,
  removeQuoteEstimateFromHomeData,
} from '../collectionData'

const rows = [
  {
    id: 'estimate-3',
    estimate_id: 'estimate-3',
    job_id: 'job-2',
    customer_id: 'customer-2',
    status: 'draft',
    raw_version_name: null,
    raw_version_state: 'draft',
    raw_version_kind: 'alternate',
    raw_version_sort_order: 3,
    version_name: 'Quote Version',
    version_state: 'draft',
    version_kind: 'alternate',
    version_sort_order: 3,
    job_title: 'Garage',
    job_status: 'follow_up',
    job_estimate_sent_at: null,
    customer_name: 'Bob',
    final_total: 500,
    updated_at: '2026-04-22T09:00:00.000Z',
    created_at: '2026-04-21T09:00:00.000Z',
    is_sent_estimate: true,
  },
  {
    id: 'estimate-2',
    estimate_id: 'estimate-2',
    job_id: 'job-1',
    customer_id: 'customer-1',
    status: 'live',
    raw_version_name: 'Kitchen Revision',
    raw_version_state: 'live',
    raw_version_kind: 'revision',
    raw_version_sort_order: 2,
    version_name: 'Kitchen Revision',
    version_state: 'live',
    version_kind: 'revision',
    version_sort_order: 2,
    job_title: 'Kitchen',
    job_status: 'estimate_sent',
    job_estimate_sent_at: '2026-04-21T00:00:00.000Z',
    customer_name: 'Alice',
    final_total: 1300,
    updated_at: '2026-04-21T10:00:00.000Z',
    created_at: '2026-04-20T10:00:00.000Z',
    is_sent_estimate: true,
  },
  {
    id: 'estimate-1',
    estimate_id: 'estimate-1',
    job_id: 'job-1',
    customer_id: 'customer-1',
    status: 'archived',
    raw_version_name: 'Kitchen Original',
    raw_version_state: 'archived',
    raw_version_kind: 'standard',
    raw_version_sort_order: 1,
    version_name: 'Kitchen Original',
    version_state: 'archived',
    version_kind: 'standard',
    version_sort_order: 1,
    job_title: 'Kitchen',
    job_status: 'estimate_sent',
    job_estimate_sent_at: '2026-04-20T00:00:00.000Z',
    customer_name: 'Alice',
    final_total: 900,
    updated_at: '2026-04-20T10:00:00.000Z',
    created_at: '2026-04-19T10:00:00.000Z',
    is_sent_estimate: true,
  },
]

describe('quote collection data', () => {
  it('builds list payloads from decorated rows without re-deriving status flags', () => {
    expect(buildQuoteListPayload(rows).estimates[0]).toEqual({
      id: 'estimate-3',
      job_id: 'job-2',
      customer_id: 'customer-2',
      status: 'draft',
      version_name: null,
      version_state: 'draft',
      version_kind: 'alternate',
      version_sort_order: 3,
      updated_at: '2026-04-22T09:00:00.000Z',
      created_at: '2026-04-21T09:00:00.000Z',
      job_title: 'Garage',
      job_status: 'follow_up',
      job_estimate_sent_at: null,
      is_sent_estimate: true,
      customer_name: 'Bob',
    })
  })

  it('builds home payload summary, snapshot, and pipeline totals from shared derivation', () => {
    const payload = buildQuoteHomeData(rows)

    expect(payload.summary).toEqual({
      draft_count: 1,
      sent_or_awaiting_count: 3,
      live_count: 1,
      pipeline_total: 1800,
    })
    expect(payload.snapshot).toEqual({
      estimate_id: 'estimate-3',
      job_id: 'job-2',
      customer_id: 'customer-2',
      version_name: 'Quote Version',
      version_state: 'draft',
      version_kind: 'alternate',
      version_sort_order: 3,
      job_title: 'Garage',
      customer_name: 'Bob',
      final_total: 500,
      updated_at: '2026-04-22T09:00:00.000Z',
      created_at: '2026-04-21T09:00:00.000Z',
      is_sent_estimate: true,
      total_versions: 3,
    })
    expect(payload.recent_estimates).toHaveLength(3)
    expect(payload.search_estimates).toHaveLength(3)
  })

  it('recomputes optimistic home state from the shared helper after a delete', () => {
    const next = removeQuoteEstimateFromHomeData(buildQuoteHomeData(rows), 'estimate-3')

    expect(next.summary).toEqual({
      draft_count: 0,
      sent_or_awaiting_count: 2,
      live_count: 1,
      pipeline_total: 1300,
    })
    expect(next.snapshot?.estimate_id).toBe('estimate-2')
    expect(next.recent_estimates.map((row) => row.estimate_id)).toEqual([
      'estimate-2',
      'estimate-1',
    ])
  })
})
