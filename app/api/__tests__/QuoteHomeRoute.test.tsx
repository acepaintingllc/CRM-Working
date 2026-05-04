import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  makePagedQuoteHomeVersions,
  makeQuoteHomeSearchResult,
  quoteHomeBootstrap,
  quoteHomeJobs,
} from '@/test-support/quoteHomeFixtures'
import { QUOTE_HOME_SEARCH_SOURCE_RANK } from '@/lib/quotes/quoteHomeTypes'
import { selectQuoteHomeSearchRows } from '@/lib/quotes/quoteHomeSearch'
import type { EstimateCollectionVersionRow } from '@/lib/server/estimate-collection/types'

const mocks = vi.hoisted(() => ({
  requireSessionUserOrg: vi.fn(),
  loadEstimateCollectionBootstrapPayload: vi.fn(),
  loadEstimateCollectionJobVersionsPayload: vi.fn(),
  loadEstimateCollectionJobsPayload: vi.fn(),
  loadEstimateCollectionQuoteCreateContextPayload: vi.fn(),
  loadEstimateCollectionSearchPayload: vi.fn(),
}))

vi.mock('@/lib/server/apiRoute', () => ({
  requireSessionUserOrg: mocks.requireSessionUserOrg,
  jsonError: (error: string, status: number) => Response.json({ error }, { status }),
  resolveParams: (context: { params: unknown }) => Promise.resolve(context.params),
  readUuidParam: (value: unknown, label: string) => {
    const text = String(value ?? '')
    if (text.split('-').length !== 5) {
      return {
        ok: false as const,
        response: Response.json({ error: `Invalid ${label}` }, { status: 400 }),
      }
    }
    return { ok: true as const, value: text }
  },
  readJsonBody: vi.fn(),
}))

vi.mock('@/lib/server/estimate-collection/service', () => ({
  loadEstimateCollectionBootstrapPayload: mocks.loadEstimateCollectionBootstrapPayload,
  loadEstimateCollectionJobVersionsPayload: mocks.loadEstimateCollectionJobVersionsPayload,
  loadEstimateCollectionJobsPayload: mocks.loadEstimateCollectionJobsPayload,
  loadEstimateCollectionQuoteCreateContextPayload: mocks.loadEstimateCollectionQuoteCreateContextPayload,
  loadEstimateCollectionSearchPayload: mocks.loadEstimateCollectionSearchPayload,
  loadEstimateCollectionPayload: vi.fn(),
  createEstimateCollectionVersion: vi.fn(),
}))

import { GET as getQuoteHomeBootstrap } from '../quotes/home/bootstrap/route'
import { GET as getQuoteHomeJobs } from '../quotes/home/jobs/route'
import { GET as getQuoteHomeSearch } from '../quotes/home/search/route'
import { GET as getQuoteCreateContext } from '../quotes/home/jobs/[jobId]/create-context/route'
import { GET as getQuoteJobVersions } from '../quotes/home/jobs/[jobId]/versions/route'

const authedSession = {
  ok: true as const,
  session: { orgId: 'org-1', userId: 'user-1' },
}

function makeSearchRow(
  id: string,
  updatedAt: string,
  overrides: Partial<EstimateCollectionVersionRow> = {}
): EstimateCollectionVersionRow {
  return {
    id,
    job_id: 'job-1',
    customer_id: 'customer-1',
    status: 'draft',
    version_name: 'Version',
    version_state: 'draft',
    version_kind: 'standard',
    version_sort_order: 1,
    created_at: '2026-04-20T10:00:00.000Z',
    updated_at: updatedAt,
    ...overrides,
  }
}

describe('quote home API routes', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.requireSessionUserOrg.mockResolvedValue(authedSession)
    mocks.loadEstimateCollectionBootstrapPayload.mockResolvedValue({
      ok: true,
      data: quoteHomeBootstrap,
    })
    mocks.loadEstimateCollectionJobsPayload.mockResolvedValue({
      ok: true,
      data: { query: '', limit: 25, next_cursor: null, items: quoteHomeJobs },
    })
    mocks.loadEstimateCollectionSearchPayload.mockResolvedValue({
      ok: true,
      data: { query: 'kit', items: [makeQuoteHomeSearchResult('estimate-2')] },
    })
    mocks.loadEstimateCollectionJobVersionsPayload.mockResolvedValue({
      ok: true,
      data: makePagedQuoteHomeVersions({ jobId: '33333333-3333-4333-8333-333333333333', count: 2 }),
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
  })

  it('requires auth before quote home service work', async () => {
    mocks.requireSessionUserOrg.mockImplementation(() => Promise.resolve({
      ok: false,
      response: Response.json({ error: 'Not authenticated' }, { status: 401 }),
    }))
    const versionContext = { params: { jobId: '33333333-3333-4333-8333-333333333333' } }
    const createContext = { params: { jobId: '33333333-3333-4333-8333-333333333333' } }

    const responses = await Promise.all([
      getQuoteHomeBootstrap(),
      getQuoteHomeJobs(new Request('http://localhost/api/quotes/home/jobs?q=kit')),
      getQuoteHomeSearch(new Request('http://localhost/api/quotes/home/search?q=kit')),
      getQuoteJobVersions(
        new Request(
          'http://localhost/api/quotes/home/jobs/33333333-3333-4333-8333-333333333333/versions'
        ),
        versionContext
      ),
      getQuoteCreateContext(
        new Request(
          'http://localhost/api/quotes/home/jobs/33333333-3333-4333-8333-333333333333/create-context'
        ),
        createContext
      ),
    ])

    expect(responses.map((response) => response.status)).toEqual([401, 401, 401, 401, 401])
    for (const response of responses) {
      await expect(response.json()).resolves.toEqual({ error: 'Not authenticated' })
    }
    expect(mocks.loadEstimateCollectionBootstrapPayload).not.toHaveBeenCalled()
    expect(mocks.loadEstimateCollectionJobsPayload).not.toHaveBeenCalled()
    expect(mocks.loadEstimateCollectionSearchPayload).not.toHaveBeenCalled()
    expect(mocks.loadEstimateCollectionJobVersionsPayload).not.toHaveBeenCalled()
    expect(mocks.loadEstimateCollectionQuoteCreateContextPayload).not.toHaveBeenCalled()
  })

  it('keeps approved quote home reads in data envelopes', async () => {
    const bootstrapResponse = await getQuoteHomeBootstrap()
    expect(bootstrapResponse.status).toBe(200)
    await expect(bootstrapResponse.json()).resolves.toEqual({
      data: quoteHomeBootstrap,
    })
    expect(mocks.loadEstimateCollectionBootstrapPayload).toHaveBeenCalledWith('org-1')

    const jobsResponse = await getQuoteHomeJobs(
      new Request('http://localhost/api/quotes/home/jobs?q=kit&cursor=next&limit=10')
    )
    expect(jobsResponse.status).toBe(200)
    await expect(jobsResponse.json()).resolves.toEqual({
      data: { query: '', limit: 25, next_cursor: null, items: quoteHomeJobs },
    })
    expect(mocks.loadEstimateCollectionJobsPayload).toHaveBeenCalledWith('org-1', {
      query: 'kit',
      cursor: 'next',
      limit: 10,
    })

    const searchResponse = await getQuoteHomeSearch(
      new Request('http://localhost/api/quotes/home/search?q=kit')
    )
    expect(searchResponse.status).toBe(200)
    await expect(searchResponse.json()).resolves.toEqual({
      data: { query: 'kit', items: [makeQuoteHomeSearchResult('estimate-2')] },
    })
    expect(mocks.loadEstimateCollectionSearchPayload).toHaveBeenCalledWith('org-1', 'kit')

    const versionsResponse = await getQuoteJobVersions(
      new Request(
        'http://localhost/api/quotes/home/jobs/33333333-3333-4333-8333-333333333333/versions?cursor=v2&limit=5'
      ),
      { params: { jobId: '33333333-3333-4333-8333-333333333333' } }
    )
    expect(versionsResponse.status).toBe(200)
    await expect(versionsResponse.json()).resolves.toEqual({
      data: makePagedQuoteHomeVersions({
        jobId: '33333333-3333-4333-8333-333333333333',
        count: 2,
      }),
    })
    expect(mocks.loadEstimateCollectionJobVersionsPayload).toHaveBeenCalledWith(
      'org-1',
      '33333333-3333-4333-8333-333333333333',
      {
        cursor: 'v2',
        limit: 5,
      }
    )

    const createContextResponse = await getQuoteCreateContext(
      new Request(
        'http://localhost/api/quotes/home/jobs/33333333-3333-4333-8333-333333333333/create-context'
      ),
      { params: { jobId: '33333333-3333-4333-8333-333333333333' } }
    )
    expect(createContextResponse.status).toBe(200)
    await expect(createContextResponse.json()).resolves.toEqual({
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

  it('keeps quote home service and validation errors in error envelopes', async () => {
    mocks.loadEstimateCollectionBootstrapPayload.mockResolvedValueOnce({
      ok: false,
      kind: 'server_error',
      message: 'bootstrap failed',
    })
    const bootstrapResponse = await getQuoteHomeBootstrap()
    expect(bootstrapResponse.status).toBe(500)
    await expect(bootstrapResponse.json()).resolves.toEqual({ error: 'bootstrap failed' })

    mocks.loadEstimateCollectionJobsPayload.mockResolvedValueOnce({
      ok: false,
      kind: 'invalid_input',
      message: 'Invalid jobs cursor.',
    })
    const jobsResponse = await getQuoteHomeJobs(
      new Request('http://localhost/api/quotes/home/jobs?cursor=bad')
    )
    expect(jobsResponse.status).toBe(400)
    await expect(jobsResponse.json()).resolves.toEqual({ error: 'Invalid jobs cursor.' })

    mocks.loadEstimateCollectionSearchPayload.mockResolvedValueOnce({
      ok: false,
      kind: 'server_error',
      message: 'search failed',
    })
    const searchResponse = await getQuoteHomeSearch(
      new Request('http://localhost/api/quotes/home/search?q=kit')
    )
    expect(searchResponse.status).toBe(500)
    await expect(searchResponse.json()).resolves.toEqual({ error: 'search failed' })

    mocks.loadEstimateCollectionJobVersionsPayload.mockResolvedValueOnce({
      ok: false,
      kind: 'invalid_input',
      message: 'Invalid cursor.',
    })
    const errorResponse = await getQuoteJobVersions(
      new Request(
        'http://localhost/api/quotes/home/jobs/33333333-3333-4333-8333-333333333333/versions?cursor=bad'
      ),
      { params: { jobId: '33333333-3333-4333-8333-333333333333' } }
    )

    expect(errorResponse.status).toBe(400)
    await expect(errorResponse.json()).resolves.toEqual({ error: 'Invalid cursor.' })

    mocks.loadEstimateCollectionQuoteCreateContextPayload.mockResolvedValueOnce({
      ok: false,
      kind: 'not_found',
      message: 'Job not found.',
    })
    const createContextResponse = await getQuoteCreateContext(
      new Request(
        'http://localhost/api/quotes/home/jobs/33333333-3333-4333-8333-333333333333/create-context'
      ),
      { params: { jobId: '33333333-3333-4333-8333-333333333333' } }
    )

    expect(createContextResponse.status).toBe(404)
    await expect(createContextResponse.json()).resolves.toEqual({ error: 'Job not found.' })
  })

  it('returns under-filled jobs pages in the standard data envelope', async () => {
    mocks.loadEstimateCollectionJobsPayload.mockResolvedValueOnce({
      ok: true,
      data: {
        query: 'kit',
        limit: 2,
        next_cursor: '2026-04-24T11:00:00.000Z::33333333-3333-4333-8333-333333333333',
        items: [quoteHomeJobs[0]],
      },
    })

    const response = await getQuoteHomeJobs(
      new Request('http://localhost/api/quotes/home/jobs?q=kit&limit=2')
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: {
        query: 'kit',
        limit: 2,
        next_cursor: '2026-04-24T11:00:00.000Z::33333333-3333-4333-8333-333333333333',
        items: [quoteHomeJobs[0]],
      },
    })
  })

  it('rejects invalid job ids after auth and before service work', async () => {
    const response = await getQuoteJobVersions(
      new Request('http://localhost/api/quotes/home/jobs/not-a-uuid/versions'),
      { params: { jobId: 'not-a-uuid' } }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid job id' })
    expect(mocks.requireSessionUserOrg).toHaveBeenCalledTimes(1)
    expect(mocks.loadEstimateCollectionJobVersionsPayload).not.toHaveBeenCalled()

    const createContextResponse = await getQuoteCreateContext(
      new Request('http://localhost/api/quotes/home/jobs/not-a-uuid/create-context'),
      { params: { jobId: 'not-a-uuid' } }
    )

    expect(createContextResponse.status).toBe(400)
    await expect(createContextResponse.json()).resolves.toEqual({ error: 'Invalid job id' })
    expect(mocks.loadEstimateCollectionQuoteCreateContextPayload).not.toHaveBeenCalled()
  })

  it('rejects invalid limits after auth and before service work', async () => {
    const jobsResponse = await getQuoteHomeJobs(
      new Request('http://localhost/api/quotes/home/jobs?limit=bogus')
    )
    expect(jobsResponse.status).toBe(400)
    await expect(jobsResponse.json()).resolves.toEqual({ error: 'Invalid limit.' })

    const versionsResponse = await getQuoteJobVersions(
      new Request(
        'http://localhost/api/quotes/home/jobs/33333333-3333-4333-8333-333333333333/versions?limit=0'
      ),
      { params: { jobId: '33333333-3333-4333-8333-333333333333' } }
    )
    expect(versionsResponse.status).toBe(400)
    await expect(versionsResponse.json()).resolves.toEqual({ error: 'Invalid limit.' })

    expect(mocks.requireSessionUserOrg).toHaveBeenCalledTimes(2)
    expect(mocks.loadEstimateCollectionJobsPayload).not.toHaveBeenCalled()
    expect(mocks.loadEstimateCollectionJobVersionsPayload).not.toHaveBeenCalled()
  })

  it('treats empty search as a successful empty query read', async () => {
    mocks.loadEstimateCollectionSearchPayload.mockResolvedValueOnce({
      ok: true,
      data: { query: '', items: [] },
    })

    const response = await getQuoteHomeSearch(
      new Request('http://localhost/api/quotes/home/search?q=%20%20')
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: { query: '', items: [] },
    })
    expect(mocks.loadEstimateCollectionSearchPayload).toHaveBeenCalledWith('org-1', '')
  })

  it('returns quote home search DB failures in the standard error envelope', async () => {
    mocks.loadEstimateCollectionSearchPayload.mockResolvedValueOnce({
      ok: false,
      kind: 'server_error',
      message: 'database unavailable',
    })

    const response = await getQuoteHomeSearch(
      new Request('http://localhost/api/quotes/home/search?q=revision')
    )

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'database unavailable' })
  })

  it('ranks version, job, and customer quote home search matches by explicit source policy', () => {
    const versionMatch = makeSearchRow('estimate-version', '2026-04-20T10:00:00.000Z')
    const jobMatch = makeSearchRow('estimate-job', '2026-04-24T10:00:00.000Z')
    const customerMatch = makeSearchRow('estimate-customer', '2026-04-23T10:00:00.000Z')

    expect(QUOTE_HOME_SEARCH_SOURCE_RANK).toEqual({ version: 0, job: 1, customer: 2 })
    expect(
      selectQuoteHomeSearchRows({
        query: 'kitchen',
        candidateLimit: 6,
        limit: 6,
        versionRows: [versionMatch],
        jobRows: [jobMatch],
        customerRows: [customerMatch],
      }).map((row) => row.id)
    ).toEqual(['estimate-version', 'estimate-job', 'estimate-customer'])
  })

  it('dedupes duplicate quote home search rows deterministically before capping', () => {
    const duplicateFromVersion = makeSearchRow('estimate-duplicate', '2026-04-20T10:00:00.000Z', {
      version_name: 'Version source wins',
    })
    const duplicateFromJob = makeSearchRow('estimate-duplicate', '2026-04-24T10:00:00.000Z', {
      version_name: 'Job source loses',
    })
    const customerMatch = makeSearchRow('estimate-customer', '2026-04-23T10:00:00.000Z')

    const selected = selectQuoteHomeSearchRows({
      query: 'kitchen',
      candidateLimit: 6,
      limit: 2,
      versionRows: [duplicateFromVersion],
      jobRows: [duplicateFromJob],
      customerRows: [customerMatch],
    })

    expect(selected.map((row) => row.id)).toEqual(['estimate-duplicate', 'estimate-customer'])
    expect(selected[0]?.version_name).toBe('Version source wins')
  })

  it('authenticates job-version reads before validating route params', async () => {
    mocks.requireSessionUserOrg.mockResolvedValueOnce({
      ok: false,
      response: Response.json({ error: 'Not authenticated' }, { status: 401 }),
    })

    const response = await getQuoteJobVersions(
      new Request('http://localhost/api/quotes/home/jobs/not-a-uuid/versions'),
      { params: { jobId: 'not-a-uuid' } }
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Not authenticated' })
    expect(mocks.loadEstimateCollectionJobVersionsPayload).not.toHaveBeenCalled()
  })
})
