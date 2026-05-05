'use client'

import { useCallback, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useSwrResource } from '@/app/crm/_hooks/useSwrResource'
import {
  applyTrendRecommendation,
  dismissTrendRecommendation,
  generateTrendRecommendations,
  loadEstimateFeedbackTrends,
  loadTrendRecommendations,
} from '@/lib/estimate-feedback/client'
import {
  buildInsightsTrendsPath,
  parseEstimateFeedbackTrendFilters,
  updateEstimateFeedbackTrendFilter,
  type EstimateFeedbackTrendFilterKey,
} from '@/lib/estimate-feedback/trendFilters'
import type {
  EstimateFeedbackTrendFilters,
  EstimateFeedbackTrendSummary,
} from '@/types/estimate-feedback/trends'
import type { TrendRecommendationRecord } from '@/types/estimate-feedback/recommendations'
import { buildInsightsTrendsPageVm } from './insightsTrendsVm'

type FilterKey = EstimateFeedbackTrendFilterKey
type RecommendationAction = 'apply' | 'dismiss'

const emptyTags: string[] = []
const openRecommendationsKey = '/api/insights/recommendations?status=open'

export function useInsightsTrendsPage() {
  const router = useRouter()
  const pathname = usePathname() || '/crm/insights'
  const searchParams = useSearchParams()
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionNotice, setActionNotice] = useState<string | null>(null)
  const [pendingRecommendation, setPendingRecommendation] = useState<{
    id: string
    action: RecommendationAction
  } | null>(null)
  const [confirmingApplyRecommendationId, setConfirmingApplyRecommendationId] =
    useState<string | null>(null)
  const [generatingRecommendations, setGeneratingRecommendations] = useState(false)
  const filters = useMemo(
    () => parseEstimateFeedbackTrendFilters(searchParams),
    [searchParams]
  )
  const resourceKey = useMemo(() => buildInsightsTrendsPath(filters), [filters])
  const resource = useSwrResource<EstimateFeedbackTrendSummary>(resourceKey, {
    load: () => loadEstimateFeedbackTrends(filters),
  })
  const recommendationsResource = useSwrResource<TrendRecommendationRecord[]>(
    openRecommendationsKey,
    {
      load: () => loadTrendRecommendations('open'),
    }
  )
  const summary = resource.data ?? null
  const recommendations = recommendationsResource.data ?? null
  const vm = useMemo(
    () => (summary && recommendations ? buildInsightsTrendsPageVm(summary, recommendations) : null),
    [recommendations, summary]
  )

  const replaceFilters = useCallback(
    (next: EstimateFeedbackTrendFilters) => {
      router.replace(buildInsightsTrendsPath(next, pathname), { scroll: false })
    },
    [pathname, router]
  )

  const setFilter = useCallback(
    (key: FilterKey, value: string) => {
      replaceFilters(updateEstimateFeedbackTrendFilter(filters, key, value))
    },
    [filters, replaceFilters]
  )

  const resetFilters = useCallback(() => {
    replaceFilters({})
  }, [replaceFilters])

  const syncRecommendation = useCallback(
    (recommendation: TrendRecommendationRecord) => {
      recommendationsResource.setData((current) => {
        if (recommendation.status !== 'open') {
          return current.filter((item) => item.id !== recommendation.id)
        }

        const exists = current.some((item) => item.id === recommendation.id)
        if (!exists) return [recommendation, ...current]
        return current.map((item) =>
          item.id === recommendation.id ? recommendation : item
        )
      })
    },
    [recommendationsResource]
  )

  const runRecommendationAction = useCallback(
    async (recommendationId: string, action: RecommendationAction) => {
      setActionError(null)
      setActionNotice(null)
      setPendingRecommendation({ id: recommendationId, action })

      try {
        const response =
          action === 'apply'
            ? await applyTrendRecommendation(recommendationId)
            : await dismissTrendRecommendation(recommendationId)

        syncRecommendation(response.data)
        void recommendationsResource.refresh()
        if (action === 'apply') void resource.refresh()

        setActionNotice(
          response.notice ??
            (action === 'apply'
              ? 'Recommendation applied.'
              : 'Recommendation dismissed.')
        )
        return true
      } catch (error) {
        setActionError(error instanceof Error ? error.message : 'Recommendation update failed.')
        return false
      } finally {
        setPendingRecommendation((current) =>
          current?.id === recommendationId && current.action === action ? null : current
        )
      }
    },
    [recommendationsResource, resource, syncRecommendation]
  )

  const applyRecommendation = useCallback(
    (recommendationId: string) => {
      setActionError(null)
      setActionNotice(null)
      setConfirmingApplyRecommendationId(recommendationId)
    },
    []
  )

  const cancelApplyRecommendation = useCallback(() => {
    setConfirmingApplyRecommendationId(null)
  }, [])

  const confirmApplyRecommendation = useCallback(async () => {
    if (!confirmingApplyRecommendationId) return
    const recommendationId = confirmingApplyRecommendationId
    const applied = await runRecommendationAction(recommendationId, 'apply')
    if (applied) {
      setConfirmingApplyRecommendationId((current) =>
        current === recommendationId ? null : current
      )
    }
  }, [confirmingApplyRecommendationId, runRecommendationAction])

  const dismissRecommendation = useCallback(
    (recommendationId: string) => runRecommendationAction(recommendationId, 'dismiss'),
    [runRecommendationAction]
  )

  const generateRecommendations = useCallback(async () => {
    setActionError(null)
    setActionNotice(null)
    setGeneratingRecommendations(true)

    try {
      const response = await generateTrendRecommendations(filters)
      recommendationsResource.setData(response.data)
      void recommendationsResource.refresh()
      setActionNotice(response.notice ?? 'Recommendations generated.')
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Recommendation generation failed.'
      )
    } finally {
      setGeneratingRecommendations(false)
    }
  }, [filters, recommendationsResource])

  return {
    loading: resource.loading || recommendationsResource.loading,
    error: resource.error ?? recommendationsResource.error,
    hasData: Boolean(summary && recommendations),
    summary,
    vm,
    filters,
    feedback: {
      actionError,
      actionNotice,
    },
    recommendationActionState: {
      pendingId: pendingRecommendation?.id ?? null,
      pendingAction: pendingRecommendation?.action ?? null,
      generating: generatingRecommendations,
      confirmingApplyId: confirmingApplyRecommendationId,
    },
    filterInputs: {
      conditionTags: (filters.conditionTags ?? emptyTags).join(', '),
      maxAbsoluteVariance:
        filters.maxAbsoluteVariance != null ? String(filters.maxAbsoluteVariance) : '',
      maxAbsoluteTotalImpact:
        filters.maxAbsoluteTotalImpact != null
          ? String(filters.maxAbsoluteTotalImpact)
          : '',
    },
    setFilter,
    resetFilters,
    applyRecommendation,
    cancelApplyRecommendation,
    confirmApplyRecommendation,
    dismissRecommendation,
    generateRecommendations,
    refresh: async () => {
      const [trendsRefreshed, recommendationsRefreshed] = await Promise.all([
        resource.refresh(),
        recommendationsResource.refresh(),
      ])
      return trendsRefreshed && recommendationsRefreshed
    },
  }
}
