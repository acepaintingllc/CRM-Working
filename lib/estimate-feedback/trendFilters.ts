import type { EstimateFeedbackTrendFilters } from '@/types/estimate-feedback/trends'
import {
  buildEstimateFeedbackTrendFilterPath,
  buildEstimateFeedbackTrendFilterSearchParams,
  readEstimateFeedbackTrendFilterQuery,
  updateEstimateFeedbackTrendFilterQueryValue,
  type EstimateFeedbackTrendFilterKey,
} from './trendFilterQuery'

export type { EstimateFeedbackTrendFilterKey }
export {
  estimateFeedbackTrendFilterCanonicalQueryKeys,
  estimateFeedbackTrendFilterQueryAliases,
  readEstimateFeedbackTrendFilterQuery,
  readEstimateFeedbackTrendFilterRawQuery,
} from './trendFilterQuery'

export function parseEstimateFeedbackTrendFilters(
  searchParams: Pick<URLSearchParams, 'get' | 'getAll'>
): EstimateFeedbackTrendFilters {
  return readEstimateFeedbackTrendFilterQuery(searchParams)
}

export function updateEstimateFeedbackTrendFilter(
  filters: EstimateFeedbackTrendFilters,
  key: EstimateFeedbackTrendFilterKey,
  value: string
): EstimateFeedbackTrendFilters {
  return updateEstimateFeedbackTrendFilterQueryValue(filters, key, value)
}

export function buildEstimateFeedbackTrendSearchParams(
  filters?: EstimateFeedbackTrendFilters | null
) {
  return buildEstimateFeedbackTrendFilterSearchParams(filters)
}

export function buildEstimateFeedbackTrendsPath(
  filters?: EstimateFeedbackTrendFilters | null,
  pathname = '/api/insights/trends'
) {
  return buildEstimateFeedbackTrendFilterPath(filters, pathname)
}

export function buildInsightsTrendsPath(
  filters?: EstimateFeedbackTrendFilters | null,
  pathname = '/crm/insights'
) {
  return buildEstimateFeedbackTrendsPath(filters, pathname)
}
