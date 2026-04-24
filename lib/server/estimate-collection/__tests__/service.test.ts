import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  buildQuoteHomeBootstrapReadModel: vi.fn(),
  buildQuoteHomeJobsPageReadModel: vi.fn(),
  buildQuoteHomeRecentActivityReadModel: vi.fn(),
  buildQuoteHomeSearchReadModel: vi.fn(),
  buildQuoteJobVersionsReadModel: vi.fn(),
  buildQuoteListPayload: vi.fn(),
  createEstimateCollectionVersionRecord: vi.fn(),
  decorateEstimateCollectionRows: vi.fn(),
  loadEstimateCollectionJobVersionsPage: vi.fn(),
  loadEstimateCollectionJobsPage: vi.fn(),
  loadEstimateCollectionRowsForOrg: vi.fn(),
  loadEstimateCollectionSummary: vi.fn(),
  searchEstimateCollectionRows: vi.fn(),
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
  buildQuoteHomeSearchReadModel: mocks.buildQuoteHomeSearchReadModel,
  buildQuoteJobVersionsReadModel: mocks.buildQuoteJobVersionsReadModel,
  buildQuoteListPayload: mocks.buildQuoteListPayload,
  createEstimateCollectionVersionRecord: mocks.createEstimateCollectionVersionRecord,
  decorateEstimateCollectionRows: mocks.decorateEstimateCollectionRows,
  loadEstimateCollectionJobVersionsPage: mocks.loadEstimateCollectionJobVersionsPage,
  loadEstimateCollectionJobsPage: mocks.loadEstimateCollectionJobsPage,
  loadEstimateCollectionRowsForOrg: mocks.loadEstimateCollectionRowsForOrg,
  loadEstimateCollectionSummary: mocks.loadEstimateCollectionSummary,
  searchEstimateCollectionRows: mocks.searchEstimateCollectionRows,
}

describe('estimate collection service', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
  })

  it('builds the collection payload from decorated rows', async () => {
    const rows = [{ id: 'estimate-1' }]
    const decoratedRows = [{ estimate_id: 'estimate-1' }]
    const payload = { estimates: [{ id: 'estimate-1' }] }
    mocks.loadEstimateCollectionRowsForOrg.mockResolvedValue({ ok: true, data: rows })
    mocks.decorateEstimateCollectionRows.mockResolvedValue({ ok: true, data: decoratedRows })
    mocks.buildQuoteListPayload.mockReturnValue(payload)

    await expect(loadEstimateCollectionPayload('org-1', deps)).resolves.toEqual({
      ok: true,
      data: payload,
    })
    expect(mocks.decorateEstimateCollectionRows).toHaveBeenCalledWith('org-1', rows, {
      includeRollups: false,
    })
    expect(mocks.buildQuoteListPayload).toHaveBeenCalledWith(decoratedRows)
  })

  it('returns the summary payload from the repository summary loader', async () => {
    const payload = { total_versions: 2, pipeline_total: 1500 }
    mocks.loadEstimateCollectionSummary.mockResolvedValue({ ok: true, data: payload })

    await expect(loadEstimateCollectionSummaryPayload('org-1', deps)).resolves.toEqual({
      ok: true,
      data: payload,
    })
    expect(mocks.loadEstimateCollectionSummary).toHaveBeenCalledWith('org-1')
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
      nextCursor: 'cursor-2',
      items: [{ id: 'job-1', title: 'Kitchen' }],
    }
    const jobsPayload = {
      query: '',
      limit: 25,
      next_cursor: 'cursor-2',
      items: jobsPage.items,
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
    mocks.decorateEstimateCollectionRows.mockResolvedValue({ ok: true, data: decoratedRows })
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
    expect(mocks.decorateEstimateCollectionRows).toHaveBeenCalledWith('org-1', versionsPage.items, {
      includeRollups: true,
    })
    expect(mocks.buildQuoteHomeJobsPageReadModel).toHaveBeenCalledWith({
      query: '',
      limit: 25,
      nextCursor: 'cursor-2',
      items: jobsPage.items,
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
    mocks.searchEstimateCollectionRows.mockResolvedValue({ ok: true, data: rows })
    mocks.decorateEstimateCollectionRows.mockResolvedValue({ ok: true, data: decoratedRows })
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
    expect(mocks.buildQuoteHomeSearchReadModel).toHaveBeenCalledWith(decoratedRows, 'kitchen')
  })

  it('builds jobs and job version payloads through the paging read-model builders', async () => {
    const jobsPage = {
      query: 'kit',
      limit: 10,
      nextCursor: 'cursor-3',
      items: [{ id: 'job-1', title: 'Kitchen' }],
    }
    const jobsPayload = {
      query: 'kit',
      limit: 10,
      next_cursor: 'cursor-3',
      items: jobsPage.items,
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
    mocks.buildQuoteHomeJobsPageReadModel.mockReturnValue(jobsPayload)
    mocks.loadEstimateCollectionJobVersionsPage.mockResolvedValue({ ok: true, data: versionsPage })
    mocks.decorateEstimateCollectionRows.mockResolvedValue({ ok: true, data: decoratedRows })
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
      nextCursor: 'cursor-3',
      items: jobsPage.items,
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
    expect(mocks.decorateEstimateCollectionRows).toHaveBeenCalledWith('org-1', versionsPage.items, {
      includeRollups: true,
    })
    expect(mocks.buildQuoteJobVersionsReadModel).toHaveBeenCalledWith(decoratedRows, {
      jobId: 'job-1',
      totalVersions: 1,
      limit: 10,
      nextCursor: 'cursor-4',
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
