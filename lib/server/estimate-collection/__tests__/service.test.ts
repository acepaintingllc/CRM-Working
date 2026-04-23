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
    mocks.loadEstimateCollectionRowsForOrg.mockResolvedValue({ ok: true, data: [{ id: 'estimate-1' }] })
    mocks.decorateEstimateCollectionRows.mockResolvedValue({ ok: true, data: [{ estimate_id: 'estimate-1' }] })
    mocks.buildQuoteListPayload.mockReturnValue({ estimates: [{ id: 'estimate-1' }] })

    await expect(loadEstimateCollectionPayload('org-1', deps)).resolves.toEqual({
      ok: true,
      data: { estimates: [{ id: 'estimate-1' }] },
    })
  })

  it('builds the bounded bootstrap payload from summary, jobs page, and selected-job versions', async () => {
    mocks.loadEstimateCollectionSummary.mockResolvedValue({
      ok: true,
      data: { total_versions: 3, draft_count: 1, sent_or_awaiting_count: 1, live_count: 1, pipeline_total: 1800 },
    })
    mocks.loadEstimateCollectionJobsPage.mockResolvedValue({
      ok: true,
      data: {
        query: '',
        limit: 25,
        nextCursor: 'cursor-2',
        items: [{ id: 'job-1', version_count: 2 }],
      },
    })
    mocks.loadEstimateCollectionJobVersionsPage.mockResolvedValue({
      ok: true,
      data: {
        jobId: 'job-1',
        totalVersions: 2,
        limit: 25,
        nextCursor: null,
        items: [{ id: 'estimate-1' }],
      },
    })
    mocks.decorateEstimateCollectionRows.mockResolvedValue({ ok: true, data: [{ estimate_id: 'estimate-1' }] })
    mocks.buildQuoteHomeJobsPageReadModel.mockReturnValue({
      query: '',
      limit: 25,
      next_cursor: 'cursor-2',
      items: [{ id: 'job-1', version_count: 2 }],
    })
    mocks.buildQuoteJobVersionsReadModel.mockReturnValue({
      job_id: 'job-1',
      total_versions: 2,
      limit: 25,
      next_cursor: null,
      items: [{ estimate_id: 'estimate-1' }],
    })
    mocks.buildQuoteHomeBootstrapReadModel.mockReturnValue({
      summary: { total_versions: 3 },
      jobs: { items: [{ id: 'job-1' }] },
      selected_job_id: 'job-1',
      selected_job_versions: { items: [{ estimate_id: 'estimate-1' }] },
    })

    const result = await loadEstimateCollectionBootstrapPayload('org-1', deps)

    expect(result).toEqual({
      ok: true,
      data: {
        summary: { total_versions: 3 },
        jobs: { items: [{ id: 'job-1' }] },
        selected_job_id: 'job-1',
        selected_job_versions: { items: [{ estimate_id: 'estimate-1' }] },
      },
    })
  })

  it('builds summary, jobs, recent activity, search, and job versions through the new read-model builders', async () => {
    mocks.loadEstimateCollectionSummary.mockResolvedValue({
      ok: true,
      data: { total_versions: 2, draft_count: 1, sent_or_awaiting_count: 1, live_count: 1, pipeline_total: 1300 },
    })
    mocks.loadEstimateCollectionJobsPage.mockResolvedValue({
      ok: true,
      data: { query: 'kit', limit: 25, nextCursor: null, items: [{ id: 'job-1', version_count: 2 }] },
    })
    mocks.buildQuoteHomeJobsPageReadModel.mockReturnValue({
      query: 'kit',
      limit: 25,
      next_cursor: null,
      items: [{ id: 'job-1', version_count: 2 }],
    })
    mocks.loadEstimateCollectionRowsForOrg.mockResolvedValue({ ok: true, data: [{ id: 'estimate-1' }] })
    mocks.searchEstimateCollectionRows.mockResolvedValue({ ok: true, data: [{ id: 'estimate-1' }] })
    mocks.decorateEstimateCollectionRows.mockResolvedValue({ ok: true, data: [{ estimate_id: 'estimate-1' }] })
    mocks.buildQuoteHomeRecentActivityReadModel.mockReturnValue({ items: [{ estimate_id: 'estimate-1' }] })
    mocks.buildQuoteHomeSearchReadModel.mockReturnValue({ query: 'kitchen', limit: 8, items: [{ estimate_id: 'estimate-1' }] })
    mocks.loadEstimateCollectionJobVersionsPage.mockResolvedValue({
      ok: true,
      data: {
        jobId: 'job-1',
        totalVersions: 1,
        limit: 25,
        nextCursor: null,
        items: [{ id: 'estimate-1' }],
      },
    })
    mocks.buildQuoteJobVersionsReadModel.mockReturnValue({
      job_id: 'job-1',
      total_versions: 1,
      limit: 25,
      next_cursor: null,
      items: [{ estimate_id: 'estimate-1' }],
    })

    await expect(loadEstimateCollectionSummaryPayload('org-1', deps)).resolves.toEqual({
      ok: true,
      data: { total_versions: 2, draft_count: 1, sent_or_awaiting_count: 1, live_count: 1, pipeline_total: 1300 },
    })
    await expect(loadEstimateCollectionJobsPayload('org-1', { query: 'kit' }, deps)).resolves.toEqual({
      ok: true,
      data: { query: 'kit', limit: 25, next_cursor: null, items: [{ id: 'job-1', version_count: 2 }] },
    })
    await expect(loadEstimateCollectionRecentActivityPayload('org-1', deps)).resolves.toEqual({
      ok: true,
      data: { items: [{ estimate_id: 'estimate-1' }] },
    })
    await expect(loadEstimateCollectionSearchPayload('org-1', 'kitchen', deps)).resolves.toEqual({
      ok: true,
      data: { query: 'kitchen', limit: 8, items: [{ estimate_id: 'estimate-1' }] },
    })
    await expect(loadEstimateCollectionJobVersionsPayload('org-1', 'job-1', {}, deps)).resolves.toEqual({
      ok: true,
      data: { job_id: 'job-1', total_versions: 1, limit: 25, next_cursor: null, items: [{ estimate_id: 'estimate-1' }] },
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
