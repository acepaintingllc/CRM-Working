import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  buildQuoteHomeBootstrapReadModel: vi.fn(),
  buildQuoteHomeLatestVersionReadModel: vi.fn(),
  buildQuoteHomeJobsPageReadModel: vi.fn(),
  buildQuoteHomeSummaryFromRow: vi.fn(),
  buildQuoteCreateJobContextReadModel: vi.fn(),
  buildQuoteHomeSearchReadModel: vi.fn(),
  buildQuoteJobVersionsReadModel: vi.fn(),
  buildQuoteListPayload: vi.fn(),
  createEstimateCollectionVersionRecord: vi.fn(),
  decodeQuoteHomeCursor: vi.fn(),
  decorateEstimateCollectionRows: vi.fn(),
  encodeQuoteHomeCursor: vi.fn(),
  loadEstimateCollectionJobContext: vi.fn(),
  loadEstimateCollectionJobVersionsPage: vi.fn(),
  loadEstimateCollectionJobsPage: vi.fn(),
  loadEstimateCollectionRelatedRows: vi.fn(),
  loadEstimateCollectionRowsForOrg: vi.fn(),
  loadEstimateCollectionSummary: vi.fn(),
  normalizeQuoteHomePageLimit: vi.fn(),
  normalizeQuoteHomeSearchQuery: vi.fn(),
  selectQuoteHomeSearchRows: vi.fn(),
  searchEstimateCollectionRows: vi.fn(),
  toQuoteHomeEligibleJobReadModel: vi.fn(),
}))

import {
  createEstimateCollectionVersion,
  loadEstimateCollectionBootstrapPayload,
  loadEstimateCollectionJobVersionsPayload,
  loadEstimateCollectionJobsPayload,
  loadEstimateCollectionPayload,
  loadEstimateCollectionQuoteCreateContextPayload,
  loadEstimateCollectionSearchPayload,
} from '../service.ts'

const deps = {
  buildQuoteHomeBootstrapReadModel: mocks.buildQuoteHomeBootstrapReadModel,
  buildQuoteHomeLatestVersionReadModel: mocks.buildQuoteHomeLatestVersionReadModel,
  buildQuoteHomeJobsPageReadModel: mocks.buildQuoteHomeJobsPageReadModel,
  buildQuoteHomeSummaryFromRow: mocks.buildQuoteHomeSummaryFromRow,
  buildQuoteCreateJobContextReadModel: mocks.buildQuoteCreateJobContextReadModel,
  buildQuoteHomeSearchReadModel: mocks.buildQuoteHomeSearchReadModel,
  buildQuoteJobVersionsReadModel: mocks.buildQuoteJobVersionsReadModel,
  buildQuoteListPayload: mocks.buildQuoteListPayload,
  createEstimateCollectionVersionRecord: mocks.createEstimateCollectionVersionRecord,
  decodeQuoteHomeCursor: mocks.decodeQuoteHomeCursor,
  decorateEstimateCollectionRows: mocks.decorateEstimateCollectionRows,
  encodeQuoteHomeCursor: mocks.encodeQuoteHomeCursor,
  loadEstimateCollectionJobContext: mocks.loadEstimateCollectionJobContext,
  loadEstimateCollectionJobVersionsPage: mocks.loadEstimateCollectionJobVersionsPage,
  loadEstimateCollectionJobsPage: mocks.loadEstimateCollectionJobsPage,
  loadEstimateCollectionRelatedRows: mocks.loadEstimateCollectionRelatedRows,
  loadEstimateCollectionRowsForOrg: mocks.loadEstimateCollectionRowsForOrg,
  loadEstimateCollectionSummary: mocks.loadEstimateCollectionSummary,
  normalizeQuoteHomePageLimit: mocks.normalizeQuoteHomePageLimit,
  normalizeQuoteHomeSearchQuery: mocks.normalizeQuoteHomeSearchQuery,
  selectQuoteHomeSearchRows: mocks.selectQuoteHomeSearchRows,
  searchEstimateCollectionRows: mocks.searchEstimateCollectionRows,
  toQuoteHomeEligibleJobReadModel: mocks.toQuoteHomeEligibleJobReadModel,
}

function makeJobRow(
  id: string,
  createdAt: string,
  customerId: string | null = `customer-${id}`
) {
  return {
    id,
    customer_id: customerId,
    created_at: createdAt,
    title: `Job ${id}`,
    version_count: 0,
  }
}

describe('estimate collection service', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.loadEstimateCollectionRelatedRows.mockResolvedValue({ ok: true, data: { jobs: [], customers: [], rollups: [] } })
    mocks.decorateEstimateCollectionRows.mockImplementation((rows) => rows)
    mocks.toQuoteHomeEligibleJobReadModel.mockImplementation((row) =>
      row?.customer_id ? { ...row, customer_id: row.customer_id, title: row.title ?? 'Job', version_count: row.version_count ?? 0 } : null
    )
    mocks.encodeQuoteHomeCursor.mockImplementation((value) =>
      value?.id ? `${value.timestamp ?? 'null'}::${value.id}` : null
    )
    mocks.decodeQuoteHomeCursor.mockImplementation((cursor) => {
      const raw = String(cursor ?? '').trim()
      if (!raw) return { ok: true, value: null }
      const [timestamp, id] = raw.split('::')
      return { ok: true, value: { timestamp: timestamp === 'null' ? null : timestamp, id } }
    })
    mocks.normalizeQuoteHomePageLimit.mockImplementation((value) =>
      Math.max(1, Math.min(100, Math.trunc(Number(value ?? 25))))
    )
    mocks.normalizeQuoteHomeSearchQuery.mockImplementation((value) => String(value ?? '').trim())
    mocks.buildQuoteHomeJobsPageReadModel.mockImplementation((params) => ({
      query: params.query,
      limit: params.limit,
      next_cursor: params.nextCursor,
      items: params.items,
    }))
  })

  it('builds the collection payload from decorated rows', async () => {
    const rows = [{ id: 'estimate-1' }]
    const decoratedRows = [{ estimate_id: 'estimate-1' }]
    const payload = { estimates: [{ id: 'estimate-1' }] }
    mocks.loadEstimateCollectionRowsForOrg.mockResolvedValue({ ok: true, data: rows })
    mocks.decorateEstimateCollectionRows.mockReturnValue(decoratedRows)
    mocks.buildQuoteListPayload.mockReturnValue(payload)

    await expect(loadEstimateCollectionPayload('org-1', deps)).resolves.toEqual({
      ok: true,
      data: payload,
    })
    expect(mocks.loadEstimateCollectionRelatedRows).toHaveBeenCalledWith('org-1', rows, {
      includeRollups: false,
    })
    expect(mocks.decorateEstimateCollectionRows).toHaveBeenCalledWith(rows, { jobs: [], customers: [], rollups: [] })
    expect(mocks.buildQuoteListPayload).toHaveBeenCalledWith(decoratedRows)
  })

  it('builds the bootstrap payload from summary, paged jobs, and selected job versions', async () => {
    const summary = {
      total_versions: 3,
      draft_count: 1,
      sent_or_awaiting_count: 1,
      live_count: 1,
      pipeline_total: 1800,
    }
    const jobsPage = {
      query: '',
      limit: 25,
      rows: [{ id: 'job-1', customer_id: 'customer-1', created_at: '2026-04-24T12:00:00.000Z', title: 'Kitchen' }],
    }
    const jobItems = [{ id: 'job-1', customer_id: 'customer-1', title: 'Kitchen' }]
    const jobsPayload = {
      query: '',
      limit: 25,
      next_cursor: null,
      items: jobItems,
    }
    const versionsPage = {
      jobId: 'job-1',
      totalVersions: 2,
      limit: 25,
      rows: [{ id: 'estimate-1', job_id: 'job-1' }],
    }
    const decoratedRows = [{ estimate_id: 'estimate-1', job_id: 'job-1' }]
    const selectedJobVersions = {
      job_id: 'job-1',
      total_versions: 2,
      limit: 25,
      next_cursor: null,
      items: decoratedRows,
    }
    const latestVersionRows = [{ id: 'estimate-latest', job_id: 'job-1' }]
    const latestVersion = { estimate_id: 'estimate-latest', job_id: 'job-1' }
    const payload = {
      summary,
      jobs: jobsPayload,
      selected_job_id: 'job-1',
      selected_job_versions: selectedJobVersions,
      latest_version: latestVersion,
    }

    mocks.loadEstimateCollectionSummary.mockResolvedValue({ ok: true, data: summary })
    mocks.loadEstimateCollectionJobsPage.mockResolvedValue({ ok: true, data: jobsPage })
    mocks.loadEstimateCollectionRowsForOrg.mockResolvedValue({ ok: true, data: latestVersionRows })
    mocks.loadEstimateCollectionJobVersionsPage.mockResolvedValue({ ok: true, data: versionsPage })
    mocks.buildQuoteHomeSummaryFromRow.mockReturnValue(summary)
    mocks.decorateEstimateCollectionRows.mockReturnValue(decoratedRows)
    mocks.toQuoteHomeEligibleJobReadModel.mockReturnValue(jobItems[0])
    mocks.buildQuoteHomeJobsPageReadModel.mockReturnValue(jobsPayload)
    mocks.buildQuoteJobVersionsReadModel.mockReturnValue(selectedJobVersions)
    mocks.buildQuoteHomeLatestVersionReadModel.mockReturnValue(latestVersion)
    mocks.buildQuoteHomeBootstrapReadModel.mockReturnValue(payload)

    await expect(loadEstimateCollectionBootstrapPayload('org-1', deps)).resolves.toEqual({
      ok: true,
      data: payload,
    })
    expect(mocks.loadEstimateCollectionSummary).toHaveBeenCalledWith('org-1')
    expect(mocks.loadEstimateCollectionRowsForOrg).toHaveBeenCalledWith('org-1', { limit: 1 })
    expect(mocks.loadEstimateCollectionJobsPage).toHaveBeenCalledWith('org-1', {
      query: '',
      limit: 25,
      cursor: null,
    })
    expect(mocks.loadEstimateCollectionJobVersionsPage).toHaveBeenCalledWith('org-1', 'job-1', {
      limit: 25,
      cursor: null,
    })
    expect(mocks.loadEstimateCollectionRelatedRows).toHaveBeenCalledWith('org-1', versionsPage.rows, {
      includeRollups: true,
    })
    expect(mocks.loadEstimateCollectionRelatedRows).toHaveBeenCalledWith('org-1', latestVersionRows, {
      includeRollups: true,
    })
    expect(mocks.buildQuoteHomeLatestVersionReadModel).toHaveBeenCalledWith(decoratedRows)
    expect(mocks.buildQuoteHomeJobsPageReadModel).toHaveBeenCalledWith({
      query: '',
      limit: 25,
      nextCursor: null,
      items: jobItems,
    })
    expect(mocks.buildQuoteJobVersionsReadModel).toHaveBeenCalledWith(decoratedRows, {
      jobId: 'job-1',
      totalVersions: 2,
      limit: 25,
      nextCursor: null,
    })
    expect(mocks.buildQuoteHomeBootstrapReadModel).toHaveBeenCalledWith({
      summary,
      jobs: jobsPayload,
      selectedJobVersions,
      latestVersion,
    })
  })

  it('builds search payloads from decorated rows', async () => {
    const rows = [{ id: 'estimate-1', job_id: 'job-1' }]
    const decoratedRows = [{ estimate_id: 'estimate-1', job_id: 'job-1' }]
    const searchPayload = { query: 'kitchen', items: decoratedRows }

    mocks.searchEstimateCollectionRows.mockResolvedValue({
      ok: true,
      data: { query: 'kitchen', candidateLimit: 32, versionRows: rows, jobRows: [], customerRows: [] },
    })
    mocks.selectQuoteHomeSearchRows.mockReturnValue(rows)
    mocks.decorateEstimateCollectionRows.mockReturnValue(decoratedRows)
    mocks.buildQuoteHomeSearchReadModel.mockReturnValue(searchPayload)

    await expect(loadEstimateCollectionSearchPayload('org-1', 'kitchen', deps)).resolves.toEqual({
      ok: true,
      data: searchPayload,
    })
    expect(mocks.searchEstimateCollectionRows).toHaveBeenCalledWith('org-1', 'kitchen', 32)
    expect(mocks.selectQuoteHomeSearchRows).toHaveBeenCalledWith({
      query: 'kitchen',
      candidateLimit: 32,
      limit: 8,
      versionRows: rows,
      jobRows: [],
      customerRows: [],
    })
    expect(mocks.buildQuoteHomeSearchReadModel).toHaveBeenCalledWith(decoratedRows, 'kitchen')
  })

  it('returns an empty search read model without repository work for blank queries', async () => {
    const payload = { query: '', items: [] }
    mocks.buildQuoteHomeSearchReadModel.mockReturnValue(payload)

    await expect(loadEstimateCollectionSearchPayload('org-1', '   ', deps)).resolves.toEqual({
      ok: true,
      data: payload,
    })

    expect(mocks.searchEstimateCollectionRows).not.toHaveBeenCalled()
    expect(mocks.selectQuoteHomeSearchRows).not.toHaveBeenCalled()
    expect(mocks.buildQuoteHomeSearchReadModel).toHaveBeenCalledWith([], '')
  })

  it('builds jobs and job version payloads through the paging read-model builders', async () => {
    const jobsPage = {
      query: 'kit',
      limit: 10,
      rows: [{ id: 'job-1', customer_id: 'customer-1', created_at: '2026-04-24T12:00:00.000Z', title: 'Kitchen' }],
    }
    const jobItems = [{ id: 'job-1', customer_id: 'customer-1', title: 'Kitchen' }]
    const jobsPayload = {
      query: 'kit',
      limit: 10,
      next_cursor: null,
      items: jobItems,
    }
    const versionsPage = {
      jobId: 'job-1',
      totalVersions: 1,
      limit: 10,
      rows: [{ id: 'estimate-1', job_id: 'job-1' }],
    }
    const decoratedRows = [{ estimate_id: 'estimate-1', job_id: 'job-1' }]
    const versionsPayload = {
      job_id: 'job-1',
      total_versions: 1,
      limit: 10,
      next_cursor: null,
      items: decoratedRows,
    }

    mocks.loadEstimateCollectionJobsPage.mockResolvedValue({ ok: true, data: jobsPage })
    mocks.toQuoteHomeEligibleJobReadModel.mockReturnValue(jobItems[0])
    mocks.buildQuoteHomeJobsPageReadModel.mockReturnValue(jobsPayload)
    mocks.loadEstimateCollectionJobVersionsPage.mockResolvedValue({ ok: true, data: versionsPage })
    mocks.decorateEstimateCollectionRows.mockReturnValue(decoratedRows)
    mocks.buildQuoteJobVersionsReadModel.mockReturnValue(versionsPayload)

    await expect(
      loadEstimateCollectionJobsPayload(
        'org-1',
        {
          query: 'kit',
          limit: 10,
          cursor: '2026-04-24T12:00:00.000Z::33333333-3333-4333-8333-333333333333',
        },
        deps
      )
    ).resolves.toEqual({
      ok: true,
      data: jobsPayload,
    })
    expect(mocks.loadEstimateCollectionJobsPage).toHaveBeenCalledWith('org-1', {
      query: 'kit',
      limit: 10,
      cursor: {
        timestamp: '2026-04-24T12:00:00.000Z',
        id: '33333333-3333-4333-8333-333333333333',
      },
    })
    expect(mocks.buildQuoteHomeJobsPageReadModel).toHaveBeenCalledWith({
      query: 'kit',
      limit: 10,
      nextCursor: null,
      items: jobItems,
    })

    await expect(
      loadEstimateCollectionJobVersionsPayload(
        'org-1',
        'job-1',
        {
          limit: 10,
          cursor: '2026-04-24T11:00:00.000Z::22222222-2222-4222-8222-222222222222',
        },
        deps
      )
    ).resolves.toEqual({
      ok: true,
      data: versionsPayload,
    })
    expect(mocks.loadEstimateCollectionJobVersionsPage).toHaveBeenCalledWith('org-1', 'job-1', {
      limit: 10,
      cursor: {
        timestamp: '2026-04-24T11:00:00.000Z',
        id: '22222222-2222-4222-8222-222222222222',
      },
    })
    expect(mocks.loadEstimateCollectionRelatedRows).toHaveBeenCalledWith('org-1', versionsPage.rows, {
      includeRollups: true,
    })
    expect(mocks.decorateEstimateCollectionRows).toHaveBeenCalledWith(versionsPage.rows, {
      jobs: [],
      customers: [],
      rollups: [],
    })
    expect(mocks.buildQuoteJobVersionsReadModel).toHaveBeenCalledWith(decoratedRows, {
      jobId: 'job-1',
      totalVersions: 1,
      limit: 10,
      nextCursor: null,
    })
  })

  it('builds quote-create context from the direct job context read model', async () => {
    const jobRow = {
      id: 'job-1',
      customer_id: 'customer-1',
      customer_name: 'Alice',
      customer_address: '123 Main',
      title: 'Kitchen',
    }
    const payload = {
      job: {
        ...jobRow,
        eligibility: { eligible: true, reason: 'eligible' },
      },
    }

    mocks.loadEstimateCollectionJobContext.mockResolvedValue({ ok: true, data: jobRow })
    mocks.buildQuoteCreateJobContextReadModel.mockReturnValue(payload)

    await expect(
      loadEstimateCollectionQuoteCreateContextPayload('org-1', 'job-1', deps)
    ).resolves.toEqual({
      ok: true,
      data: payload,
    })
    expect(mocks.loadEstimateCollectionJobContext).toHaveBeenCalledWith('org-1', 'job-1')
    expect(mocks.buildQuoteCreateJobContextReadModel).toHaveBeenCalledWith(jobRow)
  })

  it('keeps missing quote-create jobs explicit as not found', async () => {
    mocks.loadEstimateCollectionJobContext.mockResolvedValue({ ok: true, data: null })

    await expect(
      loadEstimateCollectionQuoteCreateContextPayload('org-1', 'missing-job', deps)
    ).resolves.toEqual({
      ok: false,
      kind: 'not_found',
      message: 'Job not found.',
    })
    expect(mocks.buildQuoteCreateJobContextReadModel).not.toHaveBeenCalled()
  })

  it('returns ineligible quote-create jobs instead of filtering them out', async () => {
    const jobRow = {
      id: 'job-1',
      customer_id: null,
      customer_name: null,
      customer_address: null,
      title: 'Kitchen',
    }
    const payload = {
      job: {
        ...jobRow,
        eligibility: { eligible: false, reason: 'missing_customer' },
      },
    }

    mocks.loadEstimateCollectionJobContext.mockResolvedValue({ ok: true, data: jobRow })
    mocks.buildQuoteCreateJobContextReadModel.mockReturnValue(payload)

    await expect(
      loadEstimateCollectionQuoteCreateContextPayload('org-1', 'job-1', deps)
    ).resolves.toEqual({
      ok: true,
      data: payload,
    })
  })

  it('builds the first jobs page from one bounded repository page with ineligible rows before eligible rows', async () => {
    const rows = [
      { id: 'job-4', customer_id: null, created_at: '2026-04-24T14:00:00.000Z', title: 'No customer' },
      { id: 'job-3', customer_id: 'customer-3', created_at: '2026-04-24T13:00:00.000Z', title: 'Kitchen' },
      { id: 'job-2', customer_id: 'customer-2', created_at: '2026-04-24T12:00:00.000Z', title: 'Garage' },
    ]
    const pagePayload = {
      query: '',
      limit: 2,
      next_cursor: '2026-04-24T12:00:00.000Z::job-2',
      items: [
        {
          id: 'job-3',
          customer_id: 'customer-3',
          title: 'Kitchen',
          created_at: '2026-04-24T13:00:00.000Z',
        },
        {
          id: 'job-2',
          customer_id: 'customer-2',
          title: 'Garage',
          created_at: '2026-04-24T12:00:00.000Z',
        },
      ],
    }

    mocks.loadEstimateCollectionJobsPage.mockResolvedValueOnce({
      ok: true,
      data: { query: '', limit: 2, rows },
    })
    mocks.toQuoteHomeEligibleJobReadModel.mockImplementation((row) =>
      row.customer_id
        ? { id: row.id, customer_id: row.customer_id, title: row.title, created_at: row.created_at }
        : null
    )
    mocks.buildQuoteHomeJobsPageReadModel.mockReturnValue(pagePayload)

    await expect(loadEstimateCollectionJobsPayload('org-1', { limit: 2 }, deps)).resolves.toEqual({
      ok: true,
      data: pagePayload,
    })

    expect(mocks.loadEstimateCollectionJobsPage).toHaveBeenNthCalledWith(1, 'org-1', {
      query: '',
      limit: 2,
      cursor: null,
    })
    expect(mocks.loadEstimateCollectionJobsPage).toHaveBeenCalledTimes(1)
    expect(mocks.buildQuoteHomeJobsPageReadModel).toHaveBeenCalledWith({
      query: '',
      limit: 2,
      nextCursor: '2026-04-24T12:00:00.000Z::job-2',
      items: pagePayload.items,
    })
  })

  it('returns an empty jobs page without a next cursor', async () => {
    mocks.loadEstimateCollectionJobsPage.mockResolvedValueOnce({
      ok: true,
      data: { query: '', limit: 2, rows: [] },
    })

    await expect(loadEstimateCollectionJobsPayload('org-1', { limit: 2 }, deps)).resolves.toEqual({
      ok: true,
      data: {
        query: '',
        limit: 2,
        next_cursor: null,
        items: [],
      },
    })
  })

  it('returns a partial final jobs page after eligibility filtering', async () => {
    const rows = [
      makeJobRow('job-3', '2026-04-24T13:00:00.000Z', null),
      makeJobRow('job-2', '2026-04-24T12:00:00.000Z', 'customer-2'),
    ]

    mocks.loadEstimateCollectionJobsPage.mockResolvedValueOnce({
      ok: true,
      data: { query: 'kit', limit: 3, rows },
    })

    const result = await loadEstimateCollectionJobsPayload('org-1', {
      query: 'kit',
      limit: 3,
    }, deps)

    expect(result).toEqual({
      ok: true,
      data: {
        query: 'kit',
        limit: 3,
        next_cursor: null,
        items: [expect.objectContaining({ id: 'job-2' })],
      },
    })
  })

  it('returns an exact-limit final jobs page without a next cursor', async () => {
    const rows = [
      makeJobRow('job-3', '2026-04-24T13:00:00.000Z', 'customer-3'),
      makeJobRow('job-2', '2026-04-24T12:00:00.000Z', 'customer-2'),
    ]

    mocks.loadEstimateCollectionJobsPage.mockResolvedValueOnce({
      ok: true,
      data: { query: '', limit: 2, rows },
    })

    const result = await loadEstimateCollectionJobsPayload('org-1', { limit: 2 }, deps)

    expect(result).toEqual({
      ok: true,
      data: {
        query: '',
        limit: 2,
        next_cursor: null,
        items: [
          expect.objectContaining({ id: 'job-3' }),
          expect.objectContaining({ id: 'job-2' }),
        ],
      },
    })
  })

  it('returns over-limit jobs pages with a cursor from the last returned eligible job', async () => {
    const rows = [
      makeJobRow('job-4', '2026-04-24T14:00:00.000Z', 'customer-4'),
      makeJobRow('job-3', '2026-04-24T13:00:00.000Z', 'customer-3'),
      makeJobRow('job-2', '2026-04-24T12:00:00.000Z', 'customer-2'),
    ]

    mocks.loadEstimateCollectionJobsPage.mockResolvedValueOnce({
      ok: true,
      data: { query: '', limit: 2, rows },
    })

    const result = await loadEstimateCollectionJobsPayload('org-1', { limit: 2 }, deps)

    expect(result).toEqual({
      ok: true,
      data: {
        query: '',
        limit: 2,
        next_cursor: '2026-04-24T13:00:00.000Z::job-3',
        items: [
          expect.objectContaining({ id: 'job-4' }),
          expect.objectContaining({ id: 'job-3' }),
        ],
      },
    })
  })

  it('returns 100 jobs and a next cursor when a max-size jobs page has more rows', async () => {
    const rows = Array.from({ length: 101 }, (_, index) => {
      const createdAt = new Date(Date.UTC(2026, 3, 24, 12, 0, 0) - index * 1000).toISOString()
      return makeJobRow(`job-${String(index + 1).padStart(3, '0')}`, createdAt, `customer-${index + 1}`)
    })
    const lastReturnedRow = rows[99]

    mocks.loadEstimateCollectionJobsPage.mockResolvedValueOnce({
      ok: true,
      data: { query: '', limit: 100, rows },
    })

    const result = await loadEstimateCollectionJobsPayload('org-1', { limit: 100 }, deps)

    expect(result).toEqual({
      ok: true,
      data: {
        query: '',
        limit: 100,
        next_cursor: `${lastReturnedRow.created_at}::${lastReturnedRow.id}`,
        items: expect.arrayContaining([
          expect.objectContaining({ id: rows[0].id }),
          expect.objectContaining({ id: lastReturnedRow.id }),
        ]),
      },
    })
    expect(result.ok ? result.data.items : []).toHaveLength(100)
    expect(result.ok ? result.data.items : []).not.toContainEqual(
      expect.objectContaining({ id: rows[100].id })
    )
    expect(mocks.loadEstimateCollectionJobsPage).toHaveBeenCalledWith('org-1', {
      query: '',
      limit: 100,
      cursor: null,
    })
    expect(mocks.loadEstimateCollectionJobsPage).toHaveBeenCalledTimes(1)
  })

  it('does not scan extra pages when many ineligible rows appear in a bounded repository page', async () => {
    const rows = [
      makeJobRow('job-4', '2026-04-24T14:00:00.000Z', 'customer-4'),
      makeJobRow('job-3', '2026-04-24T13:00:00.000Z', null),
      makeJobRow('job-2', '2026-04-24T12:00:00.000Z', null),
      makeJobRow('job-1', '2026-04-24T11:00:00.000Z', null),
    ]

    mocks.loadEstimateCollectionJobsPage.mockResolvedValueOnce({
      ok: true,
      data: { query: '', limit: 2, rows },
    })

    const result = await loadEstimateCollectionJobsPayload('org-1', { limit: 2 }, deps)

    expect(result).toEqual({
      ok: true,
      data: {
        query: '',
        limit: 2,
        next_cursor: '2026-04-24T14:00:00.000Z::job-4',
        items: [
          expect.objectContaining({ id: 'job-4' }),
        ],
      },
    })
    expect(mocks.loadEstimateCollectionJobsPage).toHaveBeenCalledTimes(1)
  })

  it('rejects invalid page cursors before repository work', async () => {
    mocks.decodeQuoteHomeCursor.mockReturnValueOnce({
      ok: false,
      message: 'Invalid cursor.',
    })

    await expect(
      loadEstimateCollectionJobsPayload('org-1', { cursor: 'bad' }, deps)
    ).resolves.toEqual({
      ok: false,
      kind: 'invalid_input',
      message: 'Invalid cursor.',
    })
    expect(mocks.loadEstimateCollectionJobsPage).not.toHaveBeenCalled()

    mocks.decodeQuoteHomeCursor.mockReturnValueOnce({
      ok: false,
      message: 'Invalid cursor.',
    })

    await expect(
      loadEstimateCollectionJobVersionsPayload('org-1', 'job-1', { cursor: 'bad' }, deps)
    ).resolves.toEqual({
      ok: false,
      kind: 'invalid_input',
      message: 'Invalid cursor.',
    })
    expect(mocks.loadEstimateCollectionJobVersionsPage).not.toHaveBeenCalled()
  })

  it('delegates version creation to the repository write boundary', async () => {
    const params = {
      orgId: 'org-1',
      userId: 'user-1',
      body: { job_id: 'job-1' },
      copy: { createdNotice: 'Estimate version created.', defaultVersionLabel: 'Estimate Version' },
    }
    const result = { ok: true, data: { id: 'estimate-1', estimate: { id: 'estimate-1' } } }
    mocks.createEstimateCollectionVersionRecord.mockResolvedValue(result)

    await expect(createEstimateCollectionVersion(params, deps)).resolves.toEqual(result)
    expect(mocks.createEstimateCollectionVersionRecord).toHaveBeenCalledWith(params)
  })
})
