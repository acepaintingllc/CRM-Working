'use client'

import { loadData, mutateData, requestApi, saveData, type ApiMutationEnvelope } from '@/lib/client/api'
import type {
  ProductFamily,
  QuoteProductPayload,
  QuoteProductStatusFilter,
} from '@/lib/quotes/productsForm'
import type { CreateQuoteVersionInput } from '@/lib/quotes/versionCreation'
import type { QuoteDefaults } from '@/lib/settings/types'
import type {
  RatesFlagsMutationRequestByCategory,
  RatesFlagsPayload,
  RatesFlagsEditableCategoryKey,
} from '@/types/estimator/ratesFlags'

export async function loadQuoteHomeSummary<T>() {
  return loadData<T>('/api/quotes/home/summary', { cache: 'no-store' })
}

export async function loadQuoteHomeJobCounts<T>() {
  return loadData<T>('/api/quotes/home/job-counts', { cache: 'no-store' })
}

export async function loadQuoteHomeSearch<T>(query: string) {
  return loadData<T>(`/api/quotes/home/search?q=${encodeURIComponent(query)}`, { cache: 'no-store' })
}

export async function loadQuoteJobVersions<T>(jobId: string) {
  return loadData<T>(`/api/quotes/home/jobs/${encodeURIComponent(jobId)}/versions`, {
    cache: 'no-store',
  })
}

export async function loadQuoteList<T>() {
  return loadData<T>('/api/quotes', { cache: 'no-store' })
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
  search?: string | null
}) {
  const params = new URLSearchParams()
  params.set('status', options.status)
  if (options.family) params.set('family', options.family)
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

export async function deleteQuoteProduct(id: string) {
  return requestApi<ApiMutationEnvelope<boolean>>(`/api/quotes/products/${id}`, {
    method: 'DELETE',
  })
}

export async function loadQuoteDefaults() {
  return loadData<QuoteDefaults>('/api/settings/quote-defaults', { cache: 'no-store' })
}

export async function saveQuoteDefaults(data: QuoteDefaults) {
  return saveData('/api/settings/quote-defaults', data)
}

export async function loadRatesFlags() {
  return loadData<RatesFlagsPayload>('/api/quotes/rates-flags', { cache: 'no-store' })
}

export async function mutateRatesFlags<
  TCategory extends RatesFlagsEditableCategoryKey,
>(payload: RatesFlagsMutationRequestByCategory<TCategory>) {
  return mutateData<boolean>('/api/quotes/rates-flags', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}
