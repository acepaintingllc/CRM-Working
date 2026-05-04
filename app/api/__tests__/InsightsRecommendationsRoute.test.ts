import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockApplyTrendRecommendation,
  mockGenerateTrendRecommendations,
  mockListTrendRecommendations,
  mockRequireSessionUserOrg,
  mockUpdateTrendRecommendationStatus,
} = vi.hoisted(() => ({
  mockApplyTrendRecommendation: vi.fn(),
  mockGenerateTrendRecommendations: vi.fn(),
  mockListTrendRecommendations: vi.fn(),
  mockRequireSessionUserOrg: vi.fn(),
  mockUpdateTrendRecommendationStatus: vi.fn(),
}))

vi.mock('@/lib/server/apiRoute', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/server/apiRoute')>()

  return {
    ...actual,
    requireSessionUserOrg: mockRequireSessionUserOrg,
    jsonError: (error: string, status: number) =>
      new Response(JSON.stringify({ error }), { status }),
  }
})

vi.mock('@/lib/server/org', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}))

vi.mock('@/lib/server/estimate-feedback/recommendations', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/server/estimate-feedback/recommendations')>()

  return {
    ...actual,
    applyTrendRecommendation: mockApplyTrendRecommendation,
    generateTrendRecommendations: mockGenerateTrendRecommendations,
    listTrendRecommendations: mockListTrendRecommendations,
    updateTrendRecommendationStatus: mockUpdateTrendRecommendationStatus,
  }
})

import {
  GET,
  POST,
} from '../insights/recommendations/route'
import { POST as POSTApply } from '../insights/recommendations/[id]/apply/route'

const recommendationId = '22222222-2222-2222-2222-222222222222'
const actorId = '55555555-5555-4555-8555-555555555555'
const orgId = '11111111-1111-4111-8111-111111111111'

const recommendation = {
  id: recommendationId,
  org_id: orgId,
  target_setting_key: 'production_rates_walls:WALL_STD:sqft_per_hr',
  current_value_json: { sqft_per_hr: 150 },
  suggested_value_json: { sqft_per_hr: 135 },
  reason: 'Adjust labor.',
  evidence_json: { rule_key: 'labor_production_rate_adjustment' },
  evidence_hash: 'hash-1',
  confidence_label: 'high',
  based_on_job_count: 10,
  status: 'open',
  applied_setting_set_id: null,
  created_at: '2026-05-03T12:00:00.000Z',
  updated_at: '2026-05-03T12:00:00.000Z',
  applied_at: null,
  dismissed_at: null,
}

describe('insights recommendations route', () => {
  beforeEach(() => {
    mockApplyTrendRecommendation.mockReset()
    mockGenerateTrendRecommendations.mockReset()
    mockListTrendRecommendations.mockReset()
    mockRequireSessionUserOrg.mockReset()
    mockUpdateTrendRecommendationStatus.mockReset()
    mockRequireSessionUserOrg.mockResolvedValue({
      ok: true,
      session: { orgId, userId: actorId },
    })
    mockListTrendRecommendations.mockResolvedValue({ ok: true, data: [recommendation] })
    mockUpdateTrendRecommendationStatus.mockResolvedValue({
      ok: true,
      data: { ...recommendation, status: 'dismissed' },
    })
    mockApplyTrendRecommendation.mockResolvedValue({
      ok: true,
      data: {
        ...recommendation,
        status: 'applied',
        applied_setting_set_id: '33333333-3333-4333-8333-333333333333',
        applied_at: '2026-05-03T13:00:00.000Z',
      },
    })
  })

  it('returns recommendation lists in a standard data envelope', async () => {
    const response = await GET(
      new Request('http://localhost/api/insights/recommendations?status=open')
    )

    expect(mockListTrendRecommendations).toHaveBeenCalledWith(orgId, 'open')
    await expect(response.json()).resolves.toEqual({ data: [recommendation] })
  })

  it('dismisses through the generic update_status path', async () => {
    const response = await POST(
      new Request('http://localhost/api/insights/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_status',
          recommendationId,
          status: 'dismissed',
        }),
      })
    )

    expect(mockUpdateTrendRecommendationStatus).toHaveBeenCalledWith(orgId, {
      action: 'update_status',
      recommendationId,
      status: 'dismissed',
      appliedSettingSetId: null,
    })
    expect(mockApplyTrendRecommendation).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({
      data: { ...recommendation, status: 'dismissed' },
      notice: 'Recommendation updated.',
    })
  })

  it('rejects applied status through the generic update_status path', async () => {
    const response = await POST(
      new Request('http://localhost/api/insights/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_status',
          recommendationId,
          status: 'applied',
          appliedSettingSetId: '33333333-3333-4333-8333-333333333333',
        }),
      })
    )

    expect(response.status).toBe(400)
    expect(mockUpdateTrendRecommendationStatus).not.toHaveBeenCalled()
    expect(mockApplyTrendRecommendation).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({
      error: 'Use the dedicated apply endpoint to apply recommendations.',
    })
  })

  it('applies only through the dedicated apply endpoint', async () => {
    const response = await POSTApply(
      new Request(
        `http://localhost/api/insights/recommendations/${recommendationId}/apply`,
        { method: 'POST' }
      ),
      { params: { id: recommendationId } }
    )

    expect(mockApplyTrendRecommendation).toHaveBeenCalledWith(orgId, {
      recommendationId,
      actorId,
    })
    await expect(response.json()).resolves.toEqual({
      data: {
        ...recommendation,
        status: 'applied',
        applied_setting_set_id: '33333333-3333-4333-8333-333333333333',
        applied_at: '2026-05-03T13:00:00.000Z',
      },
      notice: 'Recommendation applied.',
    })
  })

  it('returns a standard conflict envelope for stale apply attempts', async () => {
    mockApplyTrendRecommendation.mockResolvedValueOnce({
      ok: false,
      kind: 'conflict',
      message: 'Recommendation is stale because the active setting value has changed.',
    })

    const response = await POSTApply(
      new Request(
        `http://localhost/api/insights/recommendations/${recommendationId}/apply`,
        { method: 'POST' }
      ),
      { params: { id: recommendationId } }
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'Recommendation is stale because the active setting value has changed.',
    })
  })
})
