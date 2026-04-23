import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  buildQuoteHomeBootstrapReadModel: vi.fn(),
  buildQuoteHomeJobVersionCountsReadModel: vi.fn(),
  buildQuoteHomeRecentActivityReadModel: vi.fn(),
  buildQuoteHomeSearchReadModel: vi.fn(),
  buildQuoteHomeSummaryReadModel: vi.fn(),
  buildQuoteJobVersionsReadModel: vi.fn(),
  buildQuoteListPayload: vi.fn(),
  createEstimateCollectionVersionRecord: vi.fn(),
  decorateEstimateCollectionRows: vi.fn(),
  isSentEstimateCollectionJob: vi.fn(),
  loadEstimateCollectionEligibleJobs: vi.fn(),
  loadEstimateCollectionRollupSummary: vi.fn(),
  loadEstimateCollectionRowsForOrg: vi.fn(),
  normalizeEstimateCollectionVersionState: vi.fn(),
  searchEstimateCollectionRows: vi.fn(),
}))

import {
  createEstimateCollectionVersion,
  loadEstimateCollectionBootstrapPayload,
  loadEstimateCollectionJobCountsPayload,
  loadEstimateCollectionJobVersionsPayload,
  loadEstimateCollectionPayload,
  loadEstimateCollectionRecentActivityPayload,
  loadEstimateCollectionSearchPayload,
  loadEstimateCollectionSummaryPayload,
} from '../service.ts'

const deps = {
  buildQuoteHomeBootstrapReadModel: mocks.buildQuoteHomeBootstrapReadModel,
  buildQuoteHomeJobVersionCountsReadModel: mocks.buildQuoteHomeJobVersionCountsReadModel,
  buildQuoteHomeRecentActivityReadModel: mocks.buildQuoteHomeRecentActivityReadModel,
  buildQuoteHomeSearchReadModel: mocks.buildQuoteHomeSearchReadModel,
  buildQuoteHomeSummaryReadModel: mocks.buildQuoteHomeSummaryReadModel,
  buildQuoteJobVersionsReadModel: mocks.buildQuoteJobVersionsReadModel,
  buildQuoteListPayload: mocks.buildQuoteListPayload,
  createEstimateCollectionVersionRecord: mocks.createEstimateCollectionVersionRecord,
  decorateEstimateCollectionRows: mocks.decorateEstimateCollectionRows,
  isSentEstimateCollectionJob: mocks.isSentEstimateCollectionJob,
  loadEstimateCollectionEligibleJobs: mocks.loadEstimateCollectionEligibleJobs,
  loadEstimateCollectionRollupSummary: mocks.loadEstimateCollectionRollupSummary,
  loadEstimateCollectionRowsForOrg: mocks.loadEstimateCollectionRowsForOrg,
  normalizeEstimateCollectionVersionState: mocks.normalizeEstimateCollectionVersionState,
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

  it('builds the bootstrap payload from decorated rows and eligible jobs', async () => {
    const rows = [{ id: 'estimate-1' }]
    const decoratedRows = [{ estimate_id: 'estimate-1' }]
    const jobs = [{ id: 'job-1' }]
    const payload = { summary: {}, jobCounts: {}, jobs }
    mocks.loadEstimateCollectionRowsForOrg.mockResolvedValue({ ok: true, data: rows })
    mocks.loadEstimateCollectionEligibleJobs.mockResolvedValue({ ok: true, data: jobs })
    mocks.decorateEstimateCollectionRows.mockResolvedValue({ ok: true, data: decoratedRows })
    mocks.buildQuoteHomeBootstrapReadModel.mockReturnValue(payload)

    await expect(loadEstimateCollectionBootstrapPayload('org-1', deps)).resolves.toEqual({
      ok: true,
      data: payload,
    })
    expect(mocks.decorateEstimateCollectionRows).toHaveBeenCalledWith('org-1', rows, {
      includeRollups: true,
    })
    expect(mocks.buildQuoteHomeBootstrapReadModel).toHaveBeenCalledWith(decoratedRows, jobs)
  })

  it('builds the summary payload from rows, rollups, and sent state lookups', async () => {
    const rows = [
      { id: 'estimate-1', job_id: 'job-1', version_state: 'draft' },
      { id: 'estimate-2', job_id: 'job-2', version_state: 'live' },
    ]
    const rollupSummary = {
      jobsById: new Map([
        ['job-1', { id: 'job-1', status: 'estimate_sent' }],
        ['job-2', { id: 'job-2', status: 'follow_up' }],
      ]),
      totalsByEstimateId: new Map([
        ['estimate-1', 1000],
        ['estimate-2', 1500],
      ]),
    }
    const payload = { total_versions: 2 }
    mocks.loadEstimateCollectionRowsForOrg.mockResolvedValue({ ok: true, data: rows })
    mocks.loadEstimateCollectionRollupSummary.mockResolvedValue({ ok: true, data: rollupSummary })
    mocks.normalizeEstimateCollectionVersionState.mockImplementation((value) => value ?? 'draft')
    mocks.isSentEstimateCollectionJob.mockReturnValue(true)
    mocks.buildQuoteHomeSummaryReadModel.mockReturnValue(payload)

    await expect(loadEstimateCollectionSummaryPayload('org-1', deps)).resolves.toEqual({
      ok: true,
      data: payload,
    })
    expect(mocks.buildQuoteHomeSummaryReadModel).toHaveBeenCalledWith([
      { version_state: 'draft', final_total: 1000, is_sent_estimate: true },
      { version_state: 'live', final_total: 1500, is_sent_estimate: true },
    ])
  })

  it('builds recent activity, search, counts, and job versions through quote read-model builders', async () => {
    const rows = [{ id: 'estimate-1', job_id: 'job-1' }]
    const decoratedRows = [{ estimate_id: 'estimate-1', job_id: 'job-1' }]
    mocks.loadEstimateCollectionRowsForOrg.mockResolvedValue({ ok: true, data: rows })
    mocks.searchEstimateCollectionRows.mockResolvedValue({ ok: true, data: rows })
    mocks.decorateEstimateCollectionRows.mockResolvedValue({ ok: true, data: decoratedRows })
    mocks.buildQuoteHomeRecentActivityReadModel.mockReturnValue({ items: decoratedRows })
    mocks.buildQuoteHomeSearchReadModel.mockReturnValue({ query: 'kitchen', items: decoratedRows })
    mocks.buildQuoteHomeJobVersionCountsReadModel.mockReturnValue({ items: [{ job_id: 'job-1', version_count: 1 }] })
    mocks.buildQuoteJobVersionsReadModel.mockReturnValue({
      job_id: 'job-1',
      total_versions: 1,
      items: decoratedRows,
    })

    await expect(loadEstimateCollectionRecentActivityPayload('org-1', deps)).resolves.toEqual({
      ok: true,
      data: { items: decoratedRows },
    })
    await expect(loadEstimateCollectionSearchPayload('org-1', 'kitchen', deps)).resolves.toEqual({
      ok: true,
      data: { query: 'kitchen', items: decoratedRows },
    })
    await expect(loadEstimateCollectionJobCountsPayload('org-1', deps)).resolves.toEqual({
      ok: true,
      data: { items: [{ job_id: 'job-1', version_count: 1 }] },
    })
    await expect(loadEstimateCollectionJobVersionsPayload('org-1', 'job-1', deps)).resolves.toEqual({
      ok: true,
      data: { job_id: 'job-1', total_versions: 1, items: decoratedRows },
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
