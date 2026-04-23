import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireSessionUserOrg: vi.fn(),
  readJsonBody: vi.fn(),
  loadDecoratedEstimateCollectionRows: vi.fn(),
  loadDecoratedEstimateRowsForJob: vi.fn(),
  loadDecoratedRecentEstimateRows: vi.fn(),
  loadQuoteHomeJobVersionCounts: vi.fn(),
  loadQuoteHomeSummary: vi.fn(),
  searchDecoratedEstimateRows: vi.fn(),
  rpc: vi.fn(),
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

vi.mock('@/lib/server/estimateCollectionData', () => ({
  loadDecoratedEstimateCollectionRows: mocks.loadDecoratedEstimateCollectionRows,
  loadDecoratedEstimateRowsForJob: mocks.loadDecoratedEstimateRowsForJob,
  loadDecoratedRecentEstimateRows: mocks.loadDecoratedRecentEstimateRows,
  loadQuoteHomeJobVersionCounts: mocks.loadQuoteHomeJobVersionCounts,
  loadQuoteHomeSummary: mocks.loadQuoteHomeSummary,
  searchDecoratedEstimateRows: mocks.searchDecoratedEstimateRows,
}))

vi.mock('@/lib/server/org', () => ({
  supabaseAdmin: {
    rpc: mocks.rpc,
  },
}))

import {
  estimateCollectionCopy,
  handleEstimateCollectionRoutePost,
  handleEstimateHomeJobCountsRouteGet,
  handleEstimateHomeRecentActivityRouteGet,
  handleEstimateHomeSearchRouteGet,
  handleEstimateHomeSummaryRouteGet,
  handleEstimateJobVersionsRouteGet,
} from '../estimateCollectionRoutes'

const rows = [
  {
    id: 'estimate-1',
    estimate_id: 'estimate-1',
    job_id: '11111111-1111-4111-8111-111111111111',
    customer_id: 'customer-1',
    status: 'draft',
    raw_version_name: 'Kitchen Revision',
    raw_version_state: 'draft',
    raw_version_kind: 'revision',
    raw_version_sort_order: 2,
    version_name: 'Kitchen Revision',
    version_state: 'draft',
    version_kind: 'revision',
    version_sort_order: 2,
    job_title: 'Kitchen',
    job_status: 'estimate_sent',
    job_estimate_sent_at: '2026-04-21T00:00:00.000Z',
    customer_name: 'Alice',
    final_total: 1200,
    updated_at: '2026-04-21T10:00:00.000Z',
    created_at: '2026-04-20T10:00:00.000Z',
    is_sent_estimate: true,
  },
  {
    id: 'estimate-2',
    estimate_id: 'estimate-2',
    job_id: '22222222-2222-4222-8222-222222222222',
    customer_id: 'customer-2',
    status: 'live',
    raw_version_name: 'Garage Alt',
    raw_version_state: 'live',
    raw_version_kind: 'alternate',
    raw_version_sort_order: 1,
    version_name: 'Garage Alt',
    version_state: 'live',
    version_kind: 'alternate',
    version_sort_order: 1,
    job_title: 'Garage',
    job_status: 'follow_up',
    job_estimate_sent_at: '2026-04-22T00:00:00.000Z',
    customer_name: 'Bob',
    final_total: 800,
    updated_at: '2026-04-22T10:00:00.000Z',
    created_at: '2026-04-21T10:00:00.000Z',
    is_sent_estimate: true,
  },
]

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

describe('estimate collection routes', () => {
  beforeEach(() => {
    mocks.requireSessionUserOrg.mockReset()
    mocks.readJsonBody.mockReset()
    mocks.loadDecoratedEstimateCollectionRows.mockReset()
    mocks.loadDecoratedEstimateRowsForJob.mockReset()
    mocks.loadDecoratedRecentEstimateRows.mockReset()
    mocks.loadQuoteHomeJobVersionCounts.mockReset()
    mocks.loadQuoteHomeSummary.mockReset()
    mocks.searchDecoratedEstimateRows.mockReset()
    mocks.rpc.mockReset()

    mocks.requireSessionUserOrg.mockResolvedValue({
      ok: true,
      session: { orgId: 'org-1', userId: 'user-1' },
    })
    mocks.loadQuoteHomeSummary.mockResolvedValue({
      ok: true,
      data: summary,
    })
    mocks.loadQuoteHomeJobVersionCounts.mockResolvedValue({
      ok: true,
      data: jobCounts,
    })
    mocks.loadDecoratedRecentEstimateRows.mockResolvedValue({
      ok: true,
      data: rows,
    })
    mocks.searchDecoratedEstimateRows.mockResolvedValue({
      ok: true,
      data: rows,
    })
    mocks.loadDecoratedEstimateRowsForJob.mockResolvedValue({
      ok: true,
      data: rows,
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
  })

  it('exposes focused summary, recent-activity, and job-count routes', async () => {
    const summaryResponse = await handleEstimateHomeSummaryRouteGet()
    const recentActivityResponse = await handleEstimateHomeRecentActivityRouteGet()
    const jobCountsResponse = await handleEstimateHomeJobCountsRouteGet()

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

  it('returns empty search results for blank queries and filtered results for matching queries', async () => {
    mocks.searchDecoratedEstimateRows.mockResolvedValueOnce({
      ok: true,
      data: [],
    })
    mocks.searchDecoratedEstimateRows.mockResolvedValueOnce({
      ok: true,
      data: [rows[1]],
    })

    const emptyResponse = await handleEstimateHomeSearchRouteGet(
      new Request('http://localhost/api/quotes/home/search?q=')
    )
    const filteredResponse = await handleEstimateHomeSearchRouteGet(
      new Request('http://localhost/api/quotes/home/search?q=garage')
    )

    expect(mocks.searchDecoratedEstimateRows).toHaveBeenNthCalledWith(1, 'org-1', '', {
      includeRollups: true,
    })
    expect(mocks.searchDecoratedEstimateRows).toHaveBeenNthCalledWith(2, 'org-1', 'garage', {
      includeRollups: true,
    })
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

  it('returns an empty job versions payload when the job has no versions', async () => {
    mocks.loadDecoratedEstimateRowsForJob.mockResolvedValueOnce({
      ok: true,
      data: [],
    })

    const response = await handleEstimateJobVersionsRouteGet(
      new Request(
        'http://localhost/api/quotes/home/jobs/33333333-3333-4333-8333-333333333333/versions'
      ),
      {
        params: { jobId: '33333333-3333-4333-8333-333333333333' },
      }
    )

    expect(mocks.loadDecoratedEstimateRowsForJob).toHaveBeenCalledWith(
      'org-1',
      '33333333-3333-4333-8333-333333333333',
      {
        includeRollups: true,
      }
    )
    await expect(response.json()).resolves.toEqual({
      data: {
        job_id: '33333333-3333-4333-8333-333333333333',
        total_versions: 0,
        items: [],
      },
    })
  })

  it('creates versions through the transactional RPC path', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: {
        ok: true,
        id: 'estimate-new',
        estimate: {
          id: 'estimate-new',
          job_id: '11111111-1111-4111-8111-111111111111',
          customer_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          status: 'draft',
          version_name: 'Kitchen Revision 2',
          version_state: 'draft',
          version_kind: 'revision',
          version_sort_order: 2,
          created_at: '2026-04-23T16:00:00.000Z',
          updated_at: '2026-04-23T16:00:00.000Z',
        },
      },
      error: null,
    })

    const response = await handleEstimateCollectionRoutePost(
      new Request('http://localhost/api/estimates', { method: 'POST' }),
      estimateCollectionCopy
    )

    expect(mocks.rpc).toHaveBeenCalledWith('create_estimate_version', {
      p_org_id: 'org-1',
      p_user_id: 'user-1',
      p_job_id: '11111111-1111-4111-8111-111111111111',
      p_customer_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      p_version_state: 'draft',
      p_version_kind: 'revision',
      p_version_name: 'Kitchen Revision 2',
      p_default_version_label: 'Estimate Version',
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

  it('returns structured 404 failures from the transactional RPC without partial success', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: {
        ok: false,
        error_kind: 'not_found',
        error_message: 'Job not found',
      },
      error: null,
    })

    const response = await handleEstimateCollectionRoutePost(
      new Request('http://localhost/api/estimates', { method: 'POST' }),
      estimateCollectionCopy
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Job not found' })
  })

  it('maps transactional initializer failures to server errors', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: {
        ok: false,
        error_kind: 'server_error',
        error_message: 'Failed to initialize estimate_jobsettings',
      },
      error: null,
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

  it('maps pricing policy initialization failures to server errors', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: {
        ok: false,
        error_kind: 'server_error',
        error_message: 'Failed to initialize estimate_pricing_policies',
      },
      error: null,
    })

    const response = await handleEstimateCollectionRoutePost(
      new Request('http://localhost/api/estimates', { method: 'POST' }),
      estimateCollectionCopy
    )

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to initialize estimate_pricing_policies',
    })
  })

  it('maps bounded ordering collisions to 409 conflicts', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: {
        ok: false,
        error_kind: 'conflict',
        error_message: 'Another version was created at the same time. Please retry.',
      },
      error: null,
    })

    const response = await handleEstimateCollectionRoutePost(
      new Request('http://localhost/api/estimates', { method: 'POST' }),
      estimateCollectionCopy
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'Another version was created at the same time. Please retry.',
    })
  })
})
