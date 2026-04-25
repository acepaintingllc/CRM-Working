import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireSessionUserOrg: vi.fn(),
  readJsonBody: vi.fn(),
  loadEstimateCollectionBootstrapPayload: vi.fn(),
  loadEstimateCollectionJobVersionsPayload: vi.fn(),
  loadEstimateCollectionJobsPayload: vi.fn(),
  loadEstimateCollectionPayload: vi.fn(),
  loadEstimateCollectionQuoteCreateContextPayload: vi.fn(),
  loadEstimateCollectionSearchPayload: vi.fn(),
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
  loadEstimateCollectionQuoteCreateContextPayload: mocks.loadEstimateCollectionQuoteCreateContextPayload,
  loadEstimateCollectionSearchPayload: mocks.loadEstimateCollectionSearchPayload,
  createEstimateCollectionVersion: mocks.createEstimateCollectionVersion,
}))

import {
  estimateCollectionCopy,
  handleEstimateCollectionRoutePost,
  handleEstimateHomeBootstrapRouteGet,
  handleEstimateHomeJobsRouteGet,
  handleEstimateHomeSearchRouteGet,
  handleEstimateJobVersionsRouteGet,
  handleEstimateQuoteCreateContextRouteGet,
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
    mocks.loadEstimateCollectionJobsPayload.mockResolvedValue({ ok: true, data: { query: '', items: [] } })
    mocks.loadEstimateCollectionSearchPayload.mockResolvedValue({ ok: true, data: { query: 'garage', limit: 8, items: [] } })
    mocks.loadEstimateCollectionJobVersionsPayload.mockResolvedValue({
      ok: true,
      data: { job_id: 'job-1', total_versions: 1, limit: 25, next_cursor: null, items: [] },
    })
    mocks.loadEstimateCollectionQuoteCreateContextPayload.mockResolvedValue({
      ok: true,
      data: {
        job: {
          id: '33333333-3333-4333-8333-333333333333',
          customer_id: 'customer-1',
          customer_name: 'Alice',
          customer_address: '123 Main',
          title: 'Kitchen',
          eligibility: { eligible: true, reason: 'eligible' },
        },
      },
    })
    mocks.createEstimateCollectionVersion.mockResolvedValue({
      ok: true,
      data: { id: 'estimate-new', estimate: { id: 'estimate-new' } },
    })
  })

  it('keeps approved quote home routes thin', async () => {
    const jobsRequest = new Request('http://localhost/api/quotes/home/jobs?q=%20kit%20&cursor=abc&limit=10')
    const searchRequest = new Request('http://localhost/api/quotes/home/search?q=%20garage%20')

    await handleEstimateHomeBootstrapRouteGet()
    await handleEstimateHomeJobsRouteGet(jobsRequest)
    await handleEstimateHomeSearchRouteGet(searchRequest)

    expect(mocks.loadEstimateCollectionBootstrapPayload).toHaveBeenCalledWith('org-1')
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

  it('keeps invalid cursor service failures in error envelopes', async () => {
    mocks.loadEstimateCollectionJobsPayload.mockResolvedValueOnce({
      ok: false,
      kind: 'invalid_input',
      message: 'Invalid cursor.',
    })

    const jobsResponse = await handleEstimateHomeJobsRouteGet(
      new Request('http://localhost/api/quotes/home/jobs?cursor=bad')
    )

    expect(jobsResponse.status).toBe(400)
    await expect(jobsResponse.json()).resolves.toEqual({ error: 'Invalid cursor.' })

    mocks.loadEstimateCollectionJobVersionsPayload.mockResolvedValueOnce({
      ok: false,
      kind: 'invalid_input',
      message: 'Invalid cursor.',
    })

    const versionsResponse = await handleEstimateJobVersionsRouteGet(
      new Request(
        'http://localhost/api/quotes/home/jobs/33333333-3333-4333-8333-333333333333/versions?cursor=bad'
      ),
      { params: { jobId: '33333333-3333-4333-8333-333333333333' } }
    )

    expect(versionsResponse.status).toBe(400)
    await expect(versionsResponse.json()).resolves.toEqual({ error: 'Invalid cursor.' })
  })

  it('normalizes empty search requests through the shared service contract', async () => {
    await handleEstimateHomeSearchRouteGet(
      new Request('http://localhost/api/quotes/home/search?q=%20%20')
    )

    expect(mocks.loadEstimateCollectionSearchPayload).toHaveBeenCalledWith('org-1', '')
  })

  it('keeps search service failures in error envelopes', async () => {
    mocks.loadEstimateCollectionSearchPayload.mockResolvedValueOnce({
      ok: false,
      kind: 'server_error',
      message: 'search failed',
    })

    const response = await handleEstimateHomeSearchRouteGet(
      new Request('http://localhost/api/quotes/home/search?q=garage')
    )

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'search failed' })
  })

  it('keeps under-filled jobs pages in the route data envelope', async () => {
    mocks.loadEstimateCollectionJobsPayload.mockResolvedValueOnce({
      ok: true,
      data: {
        query: 'kit',
        limit: 2,
        next_cursor: '2026-04-24T11:00:00.000Z::33333333-3333-4333-8333-333333333333',
        items: [{ id: 'job-1' }],
      },
    })

    const response = await handleEstimateHomeJobsRouteGet(
      new Request('http://localhost/api/quotes/home/jobs?q=kit&limit=2')
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: {
        query: 'kit',
        limit: 2,
        next_cursor: '2026-04-24T11:00:00.000Z::33333333-3333-4333-8333-333333333333',
        items: [{ id: 'job-1' }],
      },
    })
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

  it('validates job ids and forwards quote-create context reads', async () => {
    const invalidResponse = await handleEstimateQuoteCreateContextRouteGet(
      new Request('http://localhost/api/quotes/home/jobs/not-a-uuid/create-context'),
      { params: { jobId: 'not-a-uuid' } }
    )
    expect(invalidResponse.status).toBe(400)

    const response = await handleEstimateQuoteCreateContextRouteGet(
      new Request(
        'http://localhost/api/quotes/home/jobs/33333333-3333-4333-8333-333333333333/create-context'
      ),
      { params: { jobId: '33333333-3333-4333-8333-333333333333' } }
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: {
        job: {
          id: '33333333-3333-4333-8333-333333333333',
          customer_id: 'customer-1',
          customer_name: 'Alice',
          customer_address: '123 Main',
          title: 'Kitchen',
          eligibility: { eligible: true, reason: 'eligible' },
        },
      },
    })
    expect(mocks.loadEstimateCollectionQuoteCreateContextPayload).toHaveBeenCalledWith(
      'org-1',
      '33333333-3333-4333-8333-333333333333'
    )
  })

  it('keeps missing quote-create context jobs in error envelopes', async () => {
    mocks.loadEstimateCollectionQuoteCreateContextPayload.mockResolvedValueOnce({
      ok: false,
      kind: 'not_found',
      message: 'Job not found.',
    })

    const response = await handleEstimateQuoteCreateContextRouteGet(
      new Request(
        'http://localhost/api/quotes/home/jobs/33333333-3333-4333-8333-333333333333/create-context'
      ),
      { params: { jobId: '33333333-3333-4333-8333-333333333333' } }
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Job not found.' })
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
