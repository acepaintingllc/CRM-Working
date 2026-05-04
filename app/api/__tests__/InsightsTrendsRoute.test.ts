import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRequireSessionUserOrg, mockLoadEstimateFeedbackTrends } = vi.hoisted(() => ({
  mockRequireSessionUserOrg: vi.fn(),
  mockLoadEstimateFeedbackTrends: vi.fn(),
}))

vi.mock('@/lib/server/apiRoute', async () => ({
  requireSessionUserOrg: mockRequireSessionUserOrg,
  jsonError: (error: string, status: number) =>
    new Response(JSON.stringify({ error }), { status }),
}))

vi.mock('@/lib/server/estimate-feedback/trends', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/server/estimate-feedback/trends')>()

  return {
    ...actual,
    loadEstimateFeedbackTrends: mockLoadEstimateFeedbackTrends,
  }
})

import { GET } from '../insights/trends/route'

const trendSummary = {
  filters: {
    from: '2026-01-01',
    to: '2026-02-01',
    jobType: 'interior',
    occupancy: 'occupied',
    conditionTags: ['peeling', 'trim-heavy'],
  },
  averageLaborVariance: 1.5,
  averagePaintVariance: -0.25,
  averageSuppliesVariance: 12,
  averageMissPerJob: 100,
  portfolioImpact: 300,
  jobsAnalyzed: 3,
  metrics: {
    labor: { averageVariance: 1.5, averageTotalImpact: 80, count: 3 },
    paint: { averageVariance: -0.25, averageTotalImpact: -10, count: 3 },
    supplies: { averageVariance: 12, averageTotalImpact: 30, count: 3 },
  },
  patterns: [],
}

describe('insights trends route', () => {
  beforeEach(() => {
    mockRequireSessionUserOrg.mockReset()
    mockLoadEstimateFeedbackTrends.mockReset()
    mockRequireSessionUserOrg.mockResolvedValue({
      ok: true,
      session: { orgId: 'org-1', userId: 'user-1' },
    })
    mockLoadEstimateFeedbackTrends.mockResolvedValue({ ok: true, data: trendSummary })
  })

  it('returns the standard auth response before service work', async () => {
    mockRequireSessionUserOrg.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401 }),
    })

    const response = await GET(
      new Request('http://localhost/api/insights/trends?start=not-a-date')
    )

    expect(response.status).toBe(401)
    expect(mockLoadEstimateFeedbackTrends).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ error: 'Not authenticated' })
  })

  it('returns a standard 400 error envelope for invalid filters', async () => {
    const response = await GET(
      new Request('http://localhost/api/insights/trends?start=not-a-date')
    )

    expect(response.status).toBe(400)
    expect(mockLoadEstimateFeedbackTrends).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ error: 'from must be a valid date.' })
  })

  it('delegates valid requests with the session org and normalized filters', async () => {
    const response = await GET(
      new Request(
        'http://localhost/api/insights/trends?start=2026-01-01&end=2026-02-01&job_type=interior&occupancy=occupied&conditionTag=peeling&conditionTag=trim-heavy'
      )
    )

    expect(mockLoadEstimateFeedbackTrends).toHaveBeenCalledWith('org-1', {
      from: '2026-01-01',
      to: '2026-02-01',
      jobType: 'interior',
      occupancy: 'occupied',
      conditionTags: ['peeling', 'trim-heavy'],
      maxAbsoluteVariance: null,
      maxAbsoluteTotalImpact: null,
    })
    await expect(response.json()).resolves.toEqual({ data: trendSummary })
  })

  it('parses locked date aliases and repeated condition tag aliases', async () => {
    await GET(
      new Request(
        'http://localhost/api/insights/trends?lockedFrom=2026-03-01&lockedTo=2026-03-31&condition_tags=furnished&condition_tags=walls'
      )
    )

    expect(mockLoadEstimateFeedbackTrends).toHaveBeenCalledWith('org-1', {
      from: '2026-03-01',
      to: '2026-03-31',
      jobType: null,
      occupancy: null,
      conditionTags: ['furnished', 'walls'],
      maxAbsoluteVariance: null,
      maxAbsoluteTotalImpact: null,
    })
  })
})
