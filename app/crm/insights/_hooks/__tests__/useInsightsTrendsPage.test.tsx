import { act, renderHook, waitFor } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  EstimateFeedbackTrendSummary,
} from '@/types/estimate-feedback/trends'
import type {
  TrendRecommendationRecord,
} from '@/types/estimate-feedback/recommendations'
import {
  useInsightsTrendsPage,
} from '../useInsightsTrendsPage'

const { replace, searchParamsState } = vi.hoisted(() => ({
  replace: vi.fn(),
  searchParamsState: {
    value: new URLSearchParams(),
  },
}))

const {
  applyTrendRecommendation,
  dismissTrendRecommendation,
  generateTrendRecommendations,
  loadEstimateFeedbackTrends,
  loadTrendRecommendations,
} = vi.hoisted(() => ({
  applyTrendRecommendation: vi.fn(),
  dismissTrendRecommendation: vi.fn(),
  generateTrendRecommendations: vi.fn(),
  loadEstimateFeedbackTrends: vi.fn(),
  loadTrendRecommendations: vi.fn(),
}))

const { useSwrResource } = vi.hoisted(() => ({
  useSwrResource: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/crm/insights',
  useRouter: () => ({ replace }),
  useSearchParams: () => searchParamsState.value,
}))

vi.mock('@/lib/estimate-feedback/client', () => ({
  applyTrendRecommendation,
  dismissTrendRecommendation,
  generateTrendRecommendations,
  loadEstimateFeedbackTrends,
  loadTrendRecommendations,
}))

vi.mock('@/app/crm/_hooks/useSwrResource', () => ({
  useSwrResource,
}))

function wrapper({ children }: PropsWithChildren) {
  return <>{children}</>
}

const summary: EstimateFeedbackTrendSummary = {
  filters: {
    from: null,
    to: null,
    jobType: null,
    occupancy: null,
    conditionTags: [],
    maxAbsoluteVariance: null,
    maxAbsoluteTotalImpact: null,
  },
  averageLaborVariance: null,
  averagePaintVariance: null,
  averageSuppliesVariance: null,
  averageMissPerJob: null,
  portfolioImpact: 0,
  jobsAnalyzed: 0,
  metrics: {
    labor: { averageVariance: null, averageTotalImpact: null, count: 0 },
    paint: { averageVariance: null, averageTotalImpact: null, count: 0 },
    supplies: { averageVariance: null, averageTotalImpact: null, count: 0 },
  },
  patterns: [],
}

function buildRecommendation(
  overrides: Partial<TrendRecommendationRecord> = {}
): TrendRecommendationRecord {
  return {
    id: 'rec-1',
    org_id: 'org-1',
    target_setting_key: 'wall_production.base_rate',
    current_value_json: { base_rate: 120 },
    suggested_value_json: { base_rate: 135 },
    reason: 'Raise base wall production rate.',
    evidence_json: { average_variance: 2.5 },
    evidence_hash: 'hash-1',
    confidence_label: 'medium',
    based_on_job_count: 3,
    status: 'open',
    applied_setting_set_id: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    applied_at: null,
    dismissed_at: null,
    ...overrides,
  }
}

describe('useInsightsTrendsPage', () => {
  let recommendations: TrendRecommendationRecord[]
  let trendsRefresh: ReturnType<typeof vi.fn>
  let recommendationsRefresh: ReturnType<typeof vi.fn>

  beforeEach(() => {
    replace.mockReset()
    applyTrendRecommendation.mockReset()
    dismissTrendRecommendation.mockReset()
    generateTrendRecommendations.mockReset()
    loadEstimateFeedbackTrends.mockReset()
    loadTrendRecommendations.mockReset()
    useSwrResource.mockReset()
    recommendations = [buildRecommendation()]
    trendsRefresh = vi.fn(async () => true)
    recommendationsRefresh = vi.fn(async () => true)
    loadEstimateFeedbackTrends.mockResolvedValue(summary)
    loadTrendRecommendations.mockResolvedValue(recommendations)
    useSwrResource.mockImplementation((_url, options) => {
      void options.load()
      const url = String(_url)
      const isRecommendations = url.includes('/api/insights/recommendations')
      return {
        data: isRecommendations ? recommendations : summary,
        loading: false,
        error: null,
        refresh: isRecommendations ? recommendationsRefresh : trendsRefresh,
        setData: vi.fn((value) => {
          if (!isRecommendations) return
          recommendations =
            typeof value === 'function' ? value(recommendations) : value
        }),
        setError: vi.fn(),
      }
    })
    searchParamsState.value = new URLSearchParams()
  })

  it('loads trend data from filters parsed out of search params', async () => {
    searchParamsState.value = new URLSearchParams(
      'from=2026-01-01&to=2026-01-31&jobType=interior&occupancy=occupied&conditionTag=peeling&conditionTag=trim-heavy&max_absolute_variance=12.5&maxAbsoluteTotalImpact=250'
    )

    const { result } = renderHook(() => useInsightsTrendsPage(), { wrapper })

    await waitFor(() => {
      expect(result.current.hasData).toBe(true)
    })

    expect(loadEstimateFeedbackTrends).toHaveBeenCalledWith({
      from: '2026-01-01',
      to: '2026-01-31',
      jobType: 'interior',
      occupancy: 'occupied',
      conditionTags: ['peeling', 'trim-heavy'],
      maxAbsoluteVariance: 12.5,
      maxAbsoluteTotalImpact: 250,
    })
    expect(loadTrendRecommendations).toHaveBeenCalledWith('open')
    expect(result.current.filterInputs.conditionTags).toBe('peeling, trim-heavy')
    expect(result.current.filterInputs.maxAbsoluteVariance).toBe('12.5')
    expect(result.current.filterInputs.maxAbsoluteTotalImpact).toBe('250')
    expect(result.current.vm?.recommendations).toHaveLength(1)
  })

  it('drops unsupported occupancy and invalid positive-number filters from stale URLs', async () => {
    searchParamsState.value = new URLSearchParams(
      'from=2026-01-01&occupancy=unknown&maxAbsoluteVariance=-1&maxAbsoluteTotalImpact=abc'
    )

    const { result } = renderHook(() => useInsightsTrendsPage(), { wrapper })

    await waitFor(() => {
      expect(result.current.hasData).toBe(true)
    })

    expect(loadEstimateFeedbackTrends).toHaveBeenCalledWith({
      from: '2026-01-01',
      to: null,
      jobType: null,
      occupancy: null,
      conditionTags: [],
      maxAbsoluteVariance: null,
      maxAbsoluteTotalImpact: null,
    })
    expect(useSwrResource).toHaveBeenCalledWith(
      '/crm/insights?from=2026-01-01',
      expect.any(Object)
    )
    expect(result.current.filterInputs.maxAbsoluteVariance).toBe('')
    expect(result.current.filterInputs.maxAbsoluteTotalImpact).toBe('')
  })

  it('writes filter changes back to the insights URL', async () => {
    searchParamsState.value = new URLSearchParams(
      'from=2026-01-01&conditionTag=peeling&maxAbsoluteVariance=12.5'
    )

    const { result } = renderHook(() => useInsightsTrendsPage(), { wrapper })

    await waitFor(() => {
      expect(loadEstimateFeedbackTrends).toHaveBeenCalled()
    })

    act(() => {
      result.current.setFilter('conditionTags', 'peeling, trim-heavy')
    })

    expect(replace).toHaveBeenCalledWith(
      '/crm/insights?from=2026-01-01&maxAbsoluteVariance=12.5&conditionTag=peeling&conditionTag=trim-heavy',
      { scroll: false }
    )

    act(() => {
      result.current.setFilter('maxAbsoluteTotalImpact', '250')
    })

    expect(replace).toHaveBeenLastCalledWith(
      '/crm/insights?from=2026-01-01&maxAbsoluteVariance=12.5&maxAbsoluteTotalImpact=250&conditionTag=peeling',
      { scroll: false }
    )

    act(() => {
      result.current.resetFilters()
    })

    expect(replace).toHaveBeenLastCalledWith('/crm/insights', { scroll: false })
  })

  it('opens confirmation before applying an open recommendation', async () => {
    applyTrendRecommendation.mockResolvedValue({
      data: buildRecommendation({
        status: 'applied',
        applied_setting_set_id: 'set-2',
        applied_at: '2026-01-02T00:00:00.000Z',
      }),
      notice: 'Recommendation applied.',
    })

    const { result } = renderHook(() => useInsightsTrendsPage(), { wrapper })

    await waitFor(() => {
      expect(result.current.vm?.recommendations).toHaveLength(1)
    })

    await act(async () => {
      result.current.applyRecommendation('rec-1')
    })

    expect(result.current.recommendationActionState.confirmingApplyId).toBe('rec-1')
    expect(result.current.vm?.applyConfirmation).toMatchObject({
      isOpen: true,
      description: 'Apply Wall Production Base Rate to estimator settings.',
      confirming: false,
    })
    expect(result.current.vm?.recommendations[0].isPending).toBe(true)
    expect(applyTrendRecommendation).not.toHaveBeenCalled()

    act(() => {
      result.current.cancelApplyRecommendation()
    })

    expect(result.current.recommendationActionState.confirmingApplyId).toBeNull()

    await act(async () => {
      result.current.applyRecommendation('rec-1')
    })

    await act(async () => {
      await result.current.confirmApplyRecommendation()
    })

    expect(applyTrendRecommendation).toHaveBeenCalledWith('rec-1')
    expect(dismissTrendRecommendation).not.toHaveBeenCalled()
    expect(recommendationsRefresh).toHaveBeenCalled()
    expect(trendsRefresh).toHaveBeenCalled()
    expect(result.current.vm?.recommendations).toHaveLength(0)
    expect(result.current.feedback.actionNotice).toBe('Recommendation applied.')
    expect(result.current.recommendationActionState.confirmingApplyId).toBeNull()
  })

  it('dismisses an open recommendation and refreshes open recommendations', async () => {
    dismissTrendRecommendation.mockResolvedValue({
      data: buildRecommendation({
        status: 'dismissed',
        dismissed_at: '2026-01-02T00:00:00.000Z',
      }),
      notice: 'Recommendation updated.',
    })

    const { result } = renderHook(() => useInsightsTrendsPage(), { wrapper })

    await waitFor(() => {
      expect(result.current.vm?.recommendations).toHaveLength(1)
    })

    await act(async () => {
      await result.current.dismissRecommendation('rec-1')
    })

    expect(dismissTrendRecommendation).toHaveBeenCalledWith('rec-1')
    expect(applyTrendRecommendation).not.toHaveBeenCalled()
    expect(recommendationsRefresh).toHaveBeenCalled()
    expect(trendsRefresh).not.toHaveBeenCalled()
    expect(result.current.vm?.recommendations).toHaveLength(0)
  })

  it('generates recommendations from the current filters and refreshes open recommendations', async () => {
    searchParamsState.value = new URLSearchParams(
      'from=2026-01-01&to=2026-01-31&jobType=interior&occupancy=vacant&conditionTag=peeling&maxAbsoluteVariance=15&max_absolute_total_impact=300'
    )
    recommendations = []
    const generatedRecommendation = buildRecommendation({ id: 'rec-2' })
    generateTrendRecommendations.mockResolvedValue({
      data: [generatedRecommendation],
      notice: 'Recommendations generated.',
    })

    const { result } = renderHook(() => useInsightsTrendsPage(), { wrapper })

    await waitFor(() => {
      expect(result.current.vm?.recommendations).toHaveLength(0)
    })

    await act(async () => {
      await result.current.generateRecommendations()
    })

    expect(generateTrendRecommendations).toHaveBeenCalledWith({
      from: '2026-01-01',
      to: '2026-01-31',
      jobType: 'interior',
      occupancy: 'vacant',
      conditionTags: ['peeling'],
      maxAbsoluteVariance: 15,
      maxAbsoluteTotalImpact: 300,
    })
    expect(recommendationsRefresh).toHaveBeenCalled()
    expect(result.current.vm?.recommendations).toHaveLength(1)
    expect(result.current.feedback.actionNotice).toBe('Recommendations generated.')
    expect(result.current.recommendationActionState.generating).toBe(false)
  })

  it('surfaces generation errors without refreshing open recommendations', async () => {
    generateTrendRecommendations.mockRejectedValue(new Error('Trend generation failed.'))

    const { result } = renderHook(() => useInsightsTrendsPage(), { wrapper })

    await waitFor(() => {
      expect(result.current.hasData).toBe(true)
    })

    await act(async () => {
      await result.current.generateRecommendations()
    })

    expect(generateTrendRecommendations).toHaveBeenCalledWith({
      from: null,
      to: null,
      jobType: null,
      occupancy: null,
      conditionTags: [],
      maxAbsoluteVariance: null,
      maxAbsoluteTotalImpact: null,
    })
    expect(recommendationsRefresh).not.toHaveBeenCalled()
    expect(result.current.feedback.actionError).toBe('Trend generation failed.')
    expect(result.current.feedback.actionNotice).toBeNull()
    expect(result.current.recommendationActionState.generating).toBe(false)
  })
})
