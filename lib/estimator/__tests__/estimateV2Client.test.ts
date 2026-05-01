import assert from 'node:assert/strict'
import test from 'node:test'
import { loadEstimateV2RatesFlagsPayload } from '../../estimates/v2/client.ts'

function createResponse(
  payload: unknown,
  init?: { ok?: boolean; status?: number; statusText?: string }
) {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: init?.statusText ?? 'OK',
    text: async () => JSON.stringify(payload),
  } as Response
}

test('loadEstimateV2RatesFlagsPayload loads the canonical quote rates-flags endpoint and unwraps the data envelope', async () => {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = []
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init })
    return createResponse({
      data: {
        categories: [{ key: 'supply_rates_roller_covers', rows: [] }],
      },
    })
  }

  assert.deepEqual(await loadEstimateV2RatesFlagsPayload(fetchImpl), {
    ok: true,
    payload: {
      categories: [{ key: 'supply_rates_roller_covers', rows: [] }],
    },
  })
  assert.deepEqual(calls, [
    {
      input: '/api/quotes/rates-flags',
      init: { cache: 'no-store' },
    },
  ])
})

test('loadEstimateV2RatesFlagsPayload returns the API envelope error message for failed responses', async () => {
  const fetchImpl = async () =>
    createResponse(
      { error: 'Rates unavailable' },
      { ok: false, status: 503, statusText: 'Service Unavailable' }
    )

  assert.deepEqual(await loadEstimateV2RatesFlagsPayload(fetchImpl), {
    ok: false,
    message: 'Rates unavailable',
  })
})

test('loadEstimateV2RatesFlagsPayload returns the malformed response message when the data envelope is missing', async () => {
  const fetchImpl = async () => createResponse({ categories: [] })

  assert.deepEqual(await loadEstimateV2RatesFlagsPayload(fetchImpl), {
    ok: false,
    message: 'Roller and applicator options response was malformed.',
  })
})

test('loadEstimateV2RatesFlagsPayload returns the load failure message when fetch throws', async () => {
  const fetchImpl = async (): Promise<Response> => {
    throw new Error('network down')
  }

  assert.deepEqual(await loadEstimateV2RatesFlagsPayload(fetchImpl), {
    ok: false,
    message: 'Roller and applicator options failed to load.',
  })
})
