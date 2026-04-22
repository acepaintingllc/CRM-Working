import { authedFetch } from '../auth/authedFetch.ts'
import {
  requestApiWith,
  type ApiDataEnvelope,
  type ApiMutationEnvelope,
} from './apiCore.ts'

export type {
  ApiDataEnvelope,
  ApiErrorPayload,
  ApiMutationEnvelope,
  ParsedApiResponse,
} from './apiCore.ts'
export { getApiErrorMessage, parseApiResponse } from './apiCore.ts'
export {
  getApiErrorMessage as getResponseErrorMessage,
  parseApiResponse as parseResponseBody,
} from './apiCore.ts'

export async function requestApi<TResponse>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<TResponse> {
  return requestApiWith<TResponse>(authedFetch, input, init)
}

export async function loadData<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const payload = await requestApi<ApiDataEnvelope<T>>(input, init)
  return payload.data
}

export async function saveData<T>(
  input: RequestInfo | URL,
  data: T,
  init?: RequestInit
): Promise<{ data: T; notice: string }> {
  const payload = await requestApi<ApiMutationEnvelope<T>>(input, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    body: JSON.stringify({ data }),
    ...init,
  })

  return {
    data: payload.data,
    notice: payload.notice ?? 'Saved.',
  }
}
