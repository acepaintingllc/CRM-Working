'use client'

import { loadData, mutateData, requestApi, saveData, type ApiMutationEnvelope } from '@/lib/client/api'
import type { QuoteDefaults } from '@/lib/settings/types'
import type {
  RatesFlagsMutationAction,
  RatesFlagsPayload,
} from '@/types/estimator/ratesFlags'

type CreateQuoteVersionInput = {
  job_id: string
  customer_id: string
  version_kind: string
  version_name?: string
}

export type CustomerSendVersion = {
  status?: string | null
  sent_at?: string | null
  viewed_at?: string | null
  accepted_at?: string | null
  declined_at?: string | null
  public_token?: string | null
}

export type CustomerSendMutationResponse = {
  public_url?: string | null
  version?: CustomerSendVersion | null
}

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

export async function updateQuoteProduct<T>(id: string, input: Partial<T>) {
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

export async function loadCustomerSendPage<T>(url: string) {
  return loadData<T>(url, { cache: 'no-store' })
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

export async function saveCustomerSendDraft<T extends CustomerSendMutationResponse>(
  url: string,
  draft: Record<string, unknown>
) {
  const result = await mutateData<T>(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ draft }),
  })
  return result.data
}

export async function submitCustomerSend<T extends CustomerSendMutationResponse>(
  url: string,
  payload: { mode: 'test' | 'send'; draft: Record<string, unknown> }
) {
  const result = await mutateData<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return result.data
}
