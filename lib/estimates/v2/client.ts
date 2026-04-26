'use client'

import { authedFetch } from '@/lib/auth/authedFetch'
import { getApiErrorMessage, getApiPayloadData, parseApiResponse } from '@/lib/client/api'
import type { RatesFlagsPayload } from '@/types/estimator/ratesFlags'

export type EstimateV2RatesFlagsLoadResult =
  | {
      ok: true
      payload: unknown
    }
  | {
      ok: false
      message: string
    }

export async function loadEstimateV2RatesFlagsPayload(): Promise<EstimateV2RatesFlagsLoadResult> {
  const response = await authedFetch('/api/estimates/v2/rates-flags', {
    cache: 'no-store',
  })
  const parsed = await parseApiResponse(response)
  if (!response.ok) {
    return { ok: false, message: getApiErrorMessage(response, parsed) }
  }

  return { ok: true, payload: getApiPayloadData<RatesFlagsPayload>(parsed.json) }
}
