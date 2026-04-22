'use client'

import { authedFetch } from '@/lib/auth/authedFetch'
import { getApiErrorMessage, parseApiResponse } from '@/lib/client/api'
import type { CrmHomeFetchResponse, CrmHomeSourceErrorKey } from './types'

export async function fetchCrmHomeSource(
  source: CrmHomeSourceErrorKey,
  url: string
): Promise<CrmHomeFetchResponse> {
  try {
    const response = await authedFetch(url, { cache: 'no-store' })
    const payload = await parseApiResponse(response)
    if (!response.ok) {
      return {
        source,
        ok: false,
        payload: payload.json,
        errorMessage: getApiErrorMessage(
          response,
          payload,
          `Request failed with status ${response.status}.`
        ),
      }
    }

    return {
      source,
      ok: true,
      payload: payload.json,
      errorMessage: null,
    }
  } catch (error) {
    return {
      source,
      ok: false,
      payload: null,
      errorMessage: error instanceof Error ? error.message : 'Request failed.',
    }
  }
}
