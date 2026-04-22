'use client'

import {
  loadData,
  requestApi,
  type ApiDataEnvelope,
  type ApiMutationEnvelope,
} from '@/lib/client/api'
import type {
  CreateCustomerInput,
  CustomerListPage,
  CustomerListQuery,
  CustomerDetail,
  CustomerTimelineEvent,
  UpdateCustomerInput,
} from '@/lib/customers/types'

function buildCustomerListUrl(query: CustomerListQuery = {}) {
  const params = new URLSearchParams()
  const search = query.search?.trim()

  if (search) params.set('search', search)
  if (query.page && query.page > 1) params.set('page', String(query.page))
  if (query.pageSize && query.pageSize !== 50) params.set('pageSize', String(query.pageSize))

  const serialized = params.toString()
  return serialized ? `/api/customers?${serialized}` : '/api/customers'
}

export async function loadCustomerList(query: CustomerListQuery = {}) {
  return loadData<CustomerListPage>(buildCustomerListUrl(query), { cache: 'no-store' })
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
  return requestApi<ApiDataEnvelope<CustomerListPage>>('/api/customers', { cache: 'no-store' })
}
