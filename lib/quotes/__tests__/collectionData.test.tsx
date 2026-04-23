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
} from '../collectionData'

const rows = [
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
    status: 'draft',
    raw_version_name: 'Kitchen Original',
    raw_version_state: 'draft',
    raw_version_kind: 'standard',
    raw_version_sort_order: 1,
    version_name: 'Kitchen Original',
    version_state: 'draft',
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
      id: 'estimate-2',
      job_id: 'job-1',
      customer_id: 'customer-1',
      status: 'live',
      version_name: 'Kitchen Revision',
      version_state: 'live',
      version_kind: 'revision',
      version_sort_order: 2,
      updated_at: '2026-04-21T10:00:00.000Z',
      created_at: '2026-04-20T10:00:00.000Z',
      job_title: 'Kitchen',
      job_status: 'estimate_sent',
      job_estimate_sent_at: '2026-04-21T00:00:00.000Z',
      is_sent_estimate: true,
      customer_name: 'Alice',
    })
  })

  it('builds summary metrics from version read models', () => {
    expect(buildQuoteHomeSummaryReadModel(rows.map((row) => toQuoteHomeJobVersionItem(row)))).toEqual({
      total_versions: 2,
      draft_count: 1,
      sent_or_awaiting_count: 2,
      live_count: 1,
      pipeline_total: 2200,
    })
  })

  it('builds the jobs page, bootstrap payload, search payload, and job versions with explicit windows', () => {
    const jobsPage = buildQuoteHomeJobsPageReadModel({
      query: 'kit',
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
          estimate_date: null,
          estimate_sent_at: null,
          scheduled_date: null,
          completed_at: null,
          version_count: 2,
        },
      ],
    })

<<<<<<< Updated upstream
  it('filters search results case-insensitively and caps them at 8', () => {
    const searchRows = Array.from({ length: 10 }, (_, index) => ({
      ...rows[0],
      id: `estimate-${index + 1}`,
      estimate_id: `estimate-${index + 1}`,
      version_name: `Kitchen Revision ${index + 1}`,
      job_title: 'Kitchen',
      customer_name: 'Alice',
    }))
=======
    const versions = buildQuoteJobVersionsReadModel(rows, {
      jobId: 'job-1',
      totalVersions: 2,
      limit: 25,
      nextCursor: null,
    })
>>>>>>> Stashed changes

    expect(
      buildQuoteHomeBootstrapReadModel({
        summary: buildQuoteHomeSummaryReadModel(rows.map((row) => toQuoteHomeJobVersionItem(row))),
        jobs: jobsPage,
        selectedJobVersions: versions,
      })
    ).toEqual({
      summary: {
        total_versions: 2,
        draft_count: 1,
        sent_or_awaiting_count: 2,
        live_count: 1,
        pipeline_total: 2200,
      },
      jobs: jobsPage,
      selected_job_id: 'job-1',
      selected_job_versions: versions,
    })

<<<<<<< Updated upstream
    expect(payload.query).toBe('revision')
    expect(payload.items).toHaveLength(8)
    expect(payload.items[0]).toEqual(toQuoteHomeJobVersionItem(searchRows[0]))
  })

  it('returns an empty item list for blank search queries', () => {
    expect(buildQuoteHomeSearchReadModel(rows, '   ')).toEqual({
      query: '   ',
      items: [],
=======
    expect(buildQuoteHomeSearchReadModel(rows, 'revision', 8)).toEqual({
      query: 'revision',
      limit: 8,
      items: rows.map(toQuoteHomeSearchResultReadModel),
>>>>>>> Stashed changes
    })

<<<<<<< Updated upstream
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
=======
    expect(buildQuoteHomeRecentActivityReadModel(rows).items).toHaveLength(2)
    expect(versions.total_versions).toBe(2)
    expect(versions.limit).toBe(25)
>>>>>>> Stashed changes
  })
})
