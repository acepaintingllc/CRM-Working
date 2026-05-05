'use client'

import {
  loadData,
  type ApiMutationEnvelope,
  requestApi,
} from '@/lib/client/api'
import { buildEstimateFeedbackTrendsPath } from './trendFilters'
import type {
  EstimateFeedbackTrendFilters,
  EstimateFeedbackTrendSummary,
} from '@/types/estimate-feedback/trends'
import type {
  TrendRecommendationRecord,
  TrendRecommendationStatus,
  TrendRecommendationStatusUpdate,
} from '@/types/estimate-feedback/recommendations'

function recommendationsPath(status?: TrendRecommendationStatus | null) {
  const search = new URLSearchParams()
  if (status) search.set('status', status)
  const query = search.toString()
  return `/api/insights/recommendations${query ? `?${query}` : ''}`
}

function recommendationApplyPath(recommendationId: string) {
  return `/api/insights/recommendations/${encodeURIComponent(recommendationId)}/apply`
}

export async function loadEstimateFeedbackTrends(
  filters?: EstimateFeedbackTrendFilters | null
) {
  return loadData<EstimateFeedbackTrendSummary>(buildEstimateFeedbackTrendsPath(filters), {
    cache: 'no-store',
  })
}

export async function loadTrendRecommendations(status?: TrendRecommendationStatus | null) {
  return loadData<TrendRecommendationRecord[]>(recommendationsPath(status), {
    cache: 'no-store',
  })
}

export async function generateTrendRecommendations(
  filters?: EstimateFeedbackTrendFilters | null
) {
  return requestApi<ApiMutationEnvelope<TrendRecommendationRecord[]>>(
    recommendationsPath(),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'generate',
        from: filters?.from ?? null,
        to: filters?.to ?? null,
        jobType: filters?.jobType ?? null,
        occupancy: filters?.occupancy ?? null,
        conditionTags: filters?.conditionTags ?? [],
        maxAbsoluteVariance: filters?.maxAbsoluteVariance ?? null,
        maxAbsoluteTotalImpact: filters?.maxAbsoluteTotalImpact ?? null,
      }),
    }
  )
}

export async function updateTrendRecommendationStatus(
  recommendationId: string,
  status: TrendRecommendationStatusUpdate
) {
  return requestApi<ApiMutationEnvelope<TrendRecommendationRecord>>(
    recommendationsPath(),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_status',
        recommendationId,
        status,
      }),
    }
  )
}

export async function applyTrendRecommendation(recommendationId: string) {
  return requestApi<ApiMutationEnvelope<TrendRecommendationRecord>>(
    recommendationApplyPath(recommendationId),
    {
      method: 'POST',
    }
  )
}

export async function dismissTrendRecommendation(recommendationId: string) {
  return updateTrendRecommendationStatus(recommendationId, 'dismissed')
}
