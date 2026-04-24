import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  buildQuoteHomeBootstrapReadModel: vi.fn(),
  buildQuoteHomeJobsPageReadModel: vi.fn(),
  buildQuoteHomeRecentActivityReadModel: vi.fn(),
  buildQuoteHomeSummaryFromRow: vi.fn(),
  buildQuoteHomeSearchReadModel: vi.fn(),
  buildQuoteJobVersionsReadModel: vi.fn(),
  buildQuoteListPayload: vi.fn(),
  createEstimateCollectionVersionRecord: vi.fn(),
  decorateEstimateCollectionRows: vi.fn(),
  encodeQuoteHomeCursor: vi.fn(),
  loadEstimateCollectionJobVersionsPage: vi.fn(),
  loadEstimateCollectionJobsPage: vi.fn(),
  loadEstimateCollectionRelatedRows: vi.fn(),
  loadEstimateCollectionRowsForOrg: vi.fn(),
  loadEstimateCollectionSummary: vi.fn(),
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
  loadEstimateCollectionRecentActivityPayload,
  loadEstimateCollectionSearchPayload,
  loadEstimateCollectionSummaryPayload,
} from '../service.ts'

const deps = {
  buildQuoteHomeBootstrapReadModel: mocks.buildQuoteHomeBootstrapReadModel,
  buildQuoteHomeJobsPageReadModel: mocks.buildQuoteHomeJobsPageReadModel,
  buildQuoteHomeRecentActivityReadModel: mocks.buildQuoteHomeRecentActivityReadModel,
  buildQuoteHomeSummaryFromRow: mocks.buildQuoteHomeSummaryFromRow,
  buildQuoteHomeSearchReadModel: mocks.buildQuoteHomeSearchReadModel,
  buildQuoteJobVersionsReadModel: mocks.buildQuoteJobVersionsReadModel,
  buildQuoteListPayload: mocks.buildQuoteListPayload,
  createEstimateCollectionVersionRecord: mocks.createEstimateCollectionVersionRecord,
  decorateEstimateCollectionRows: mocks.decorateEstimateCollectionRows,
  encodeQuoteHomeCursor: mocks.encodeQuoteHomeCursor,
  loadEstimateCollectionJobVersionsPage: mocks.loadEstimateCollectionJobVersionsPage,
  loadEstimateCollectionJobsPage: mocks.loadEstimateCollectionJobsPage,
  loadEstimateCollectionRelatedRows: mocks.loadEstimateCollectionRelatedRows,
  loadEstimateCollectionRowsForOrg: mocks.loadEstimateCollectionRowsForOrg,
  loadEstimateCollectionSummary: mocks.loadEstimateCollectionSummary,
  selectQuoteHomeSearchRows: mocks.selectQuoteHomeSearchRows,
  searchEstimateCollectionRows: mocks.searchEstimateCollectionRows,
  toQuoteHomeEligibleJobReadModel: mocks.toQuoteHomeEligibleJobReadModel,
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

  it('returns the summary payload from the repository summary loader', async () => {
    const row = { total_versions: 2, pipeline_total: 1500 }
    const payload = { total_versions: 2, pipeline_total: 1500 }
    mocks.loadEstimateCollectionSummary.mockResolvedValue({ ok: true, data: row })
    mocks.buildQuoteHomeSummaryFromRow.mockReturnValue(payload)

    await expect(loadEstimateCollectionSummaryPayload('org-1', deps)).resolves.toEqual({
      ok: true,
      data: payload,
    })
    expect(mocks.loadEstimateCollectionSummary).toHaveBeenCalledWith('org-1')
    expect(mocks.buildQuoteHomeSummaryFromRow).toHaveBeenCalledWith(row)
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
      nextCursor: null,
      items: [{ id: 'estimate-1', job_id: 'job-1' }],
    }
    const decoratedRows = [{ estimate_id: 'estimate-1', job_id: 'job-1' }]
    const selectedJobVersions = {
      job_id: 'job-1',
      total_versions: 2,
      limit: 25,
      next_cursor: null,
      items: decoratedRows,
    }
    const payload = {
      summary,
      jobs: jobsPayload,
      selected_job_id: 'job-1',
      selected_job_versions: selectedJobVersions,
    }

    mocks.loadEstimateCollectionSummary.mockResolvedValue({ ok: true, data: summary })
    mocks.loadEstimateCollectionJobsPage.mockResolvedValue({ ok: true, data: jobsPage })
    mocks.loadEstimateCollectionJobVersionsPage.mockResolvedValue({ ok: true, data: versionsPage })
    mocks.buildQuoteHomeSummaryFromRow.mockReturnValue(summary)
    mocks.decorateEstimateCollectionRows.mockReturnValue(decoratedRows)
    mocks.toQuoteHomeEligibleJobReadModel.mockReturnValue(jobItems[0])
    mocks.buildQuoteHomeJobsPageReadModel.mockReturnValue(jobsPayload)
    mocks.buildQuoteJobVersionsReadModel.mockReturnValue(selectedJobVersions)
    mocks.buildQuoteHomeBootstrapReadModel.mockReturnValue(payload)

    await expect(loadEstimateCollectionBootstrapPayload('org-1', deps)).resolves.toEqual({
      ok: true,
      data: payload,
    })
    expect(mocks.loadEstimateCollectionSummary).toHaveBeenCalledWith('org-1')
    expect(mocks.loadEstimateCollectionJobsPage).toHaveBeenCalledWith('org-1', { limit: 25 })
    expect(mocks.loadEstimateCollectionJobVersionsPage).toHaveBeenCalledWith('org-1', 'job-1', {
      limit: 25,
    })
    expect(mocks.loadEstimateCollectionRelatedRows).toHaveBeenCalledWith('org-1', versionsPage.items, {
      includeRollups: true,
    })
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
    })
  })

  it('builds recent activity and search payloads from decorated rows', async () => {
    const rows = [{ id: 'estimate-1', job_id: 'job-1' }]
    const decoratedRows = [{ estimate_id: 'estimate-1', job_id: 'job-1' }]
    const recentActivityPayload = { items: decoratedRows }
    const searchPayload = { query: 'kitchen', items: decoratedRows }

    mocks.loadEstimateCollectionRowsForOrg.mockResolvedValue({ ok: true, data: rows })
    mocks.searchEstimateCollectionRows.mockResolvedValue({
      ok: true,
      data: { query: 'kitchen', limit: 8, versionRows: rows, jobRows: [], customerRows: [] },
    })
    mocks.selectQuoteHomeSearchRows.mockReturnValue(rows)
    mocks.decorateEstimateCollectionRows.mockReturnValue(decoratedRows)
    mocks.buildQuoteHomeRecentActivityReadModel.mockReturnValue(recentActivityPayload)
    mocks.buildQuoteHomeSearchReadModel.mockReturnValue(searchPayload)

    await expect(loadEstimateCollectionRecentActivityPayload('org-1', deps)).resolves.toEqual({
      ok: true,
      data: recentActivityPayload,
    })
    expect(mocks.loadEstimateCollectionRowsForOrg).toHaveBeenCalledWith('org-1', { limit: 12 })

    await expect(loadEstimateCollectionSearchPayload('org-1', 'kitchen', deps)).resolves.toEqual({
      ok: true,
      data: searchPayload,
    })
    expect(mocks.searchEstimateCollectionRows).toHaveBeenCalledWith('org-1', 'kitchen', 8)
    expect(mocks.selectQuoteHomeSearchRows).toHaveBeenCalledWith({
      query: 'kitchen',
      limit: 8,
      versionRows: rows,
      jobRows: [],
      customerRows: [],
    })
    expect(mocks.buildQuoteHomeSearchReadModel).toHaveBeenCalledWith(decoratedRows, 'kitchen')
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
      nextCursor: 'cursor-4',
      items: [{ id: 'estimate-1', job_id: 'job-1' }],
    }
    const decoratedRows = [{ estimate_id: 'estimate-1', job_id: 'job-1' }]
    const versionsPayload = {
      job_id: 'job-1',
      total_versions: 1,
      limit: 10,
      next_cursor: 'cursor-4',
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
        { query: 'kit', limit: 10, cursor: 'cursor-2' },
        deps
      )
    ).resolves.toEqual({
      ok: true,
      data: jobsPayload,
    })
    expect(mocks.loadEstimateCollectionJobsPage).toHaveBeenCalledWith('org-1', {
      query: 'kit',
      limit: 10,
      cursor: 'cursor-2',
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
        { limit: 10, cursor: 'cursor-3' },
        deps
      )
    ).resolves.toEqual({
      ok: true,
      data: versionsPayload,
    })
    expect(mocks.loadEstimateCollectionJobVersionsPage).toHaveBeenCalledWith('org-1', 'job-1', {
      limit: 10,
      cursor: 'cursor-3',
    })
    expect(mocks.loadEstimateCollectionRelatedRows).toHaveBeenCalledWith('org-1', versionsPage.items, {
      includeRollups: true,
    })
    expect(mocks.decorateEstimateCollectionRows).toHaveBeenCalledWith(versionsPage.items, {
      jobs: [],
      customers: [],
      rollups: [],
    })
    expect(mocks.buildQuoteJobVersionsReadModel).toHaveBeenCalledWith(decoratedRows, {
      jobId: 'job-1',
      totalVersions: 1,
      limit: 10,
      nextCursor: 'cursor-4',
    })
  })

  it('fills job pages after eligibility filtering and cursors from the last returned eligible row', async () => {
    const firstRows = [
      { id: 'job-4', customer_id: null, created_at: '2026-04-24T14:00:00.000Z', title: 'No customer' },
      { id: 'job-3', customer_id: 'customer-3', created_at: '2026-04-24T13:00:00.000Z', title: 'Kitchen' },
      { id: 'job-2', customer_id: null, created_at: '2026-04-24T12:00:00.000Z', title: 'No customer' },
    ]
    const secondRows = [
      { id: 'job-1', customer_id: 'customer-1', created_at: '2026-04-24T11:00:00.000Z', title: 'Garage' },
      { id: 'job-0', customer_id: 'customer-0', created_at: '2026-04-24T10:00:00.000Z', title: 'Bath' },
    ]
    const pagePayload = {
      query: '',
      limit: 2,
      next_cursor: '2026-04-24T11:00:00.000Z::job-1',
      items: [
        { id: 'job-3', customer_id: 'customer-3', title: 'Kitchen' },
        { id: 'job-1', customer_id: 'customer-1', title: 'Garage' },
      ],
    }

    mocks.loadEstimateCollectionJobsPage
      .mockResolvedValueOnce({ ok: true, data: { query: '', limit: 2, rows: firstRows } })
      .mockResolvedValueOnce({ ok: true, data: { query: '', limit: 2, rows: secondRows } })
    mocks.toQuoteHomeEligibleJobReadModel.mockImplementation((row) =>
      row.customer_id ? { id: row.id, customer_id: row.customer_id, title: row.title } : null
    )
    mocks.buildQuoteHomeJobsPageReadModel.mockReturnValue(pagePayload)

    await expect(loadEstimateCollectionJobsPayload('org-1', { limit: 2 }, deps)).resolves.toEqual({
      ok: true,
      data: pagePayload,
    })

    expect(mocks.loadEstimateCollectionJobsPage).toHaveBeenNthCalledWith(1, 'org-1', { limit: 2 })
    expect(mocks.loadEstimateCollectionJobsPage).toHaveBeenNthCalledWith(2, 'org-1', {
      query: '',
      limit: 2,
      cursor: '2026-04-24T12:00:00.000Z::job-2',
    })
    expect(mocks.buildQuoteHomeJobsPageReadModel).toHaveBeenCalledWith({
      query: '',
      limit: 2,
      nextCursor: '2026-04-24T11:00:00.000Z::job-1',
      items: pagePayload.items,
    })
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
