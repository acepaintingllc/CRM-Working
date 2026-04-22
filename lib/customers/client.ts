'use client'

import {
  loadData,
  requestApi,
  type ApiDataEnvelope,
  type ApiMutationEnvelope,
} from '@/lib/client/api'
import type {
  CreateCustomerInput,
  CustomerDetail,
  CustomerSummary,
  CustomerTimelineEvent,
  UpdateCustomerInput,
} from '@/lib/customers/types'

export async function loadCustomerList() {
  return loadData<CustomerSummary[]>('/api/customers', { cache: 'no-store' })
}

export async function createCustomer(input: CreateCustomerInput) {
  return requestApi<ApiMutationEnvelope<CustomerDetail>>('/api/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function loadCustomerDetail(id: string) {
  return loadData<CustomerDetail>(`/api/customers/${id}`, { cache: 'no-store' })
}

export async function updateCustomer(id: string, input: UpdateCustomerInput) {
  return requestApi<ApiMutationEnvelope<CustomerDetail>>(`/api/customers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function deleteCustomer(id: string) {
  return requestApi<ApiMutationEnvelope<boolean>>(`/api/customers/${id}`, {
    method: 'DELETE',
  })
}

export async function loadCustomerTimeline(customerId: string) {
  return loadData<CustomerTimelineEvent[]>(`/api/customers/${customerId}/timeline`, {
    cache: 'no-store',
  })
}

export async function saveCustomerTimelineNote(customerId: string, body: string) {
  return requestApi<ApiMutationEnvelope<CustomerTimelineEvent>>(
    `/api/customers/${customerId}/timeline`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    }
  )
}

export async function loadCustomersEnvelope() {
  return requestApi<ApiDataEnvelope<CustomerSummary[]>>('/api/customers', { cache: 'no-store' })
}
