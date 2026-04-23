import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireSessionUserOrg: vi.fn(),
  readJsonBody: vi.fn(),
  loadEstimateCollectionBootstrapPayload: vi.fn(),
  loadEstimateCollectionJobCountsPayload: vi.fn(),
  loadEstimateCollectionJobVersionsPayload: vi.fn(),
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
  loadEstimateCollectionJobCountsPayload: mocks.loadEstimateCollectionJobCountsPayload,
  loadEstimateCollectionJobVersionsPayload: mocks.loadEstimateCollectionJobVersionsPayload,
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
  handleEstimateHomeRecentActivityRouteGet,
  handleEstimateHomeSearchRouteGet,
  handleEstimateHomeSummaryRouteGet,
  handleEstimateJobVersionsRouteGet,
} from '../estimateCollectionRoutes'

const summary = {
  total_versions: 2,
  draft_count: 1,
  sent_or_awaiting_count: 2,
  live_count: 1,
  pipeline_total: 2000,
}

const jobCounts = {
  items: [
    { job_id: '11111111-1111-4111-8111-111111111111', version_count: 1 },
    { job_id: '22222222-2222-4222-8222-222222222222', version_count: 1 },
  ],
}

const bootstrap = {
  summary,
  jobCounts,
  jobs: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      customer_id: 'customer-1',
      customer_name: 'Alice',
      customer_address: '123 Main',
      title: 'Kitchen',
      description: null,
      status: 'estimate_scheduled',
      estimate_date: null,
      estimate_sent_at: '2026-04-21T00:00:00.000Z',
      scheduled_date: null,
      completed_at: null,
    },
  ],
}

describe('estimate collection routes', () => {
  beforeEach(() => {
    mocks.requireSessionUserOrg.mockReset()
    mocks.readJsonBody.mockReset()
    mocks.loadEstimateCollectionBootstrapPayload.mockReset()
    mocks.loadEstimateCollectionJobCountsPayload.mockReset()
    mocks.loadEstimateCollectionJobVersionsPayload.mockReset()
    mocks.loadEstimateCollectionPayload.mockReset()
    mocks.loadEstimateCollectionRecentActivityPayload.mockReset()
    mocks.loadEstimateCollectionSearchPayload.mockReset()
    mocks.loadEstimateCollectionSummaryPayload.mockReset()
    mocks.createEstimateCollectionVersion.mockReset()

    mocks.requireSessionUserOrg.mockResolvedValue({
      ok: true,
      session: { orgId: 'org-1', userId: 'user-1' },
    })
    mocks.loadEstimateCollectionBootstrapPayload.mockResolvedValue({
      ok: true,
      data: bootstrap,
    })
    mocks.loadEstimateCollectionSummaryPayload.mockResolvedValue({
      ok: true,
      data: summary,
    })
    mocks.loadEstimateCollectionRecentActivityPayload.mockResolvedValue({
      ok: true,
      data: {
        items: [
          { estimate_id: 'estimate-1' },
          { estimate_id: 'estimate-2' },
        ],
      },
    })
    mocks.loadEstimateCollectionJobCountsPayload.mockResolvedValue({
      ok: true,
      data: jobCounts,
    })
    mocks.loadEstimateCollectionSearchPayload.mockResolvedValue({
      ok: true,
      data: {
        query: 'garage',
        items: [{ estimate_id: 'estimate-2' }],
      },
    })
    mocks.loadEstimateCollectionJobVersionsPayload.mockResolvedValue({
      ok: true,
      data: {
        job_id: '11111111-1111-4111-8111-111111111111',
        total_versions: 2,
        items: [{ estimate_id: 'estimate-1' }, { estimate_id: 'estimate-2' }],
      },
    })
    mocks.readJsonBody.mockResolvedValue({
      ok: true,
      value: {
        job_id: '11111111-1111-4111-8111-111111111111',
        customer_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        version_kind: 'revision',
        version_name: 'Kitchen Revision 2',
      },
    })
    mocks.createEstimateCollectionVersion.mockResolvedValue({
      ok: true,
      data: {
        id: 'estimate-new',
        estimate: {
          id: 'estimate-new',
          version_sort_order: 2,
        },
      },
    })
  })

  it('keeps bootstrap, summary, recent-activity, and job-count routes thin', async () => {
    const bootstrapResponse = await handleEstimateHomeBootstrapRouteGet()
    const summaryResponse = await handleEstimateHomeSummaryRouteGet()
    const recentActivityResponse = await handleEstimateHomeRecentActivityRouteGet()
    const jobCountsResponse = await handleEstimateHomeJobCountsRouteGet()

    expect(mocks.loadEstimateCollectionBootstrapPayload).toHaveBeenCalledWith('org-1')
    expect(mocks.loadEstimateCollectionSummaryPayload).toHaveBeenCalledWith('org-1')
    expect(mocks.loadEstimateCollectionRecentActivityPayload).toHaveBeenCalledWith('org-1')
    expect(mocks.loadEstimateCollectionJobCountsPayload).toHaveBeenCalledWith('org-1')
    await expect(bootstrapResponse.json()).resolves.toEqual({ data: bootstrap })
    await expect(summaryResponse.json()).resolves.toEqual({ data: summary })
    await expect(recentActivityResponse.json()).resolves.toEqual({
      data: {
        items: [
          expect.objectContaining({ estimate_id: 'estimate-1' }),
          expect.objectContaining({ estimate_id: 'estimate-2' }),
        ],
      },
    })
    await expect(jobCountsResponse.json()).resolves.toEqual({ data: jobCounts })
  })

  it('passes search queries through to the collection service', async () => {
    mocks.loadEstimateCollectionSearchPayload.mockResolvedValueOnce({
      ok: true,
      data: { query: '', items: [] },
    })
    mocks.loadEstimateCollectionSearchPayload.mockResolvedValueOnce({
      ok: true,
      data: { query: 'garage', items: [{ estimate_id: 'estimate-2' }] },
    })

    const emptyResponse = await handleEstimateHomeSearchRouteGet(
      new Request('http://localhost/api/quotes/home/search?q=')
    )
    const filteredResponse = await handleEstimateHomeSearchRouteGet(
      new Request('http://localhost/api/quotes/home/search?q=garage')
    )

    expect(mocks.loadEstimateCollectionSearchPayload).toHaveBeenNthCalledWith(1, 'org-1', '')
    expect(mocks.loadEstimateCollectionSearchPayload).toHaveBeenNthCalledWith(
      2,
      'org-1',
      'garage'
    )
    await expect(emptyResponse.json()).resolves.toEqual({
      data: {
        query: '',
        items: [],
      },
    })
    await expect(filteredResponse.json()).resolves.toEqual({
      data: {
        query: 'garage',
        items: [expect.objectContaining({ estimate_id: 'estimate-2' })],
      },
    })
  })

  it('returns 400 for invalid job ids', async () => {
    const response = await handleEstimateJobVersionsRouteGet(
      new Request('http://localhost/api/quotes/home/jobs/not-a-uuid/versions'),
      {
        params: { jobId: 'not-a-uuid' },
      }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid job id' })
  })

  it('delegates job version loading to the collection service', async () => {
    const response = await handleEstimateJobVersionsRouteGet(
      new Request(
        'http://localhost/api/quotes/home/jobs/33333333-3333-4333-8333-333333333333/versions'
      ),
      {
        params: { jobId: '33333333-3333-4333-8333-333333333333' },
      }
    )

    expect(mocks.loadEstimateCollectionJobVersionsPayload).toHaveBeenCalledWith(
      'org-1',
      '33333333-3333-4333-8333-333333333333'
    )
    await expect(response.json()).resolves.toEqual({
      data: {
        job_id: '11111111-1111-4111-8111-111111111111',
        total_versions: 2,
        items: [
          expect.objectContaining({ estimate_id: 'estimate-1' }),
          expect.objectContaining({ estimate_id: 'estimate-2' }),
        ],
      },
    })
  })

  it('delegates version creation to the shared write service', async () => {
    const response = await handleEstimateCollectionRoutePost(
      new Request('http://localhost/api/estimates', { method: 'POST' }),
      estimateCollectionCopy
    )

    expect(mocks.createEstimateCollectionVersion).toHaveBeenCalledWith({
      orgId: 'org-1',
      userId: 'user-1',
      body: {
        job_id: '11111111-1111-4111-8111-111111111111',
        customer_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        version_kind: 'revision',
        version_name: 'Kitchen Revision 2',
      },
      copy: estimateCollectionCopy,
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: {
        id: 'estimate-new',
        estimate: expect.objectContaining({
          id: 'estimate-new',
          version_sort_order: 2,
        }),
      },
      notice: 'Estimate version created.',
    })
  })

  it('maps invalid input failures from the write service to 400', async () => {
    mocks.createEstimateCollectionVersion.mockResolvedValueOnce({
      ok: false,
      kind: 'invalid_input',
      message: 'Invalid job_id',
    })

    const response = await handleEstimateCollectionRoutePost(
      new Request('http://localhost/api/estimates', { method: 'POST' }),
      estimateCollectionCopy
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid job_id' })
  })

  it('maps not-found failures from the write service to 404', async () => {
    mocks.createEstimateCollectionVersion.mockResolvedValueOnce({
      ok: false,
      kind: 'not_found',
      message: 'Job not found',
    })

    const response = await handleEstimateCollectionRoutePost(
      new Request('http://localhost/api/estimates', { method: 'POST' }),
      estimateCollectionCopy
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Job not found' })
  })

  it('passes server failures through the standard mutation envelope', async () => {
    mocks.createEstimateCollectionVersion.mockResolvedValueOnce({
      ok: false,
      kind: 'server_error',
      message: 'Failed to initialize estimate_jobsettings',
    })

    const response = await handleEstimateCollectionRoutePost(
      new Request('http://localhost/api/estimates', { method: 'POST' }),
      estimateCollectionCopy
    )

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to initialize estimate_jobsettings',
    })
  })
})
