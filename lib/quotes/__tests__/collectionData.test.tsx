import { describe, expect, it } from 'vitest'
import {
  buildQuoteHomeBootstrapReadModel,
  buildQuoteHomeJobsPageReadModel,
  buildQuoteHomeRecentActivityReadModel,
  buildQuoteHomeSearchReadModel,
  buildQuoteHomeSummaryReadModel,
  buildQuoteJobVersionsReadModel,
  buildQuoteListPayload,
  toQuoteHomeJobVersionItem,
  toQuoteHomeSearchResultReadModel,
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

  it('builds the canonical bootstrap payload from paged jobs plus selected job versions', () => {
    const jobs = buildQuoteHomeJobsPageReadModel({
      query: '',
      limit: 25,
      nextCursor: 'cursor-2',
      items: [
        {
          id: 'job-1',
          customer_id: 'customer-1',
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
        },
      ],
    })
    const selectedJobVersions = buildQuoteJobVersionsReadModel(rows.slice(1), {
      jobId: 'job-1',
      totalVersions: 2,
      limit: 25,
      nextCursor: null,
    })

    expect(
      buildQuoteHomeBootstrapReadModel({
        summary: buildQuoteHomeSummaryReadModel(rows.map((row) => toQuoteHomeJobVersionItem(row))),
        jobs,
        selectedJobVersions,
      })
    ).toEqual({
      summary: {
        total_versions: 3,
        draft_count: 1,
        sent_or_awaiting_count: 3,
        live_count: 1,
        pipeline_total: 1800,
      },
      jobs,
      selected_job_id: 'job-1',
      selected_job_versions: {
        job_id: 'job-1',
        total_versions: 2,
        limit: 25,
        next_cursor: null,
        items: [
          expect.objectContaining({ estimate_id: 'estimate-2' }),
          expect.objectContaining({ estimate_id: 'estimate-1' }),
        ],
      },
    })
  })

  it('maps already-selected search rows without re-filtering or re-capping them', () => {
    const searchRows = Array.from({ length: 3 }, (_, index) => ({
      ...rows[0],
      id: `estimate-${index + 1}`,
      estimate_id: `estimate-${index + 1}`,
      version_name: `Kitchen Revision ${index + 1}`,
      job_title: 'Kitchen',
      customer_name: 'Alice',
    }))

    const payload = buildQuoteHomeSearchReadModel(searchRows, 'revision')

    expect(payload.query).toBe('revision')
    expect(payload.items).toHaveLength(3)
    expect(payload.items[0]).toEqual(toQuoteHomeSearchResultReadModel(searchRows[0]))
  })

  it('preserves selected rows even for blank queries because search ownership lives upstream', () => {
    expect(buildQuoteHomeSearchReadModel(rows, '   ')).toEqual({
      query: '   ',
      items: rows.map(toQuoteHomeSearchResultReadModel),
    })
  })

  it('returns paged per-job versions independently from capped search results', () => {
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

    const searchPayload = buildQuoteHomeSearchReadModel(expandedRows.slice(0, 8), 'version')
    const jobVersionsPayload = buildQuoteJobVersionsReadModel(expandedRows, {
      jobId: 'job-a',
      totalVersions: 201,
      limit: 25,
      nextCursor: 'cursor-9',
    })

    expect(searchPayload.items).toHaveLength(8)
    expect(jobVersionsPayload.job_id).toBe('job-a')
    expect(jobVersionsPayload.total_versions).toBe(201)
    expect(jobVersionsPayload.limit).toBe(25)
    expect(jobVersionsPayload.next_cursor).toBe('cursor-9')
    expect(jobVersionsPayload.items).toHaveLength(201)
  })
})
