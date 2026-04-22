'use client'

import { loadData, mutateData, requestApi, saveData, type ApiMutationEnvelope } from '@/lib/client/api'
import type { QuoteProductPayload } from '@/lib/quotes/productsForm'
import type { CreateQuoteVersionInput } from '@/lib/quotes/versionCreation'
import type { QuoteDefaults } from '@/lib/settings/types'
import type {
  RatesFlagsMutationAction,
  RatesFlagsPayload,
} from '@/types/estimator/ratesFlags'

export {
  loadCustomerSendPage,
  saveCustomerSendDraft,
  submitCustomerSend,
  type CustomerSendMutationResponse,
  type CustomerSendVersion,
} from '@/lib/customer-send/client'

export async function loadQuoteHome<T>() {
  return loadData<T>('/api/quotes/home', { cache: 'no-store' })
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

export async function loadQuoteProducts<T>() {
  return loadData<T>('/api/quotes/products', { cache: 'no-store' })
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

export async function mutateRatesFlags(payload: {
  category: string
  action: RatesFlagsMutationAction
  values: Record<string, unknown>
  original_id?: string
}) {
  return mutateData<boolean>('/api/quotes/rates-flags', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}
