import { describe, expect, it } from 'vitest'
import {
  buildQuoteHomeBootstrapReadModel,
  buildQuoteHomeJobsPageReadModel,
  buildQuoteHomeRecentActivityReadModel,
  buildQuoteHomeSearchReadModel,
  buildQuoteHomeSummaryReadModel,
  buildQuoteJobVersionsReadModel,
  buildQuoteListPayload,
  decorateEstimateCollectionRows,
  QUOTE_HOME_FALLBACK_CUSTOMER_NAME,
  QUOTE_HOME_FALLBACK_JOB_TITLE,
  QUOTE_HOME_FALLBACK_VERSION_KIND,
  QUOTE_HOME_FALLBACK_VERSION_NAME,
  QUOTE_HOME_FALLBACK_VERSION_STATE,
  QUOTE_HOME_SEARCH_SOURCE_RANK,
  selectQuoteHomeSearchRows,
  toQuoteHomeEligibleJobReadModel,
  toQuoteHomeJobVersionItem,
  toQuoteHomeSearchResultReadModel,
} from '../collectionData'
import type { EstimateCollectionDecoratedRow, QuoteHomeJobsPageReadModel } from '../collectionData'

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

describe('quote collection data', () => {
  it('decorates DB estimate rows with DB relation rows in the quote domain layer', () => {
    const decorated = decorateEstimateCollectionRows(
      [
        {
          id: 'estimate-1',
          job_id: 'job-1',
          customer_id: 'customer-1',
          status: 'draft',
          version_name: ' Kitchen ',
          version_state: null,
          version_kind: null,
          version_sort_order: null,
          created_at: '2026-04-21T10:00:00.000Z',
          updated_at: '2026-04-22T10:00:00.000Z',
        },
      ],
      {
        jobs: [{ id: 'job-1', title: ' Kitchen repaint ', status: 'follow_up', estimate_sent_at: null }],
        customers: [{ id: 'customer-1', name: ' Taylor Smith ' }],
        rollups: [{ estimate_id: 'estimate-1', final_total: 1200 }],
      }
    )

    expect(decorated).toEqual([
      expect.objectContaining({
        estimate_id: 'estimate-1',
        version_name: 'Kitchen',
        version_state: QUOTE_HOME_FALLBACK_VERSION_STATE,
        version_kind: QUOTE_HOME_FALLBACK_VERSION_KIND,
        version_sort_order: 0,
        job_title: 'Kitchen repaint',
        customer_name: 'Taylor Smith',
        final_total: 1200,
        is_sent_estimate: true,
      }),
    ])
  })

  it('normalizes eligible jobs and rejects rows without a customer before paging slots are consumed', () => {
    expect(
      toQuoteHomeEligibleJobReadModel({
        id: 'job-ineligible',
        customer_id: null,
        customer_name: null,
        customer_address: null,
        title: 'No customer',
        description: null,
        status: 'estimate_scheduled',
        created_at: null,
        estimate_date: null,
        estimate_sent_at: null,
        scheduled_date: null,
        scheduled_end_date: null,
        scheduled_email_sent_at: null,
        completed_at: null,
        completed_email_sent_at: null,
        closeout_notes: null,
        linked_estimate_id: null,
        version_count: 0,
      })
    ).toBeNull()

    expect(
      toQuoteHomeEligibleJobReadModel({
        id: 'job-1',
        customer_id: 'customer-1',
        customer_name: 'Taylor',
        customer_address: null,
        title: '',
        description: null,
        status: 'not-real',
        created_at: null,
        estimate_date: null,
        estimate_sent_at: null,
        scheduled_date: null,
        scheduled_end_date: null,
        scheduled_email_sent_at: null,
        completed_at: null,
        completed_email_sent_at: null,
        closeout_notes: null,
        linked_estimate_id: null,
        version_count: null,
      })
    ).toEqual(expect.objectContaining({
      id: 'job-1',
      customer_id: 'customer-1',
      title: QUOTE_HOME_FALLBACK_JOB_TITLE,
      status: 'estimate_scheduled',
      version_count: 0,
    }))
  })

  it('makes search ranking and dedupe policy explicit', () => {
    const directOld = { ...rows[2], id: 'estimate-direct-old', updated_at: '2026-04-20T10:00:00.000Z' }
    const jobNew = { ...rows[1], id: 'estimate-job-new', updated_at: '2026-04-24T10:00:00.000Z' }
    const duplicate = { ...rows[0], id: 'estimate-duplicate', updated_at: '2026-04-22T10:00:00.000Z' }

    expect(QUOTE_HOME_SEARCH_SOURCE_RANK).toEqual({ version: 0, job: 1, customer: 2 })
    expect(
      selectQuoteHomeSearchRows({
        query: 'kitchen',
        limit: 3,
        versionRows: [directOld, duplicate],
        jobRows: [jobNew, duplicate],
        customerRows: [duplicate],
      }).map((row) => row.id)
    ).toEqual(['estimate-duplicate', 'estimate-direct-old', 'estimate-job-new'])
  })

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

  it('calculates summary metrics explicitly across states and malformed totals', () => {
    expect(
      buildQuoteHomeSummaryReadModel([
        { version_state: 'draft', final_total: 100, is_sent_estimate: false },
        { version_state: 'live', final_total: 200, is_sent_estimate: true },
        { version_state: 'archived', final_total: 300, is_sent_estimate: false },
        { version_state: 'draft', final_total: null, is_sent_estimate: true },
        { version_state: 'live', final_total: -50, is_sent_estimate: false },
        { version_state: 'live', final_total: Number.NaN, is_sent_estimate: false },
        { version_state: 'draft', final_total: 'invalid', is_sent_estimate: true },
      ])
    ).toEqual({
      total_versions: 7,
      draft_count: 3,
      sent_or_awaiting_count: 3,
      live_count: 3,
      pipeline_total: 300,
    })
  })

  it('returns empty collections without leaking undefined fields', () => {
    expect(buildQuoteListPayload([])).toEqual({ estimates: [] })
    expect(buildQuoteHomeRecentActivityReadModel([])).toEqual({ items: [] })
    expect(buildQuoteHomeSearchReadModel([], 'kitchen')).toEqual({ query: 'kitchen', items: [] })
    expect(
      buildQuoteJobVersionsReadModel([], {
        jobId: 'job-empty',
        totalVersions: 0,
        limit: 25,
        nextCursor: null,
      })
    ).toEqual({
      job_id: 'job-empty',
      total_versions: 0,
      limit: 25,
      next_cursor: null,
      items: [],
    })
  })

  it('normalizes empty decorated rows to required display fallbacks', () => {
    const recent = buildQuoteHomeRecentActivityReadModel([{}]).items[0]
    const search = buildQuoteHomeSearchReadModel([{}], 'missing').items[0]
    const versions = buildQuoteJobVersionsReadModel([{}], {
      jobId: '',
      totalVersions: 1,
      limit: 25,
      nextCursor: null,
    }).items

    const expectedRequiredFields = {
      estimate_id: '',
      job_id: '',
      version_name: QUOTE_HOME_FALLBACK_VERSION_NAME,
      version_state: QUOTE_HOME_FALLBACK_VERSION_STATE,
      version_kind: QUOTE_HOME_FALLBACK_VERSION_KIND,
      job_title: QUOTE_HOME_FALLBACK_JOB_TITLE,
      customer_name: QUOTE_HOME_FALLBACK_CUSTOMER_NAME,
      final_total: null,
      updated_at: null,
      is_sent_estimate: false,
    }

    expect(recent).toEqual(expectedRequiredFields)
    expect(search).toEqual({
      ...expectedRequiredFields,
      customer_id: '',
    })
    expect(versions).toEqual([
      {
        ...expectedRequiredFields,
        customer_id: '',
        version_sort_order: 0,
        created_at: null,
      },
    ])
  })

  it('fills missing names and null timestamps while preserving route-facing ids', () => {
    const malformedRow: Partial<EstimateCollectionDecoratedRow> = {
      id: 'estimate-from-id',
      job_id: 'job-9',
      customer_id: 'customer-9',
      version_name: '   ',
      version_state: '',
      version_kind: '',
      version_sort_order: Number.NaN,
      job_title: '',
      customer_name: '',
      final_total: Number.NaN,
      updated_at: null,
      created_at: null,
      is_sent_estimate: true,
    }

    expect(toQuoteHomeSearchResultReadModel(malformedRow)).toEqual({
      estimate_id: 'estimate-from-id',
      job_id: 'job-9',
      customer_id: 'customer-9',
      version_name: QUOTE_HOME_FALLBACK_VERSION_NAME,
      version_state: QUOTE_HOME_FALLBACK_VERSION_STATE,
      version_kind: QUOTE_HOME_FALLBACK_VERSION_KIND,
      job_title: QUOTE_HOME_FALLBACK_JOB_TITLE,
      customer_name: QUOTE_HOME_FALLBACK_CUSTOMER_NAME,
      updated_at: null,
      final_total: null,
      is_sent_estimate: true,
    })
    expect(toQuoteHomeJobVersionItem(malformedRow)).toEqual({
      estimate_id: 'estimate-from-id',
      job_id: 'job-9',
      customer_id: 'customer-9',
      version_name: QUOTE_HOME_FALLBACK_VERSION_NAME,
      version_state: QUOTE_HOME_FALLBACK_VERSION_STATE,
      version_kind: QUOTE_HOME_FALLBACK_VERSION_KIND,
      version_sort_order: 0,
      job_title: QUOTE_HOME_FALLBACK_JOB_TITLE,
      customer_name: QUOTE_HOME_FALLBACK_CUSTOMER_NAME,
      final_total: null,
      updated_at: null,
      created_at: null,
      is_sent_estimate: true,
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
      items: [makeJob('job-1')],
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

  it('falls back to the first job id when bootstrap has no selected job versions', () => {
    const jobs = buildQuoteHomeJobsPageReadModel({
      query: '',
      limit: 25,
      nextCursor: null,
      items: [makeJob('job-fallback')],
    })

    expect(
      buildQuoteHomeBootstrapReadModel({
        summary: buildQuoteHomeSummaryReadModel([]),
        jobs,
        selectedJobVersions: null,
      })
    ).toEqual({
      summary: {
        total_versions: 0,
        draft_count: 0,
        sent_or_awaiting_count: 0,
        live_count: 0,
        pipeline_total: 0,
      },
      jobs,
      selected_job_id: 'job-fallback',
      selected_job_versions: null,
    })
  })

  it('falls back to the first job id when selected job versions have a blank job id', () => {
    const jobs = buildQuoteHomeJobsPageReadModel({
      query: '',
      limit: 25,
      nextCursor: null,
      items: [makeJob('job-fallback')],
    })

    expect(
      buildQuoteHomeBootstrapReadModel({
        summary: buildQuoteHomeSummaryReadModel([]),
        jobs,
        selectedJobVersions: {
          job_id: '',
          total_versions: 0,
          limit: 25,
          next_cursor: null,
          items: [],
        },
      }).selected_job_id
    ).toBe('job-fallback')
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
