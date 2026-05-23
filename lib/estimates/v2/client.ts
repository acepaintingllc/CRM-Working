'use client'

import type { RawApiResponse } from '../../client/api.ts'
import type { EstimateV2SavePayload } from '@/types/estimator/v2Summary'

export {
  loadEstimateV2RatesFlagsPayload,
  type EstimateV2RatesFlagsLoadResult,
} from '../../quotes/ratesFlagsClient.ts'

export type EstimateV2SaveTrigger = 'manual' | 'auto'

export type EstimateV2SaveClientResult = RawApiResponse<unknown> & {
  endpoint: string
  method: 'PUT'
}

export type EstimateV2SaveRequester = (
  input: RequestInfo | URL,
  init?: RequestInit,
  fallbackErrorMessage?: string
) => Promise<RawApiResponse<unknown>>

const defaultEstimateV2SaveRequester: EstimateV2SaveRequester = async (
  input,
  init,
  fallbackErrorMessage
) => {
  const api = await import('../../client/api.ts')
  return api.requestRawApi<unknown>(input, init, fallbackErrorMessage)
}

function buildEstimateV2SaveHeaders(params: {
  trigger?: EstimateV2SaveTrigger
  headers?: HeadersInit
}) {
  const headers = new Headers(params.headers)
  headers.set('Content-Type', 'application/json')
  if (params.trigger === 'auto') {
    headers.set('X-Estimate-Save-Mode', 'auto')
  }
  return headers
}

export async function saveEstimateV2Inputs(
  params: {
    endpoint: string
    payload: EstimateV2SavePayload
    trigger?: EstimateV2SaveTrigger
    headers?: HeadersInit
  },
  requestRawApiImpl: EstimateV2SaveRequester = defaultEstimateV2SaveRequester
): Promise<EstimateV2SaveClientResult> {
  const method = 'PUT' as const
  const result = await requestRawApiImpl(
    params.endpoint,
    {
      method,
      headers: buildEstimateV2SaveHeaders({
        trigger: params.trigger,
        headers: params.headers,
      }),
      body: JSON.stringify(params.payload),
    },
    'Failed to save estimate'
  )

  return {
    ...result,
    endpoint: params.endpoint,
    method,
  }
}
