'use client'

import {
  getApiErrorMessage,
  getApiPayloadData,
  parseApiResponse,
} from '../client/apiCore.ts'

type EstimateV2Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

type EstimateV2ClientResult<TPayload> =
  | {
      ok: true
      payload: TPayload
    }
  | {
      ok: false
      message: string
    }

export type EstimateV2RatesFlagsLoadResult = EstimateV2ClientResult<unknown>

export const quoteRatesFlagsEndpoint = '/api/quotes/rates-flags'

const rollerOptionsLoadFailureMessage = 'Roller and applicator options failed to load.'
const rollerOptionsMalformedMessage = 'Roller and applicator options response was malformed.'

async function getDefaultEstimateV2Fetch(): Promise<EstimateV2Fetch> {
  const authModule = await import('../auth/authedFetch.ts')
  return authModule.authedFetch
}

async function loadEstimateV2DataEnvelope<TPayload>(params: {
  endpoint: string
  fetchImpl?: EstimateV2Fetch
  failureMessage: string
  malformedMessage: string
}): Promise<EstimateV2ClientResult<TPayload>> {
  try {
    const fetcher = params.fetchImpl ?? (await getDefaultEstimateV2Fetch())
    const response = await fetcher(params.endpoint, { cache: 'no-store' })
    const parsed = await parseApiResponse(response)

    if (!response.ok) {
      return {
        ok: false,
        message: getApiErrorMessage(response, parsed, params.failureMessage),
      }
    }

    const payload = getApiPayloadData<TPayload>(parsed.json)
    if (!payload) {
      return {
        ok: false,
        message: params.malformedMessage,
      }
    }

    return {
      ok: true,
      payload,
    }
  } catch {
    return {
      ok: false,
      message: params.failureMessage,
    }
  }
}

export async function loadEstimateV2RatesFlagsPayload(
  fetchImpl?: EstimateV2Fetch
): Promise<EstimateV2RatesFlagsLoadResult> {
  return loadEstimateV2DataEnvelope<unknown>({
    endpoint: quoteRatesFlagsEndpoint,
    fetchImpl,
    failureMessage: rollerOptionsLoadFailureMessage,
    malformedMessage: rollerOptionsMalformedMessage,
  })
}
