import { describe, expect, it } from 'vitest'
import {
  buildQuoteHomeJobVersionCountsReadModel,
  buildQuoteHomeRecentActivityReadModel,
  buildQuoteHomeSearchReadModel,
  buildQuoteHomeSummaryReadModel,
  buildQuoteJobVersionsReadModel,
  buildQuoteListPayload,
  toQuoteHomeJobVersionItem,
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

  it('builds summary metrics without embedding per-job selection data', () => {
    expect(
      buildQuoteHomeSummaryReadModel(rows.map((row) => toQuoteHomeJobVersionItem(row)))
    ).toEqual({
      total_versions: 3,
      draft_count: 1,
      sent_or_awaiting_count: 3,
      live_count: 1,
      pipeline_total: 1800,
    })
  })

  it('builds recent activity separately and caps it at 12 items', () => {
    const expandedRows = Array.from({ length: 15 }, (_, index) => ({
      ...rows[0],
      id: `estimate-${index + 1}`,
      estimate_id: `estimate-${index + 1}`,
      updated_at: `2026-04-22T${String(index).padStart(2, '0')}:00:00.000Z`,
    }))

    const payload = buildQuoteHomeRecentActivityReadModel(expandedRows)

    expect(payload.items).toHaveLength(12)
    expect(payload.items[0]).toEqual({
      estimate_id: 'estimate-1',
      job_id: 'job-2',
      version_name: 'Quote Version',
      version_state: 'draft',
      version_kind: 'alternate',
      job_title: 'Garage',
      customer_name: 'Bob',
      final_total: 500,
      updated_at: '2026-04-22T00:00:00.000Z',
      is_sent_estimate: true,
    })
  })

  it('builds dedicated per-job version counts for the job list boundary', () => {
    expect(buildQuoteHomeJobVersionCountsReadModel(rows)).toEqual({
      items: [
        { job_id: 'job-2', version_count: 1 },
        { job_id: 'job-1', version_count: 2 },
      ],
    })
  })

  it('filters search results case-insensitively and caps them at 8', () => {
    const searchRows = Array.from({ length: 10 }, (_, index) => ({
      ...rows[0],
      id: `estimate-${index + 1}`,
      estimate_id: `estimate-${index + 1}`,
      version_name: `Kitchen Revision ${index + 1}`,
      job_title: 'Kitchen',
      customer_name: 'Alice',
    }))

    const payload = buildQuoteHomeSearchReadModel(searchRows, 'revision')

    expect(payload.query).toBe('revision')
    expect(payload.items).toHaveLength(8)
    expect(payload.items[0]?.estimate_id).toBe('estimate-1')
  })

  it('returns full per-job versions even when search results are capped', () => {
    const expandedRows = Array.from({ length: 205 }, (_, index) => {
      const jobId = index < 201 ? 'job-a' : 'job-b'
      const state = index < 100 ? 'draft' : index < 180 ? 'live' : 'archived'
      const total = state === 'archived' ? 1000 + index : 2000 + index

      return {
        id: `estimate-${index + 1}`,
        estimate_id: `estimate-${index + 1}`,
        job_id: jobId,
        customer_id: `customer-${jobId}`,
        status: state,
        raw_version_name: `Version ${index + 1}`,
        raw_version_state: state,
        raw_version_kind: 'standard',
        raw_version_sort_order: index + 1,
        version_name: `Version ${index + 1}`,
        version_state: state,
        version_kind: 'standard',
        version_sort_order: index + 1,
        job_title: jobId === 'job-a' ? 'Kitchen' : 'Garage',
        job_status: 'estimate_sent',
        job_estimate_sent_at: '2026-04-21T00:00:00.000Z',
        customer_name: jobId === 'job-a' ? 'Alice' : 'Bob',
        final_total: total,
        updated_at: `2026-04-22T${String(index % 24).padStart(2, '0')}:00:00.000Z`,
        created_at: `2026-04-21T${String(index % 24).padStart(2, '0')}:00:00.000Z`,
        is_sent_estimate: index < 150,
      }
    })

    const searchPayload = buildQuoteHomeSearchReadModel(expandedRows, 'version')
    const jobVersionsPayload = buildQuoteJobVersionsReadModel(expandedRows, 'job-a')

    expect(searchPayload.items).toHaveLength(8)
    expect(jobVersionsPayload.job_id).toBe('job-a')
    expect(jobVersionsPayload.total_versions).toBe(201)
    expect(jobVersionsPayload.items).toHaveLength(201)
  })
})
