import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireSessionUserOrg: vi.fn(),
  readJsonBody: vi.fn(),
  loadEstimateCollectionBootstrapPayload: vi.fn(),
  loadEstimateCollectionJobVersionsPayload: vi.fn(),
  loadEstimateCollectionJobsPayload: vi.fn(),
  loadEstimateCollectionPayload: vi.fn(),
  loadEstimateCollectionRecentActivityPayload: vi.fn(),
  loadEstimateCollectionSearchPayload: vi.fn(),
  loadEstimateCollectionSummaryPayload: vi.fn(),
  createEstimateCollectionVersion: vi.fn(),
}))

vi.mock('@/lib/server/apiRoute', () => ({
  requireSessionUserOrg: mocks.requireSessionUserOrg,
  readJsonBody: mocks.readJsonBody,
  resolveParams: (context: { params: unknown }) => Promise.resolve(context.params),
  readUuidParam: (value: unknown, label: string) => {
    const text = String(value ?? '')
    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuid.test(text)) {
      return {
        ok: false as const,
        response: new Response(JSON.stringify({ error: `Invalid ${label}` }), { status: 400 }),
      }
    }
    return { ok: true as const, value: text }
  },
  jsonError: (error: string, status: number) => new Response(JSON.stringify({ error }), { status }),
}))

vi.mock('@/lib/server/estimate-collection/service', () => ({
  loadEstimateCollectionBootstrapPayload: mocks.loadEstimateCollectionBootstrapPayload,
  loadEstimateCollectionJobVersionsPayload: mocks.loadEstimateCollectionJobVersionsPayload,
  loadEstimateCollectionJobsPayload: mocks.loadEstimateCollectionJobsPayload,
  loadEstimateCollectionPayload: mocks.loadEstimateCollectionPayload,
  loadEstimateCollectionRecentActivityPayload: mocks.loadEstimateCollectionRecentActivityPayload,
  loadEstimateCollectionSearchPayload: mocks.loadEstimateCollectionSearchPayload,
  loadEstimateCollectionSummaryPayload: mocks.loadEstimateCollectionSummaryPayload,
  createEstimateCollectionVersion: mocks.createEstimateCollectionVersion,
}))

import {
  estimateCollectionCopy,
  handleEstimateCollectionRoutePost,
  handleEstimateHomeBootstrapRouteGet,
  handleEstimateHomeJobCountsRouteGet,
  handleEstimateHomeJobsRouteGet,
  handleEstimateHomeRecentActivityRouteGet,
  handleEstimateHomeSearchRouteGet,
  handleEstimateHomeSummaryRouteGet,
  handleEstimateJobVersionsRouteGet,
} from '../estimateCollectionRoutes'

describe('estimate collection routes', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.requireSessionUserOrg.mockResolvedValue({
      ok: true,
      session: { orgId: 'org-1', userId: 'user-1' },
    })
    mocks.readJsonBody.mockResolvedValue({
      ok: true,
      value: { job_id: '11111111-1111-4111-8111-111111111111' },
    })
    mocks.loadEstimateCollectionBootstrapPayload.mockResolvedValue({ ok: true, data: { jobs: { items: [] } } })
    mocks.loadEstimateCollectionSummaryPayload.mockResolvedValue({ ok: true, data: { total_versions: 2 } })
    mocks.loadEstimateCollectionRecentActivityPayload.mockResolvedValue({ ok: true, data: { items: [] } })
    mocks.loadEstimateCollectionJobsPayload.mockResolvedValue({ ok: true, data: { query: '', items: [] } })
    mocks.loadEstimateCollectionSearchPayload.mockResolvedValue({ ok: true, data: { query: 'garage', limit: 8, items: [] } })
    mocks.loadEstimateCollectionJobVersionsPayload.mockResolvedValue({
      ok: true,
      data: { job_id: 'job-1', total_versions: 1, limit: 25, next_cursor: null, items: [] },
    })
    mocks.createEstimateCollectionVersion.mockResolvedValue({
      ok: true,
      data: { id: 'estimate-new', estimate: { id: 'estimate-new' } },
    })
  })

  it('keeps bootstrap, summary, recent-activity, jobs, and search routes thin', async () => {
    const jobsRequest = new Request('http://localhost/api/quotes/home/jobs?q=%20kit%20&cursor=abc&limit=10')
    const searchRequest = new Request('http://localhost/api/quotes/home/search?q=%20garage%20')

    await handleEstimateHomeBootstrapRouteGet()
    await handleEstimateHomeSummaryRouteGet()
    await handleEstimateHomeRecentActivityRouteGet()
    await handleEstimateHomeJobsRouteGet(jobsRequest)
    await handleEstimateHomeSearchRouteGet(searchRequest)

    expect(mocks.loadEstimateCollectionBootstrapPayload).toHaveBeenCalledWith('org-1')
    expect(mocks.loadEstimateCollectionSummaryPayload).toHaveBeenCalledWith('org-1')
    expect(mocks.loadEstimateCollectionRecentActivityPayload).toHaveBeenCalledWith('org-1')
    expect(mocks.loadEstimateCollectionJobsPayload).toHaveBeenCalledWith('org-1', {
      query: 'kit',
      cursor: 'abc',
      limit: 10,
    })
    expect(mocks.loadEstimateCollectionSearchPayload).toHaveBeenCalledWith('org-1', 'garage')
  })

  it('rejects invalid limits before calling paged route services', async () => {
    const jobsResponse = await handleEstimateHomeJobsRouteGet(
      new Request('http://localhost/api/quotes/home/jobs?limit=1.5')
    )
    expect(jobsResponse.status).toBe(400)
    await expect(jobsResponse.json()).resolves.toEqual({ error: 'Invalid limit.' })

    const versionsResponse = await handleEstimateJobVersionsRouteGet(
      new Request(
        'http://localhost/api/quotes/home/jobs/33333333-3333-4333-8333-333333333333/versions?limit=0'
      ),
      { params: { jobId: '33333333-3333-4333-8333-333333333333' } }
    )
    expect(versionsResponse.status).toBe(400)
    await expect(versionsResponse.json()).resolves.toEqual({ error: 'Invalid limit.' })

    expect(mocks.loadEstimateCollectionJobsPayload).not.toHaveBeenCalled()
    expect(mocks.loadEstimateCollectionJobVersionsPayload).not.toHaveBeenCalled()
  })

  it('normalizes empty search requests through the shared service contract', async () => {
    await handleEstimateHomeSearchRouteGet(
      new Request('http://localhost/api/quotes/home/search?q=%20%20')
    )

    expect(mocks.loadEstimateCollectionSearchPayload).toHaveBeenCalledWith('org-1', '')
  })

  it('marks the old job-counts route as gone', async () => {
    const response = await handleEstimateHomeJobCountsRouteGet()
    expect(response.status).toBe(410)
  })

  it('validates job ids and forwards pagination params for job versions', async () => {
    const invalidResponse = await handleEstimateJobVersionsRouteGet(
      new Request('http://localhost/api/quotes/home/jobs/not-a-uuid/versions'),
      { params: { jobId: 'not-a-uuid' } }
    )
    expect(invalidResponse.status).toBe(400)

    await handleEstimateJobVersionsRouteGet(
      new Request('http://localhost/api/quotes/home/jobs/33333333-3333-4333-8333-333333333333/versions?cursor=next&limit=50'),
      { params: { jobId: '33333333-3333-4333-8333-333333333333' } }
    )

    expect(mocks.loadEstimateCollectionJobVersionsPayload).toHaveBeenCalledWith(
      'org-1',
      '33333333-3333-4333-8333-333333333333',
      { cursor: 'next', limit: 50 }
    )
  })

  it('delegates version creation to the shared write service', async () => {
    const response = await handleEstimateCollectionRoutePost(
      new Request('http://localhost/api/estimates', { method: 'POST' }),
      estimateCollectionCopy
    )

    expect(mocks.createEstimateCollectionVersion).toHaveBeenCalledWith({
      orgId: 'org-1',
      userId: 'user-1',
      body: { job_id: '11111111-1111-4111-8111-111111111111' },
      copy: estimateCollectionCopy,
    })
    expect(response.status).toBe(200)
  })
})
