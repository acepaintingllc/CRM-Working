'use client'

import { loadData, mutateData, requestApi, saveData, type ApiMutationEnvelope } from '../client/api.ts'
import {
  normalizeQuoteHomeJobQuery,
  normalizeQuoteHomeSearchQuery,
} from './quoteHomeCursors.ts'
import { quoteRatesFlagsEndpoint } from './ratesFlagsClient.ts'
import type {
  ProductFamily,
  QuoteProductPayload,
  QuoteProductScope,
  QuoteProductStatusFilter,
} from './productsForm.ts'
import type { CreateQuoteVersionInput } from './versionCreation.ts'
import type { QuoteDefaults, QuoteMeasurementAssumptions } from '../settings/types.ts'
import type {
  RatesFlagsPayload,
  RatesFlagsBatchPublishRequest,
} from '../../types/estimator/ratesFlags.ts'

export {
  loadEstimateV2RatesFlagsPayload,
  type EstimateV2RatesFlagsLoadResult,
} from './ratesFlagsClient.ts'

export async function loadQuoteHomeBootstrap<T>() {
  return loadData<T>('/api/quotes/home/bootstrap', { cache: 'no-store' })
}

export async function loadQuoteHomeJobs<T>(options?: {
  query?: string
  limit?: number
  cursor?: string | null
}) {
  const params = new URLSearchParams()
  const query = normalizeQuoteHomeJobQuery(options?.query)
  if (query) {
    params.set('q', query)
  }
  if (options?.limit) {
    params.set('limit', String(options.limit))
  }
  if (options?.cursor) {
    params.set('cursor', options.cursor)
  }

  const suffix = params.toString()
  return loadData<T>(`/api/quotes/home/jobs${suffix ? `?${suffix}` : ''}`, { cache: 'no-store' })
}

export async function loadQuoteHomeSearch<T>(query: string) {
  return loadData<T>(
    `/api/quotes/home/search?q=${encodeURIComponent(normalizeQuoteHomeSearchQuery(query))}`,
    { cache: 'no-store' }
  )
}

export async function loadQuoteJobVersions<T>(
  jobId: string,
  options?: { limit?: number; cursor?: string | null }
) {
  const params = new URLSearchParams()
  if (options?.limit) {
    params.set('limit', String(options.limit))
  }
  if (options?.cursor) {
    params.set('cursor', options.cursor)
  }

  const suffix = params.toString()
  return loadData<T>(
    `/api/quotes/home/jobs/${encodeURIComponent(jobId)}/versions${suffix ? `?${suffix}` : ''}`,
    {
      cache: 'no-store',
    }
  )
}

export async function loadQuoteCreateJobContext<T>(jobId: string) {
  return loadData<T>(
    `/api/quotes/home/jobs/${encodeURIComponent(jobId)}/create-context`,
    {
      cache: 'no-store',
    }
  )
}

export async function createQuoteVersion<T extends { id: string }>(input: CreateQuoteVersionInput) {
  const result = await mutateData<T>('/api/quotes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return result.data
}

export async function deleteQuoteVersion(id: string) {
  return requestApi<ApiMutationEnvelope<unknown>>(`/api/quotes/${id}`, {
    method: 'DELETE',
  })
}

export async function loadQuoteProducts<T>(options: {
  status: QuoteProductStatusFilter
  family?: ProductFamily | null
  scope?: QuoteProductScope | null
  search?: string | null
}) {
  const params = new URLSearchParams()
  params.set('status', options.status)
  if (options.family) params.set('family', options.family)
  if (options.scope) params.set('scope', options.scope)
  if (options.search?.trim()) params.set('search', options.search.trim())

  return loadData<T>(`/api/quotes/products?${params.toString()}`, {
    cache: 'no-store',
  })
}

export async function createQuoteProduct<T>(input: QuoteProductPayload) {
  return requestApi<ApiMutationEnvelope<T>>('/api/quotes/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function loadQuoteCatalogs<T>(id: string, options?: { v2?: boolean }) {
  const suffix = options?.v2 ? '?v2=1' : ''
  return loadData<T>(`/api/quotes/${id}/catalogs${suffix}`, { cache: 'no-store' })
}

export async function updateQuoteProduct<T>(id: string, input: QuoteProductPayload) {
  return requestApi<ApiMutationEnvelope<T>>(`/api/quotes/products/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function archiveQuoteProduct<T>(id: string) {
  return requestApi<ApiMutationEnvelope<T>>(`/api/quotes/products/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'Archived' }),
  })
}

export async function loadQuoteDefaults() {
  return loadData<QuoteDefaults>('/api/settings/quote-defaults', { cache: 'no-store' })
}

export async function saveQuoteDefaults(data: QuoteDefaults) {
  return saveData('/api/settings/quote-defaults', data)
}

export async function loadQuoteMeasurementAssumptions() {
  return loadData<QuoteMeasurementAssumptions>(
    '/api/settings/quote-measurement-assumptions',
    { cache: 'no-store' }
  )
}

export async function saveQuoteMeasurementAssumptions(data: QuoteMeasurementAssumptions) {
  return saveData('/api/settings/quote-measurement-assumptions', data)
}

export async function loadRatesFlags() {
  return loadData<RatesFlagsPayload>(quoteRatesFlagsEndpoint, { cache: 'no-store' })
}

export async function publishRatesFlagsBatch(payload: RatesFlagsBatchPublishRequest) {
  return mutateData<RatesFlagsPayload>('/api/quotes/rates-flags', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}
