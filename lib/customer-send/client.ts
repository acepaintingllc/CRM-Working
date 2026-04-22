'use client'

import { loadData, mutateData, type ApiMutationEnvelope } from '@/lib/client/api'

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

export async function loadCustomerSendPage<T>(url: string) {
  return loadData<T>(url, { cache: 'no-store' })
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

export type { ApiMutationEnvelope }
