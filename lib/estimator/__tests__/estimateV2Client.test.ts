import assert from 'node:assert/strict'
import test from 'node:test'
import { requestRawApiWith } from '../../client/apiCore.ts'
import {
  loadEstimateV2RatesFlagsPayload,
  saveEstimateV2Inputs,
  type EstimateV2SaveRequester,
} from '../../estimates/v2/client.ts'
import type { EstimateV2SavePayload } from '@/types/estimator/v2Summary'

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

function createNativeResponse(
  body: string,
  init?: { status?: number; statusText?: string }
) {
  return new Response(body, {
    status: init?.status ?? 200,
    statusText: init?.statusText ?? 'OK',
  })
}

function createMinimalSavePayload(): EstimateV2SavePayload {
  return {
    jobsettings: {
      labor_day_policy_enabled: true,
      dayhours: 8,
      rounding_increment_hours: 1,
      override_labor_rate: 75,
      job_minimum_enabled: false,
      job_minimum_amount: 0,
      crew_size: 1,
      walls_paint_id: null,
      walls_primer_id: null,
      ceiling_paint_id: null,
      ceiling_primer_id: null,
      trim_paint_id: null,
      trim_primer_id: null,
      standard_door_deduction_sf: 21,
      standard_window_deduction_sf: 15,
      baseboard_opening_deduction_lf: 3,
      condition_selections: null,
    },
    rooms: [],
    room_wall_scopes: [],
    wall_segments: [],
    room_flags: [],
    rollers: [],
    access_fees: [],
    room_ceiling_scopes: [],
    ceiling_scope_segments: [],
    room_trim_scopes: [],
  }
}

function createSaveRequester(
  fetcher: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
): EstimateV2SaveRequester {
  return (input, init, fallbackErrorMessage) =>
    requestRawApiWith(fetcher, input, init, fallbackErrorMessage)
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

test('saveEstimateV2Inputs sends the save payload through the shared raw API client', async () => {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = []
  const payload = createMinimalSavePayload()
  const request = createSaveRequester(async (input, init) => {
    calls.push({ input, init })
    return createNativeResponse(JSON.stringify({ data: { saved: true } }))
  })

  const result = await saveEstimateV2Inputs(
    {
      endpoint: '/api/estimates/estimate-1',
      payload,
      trigger: 'manual',
    },
    request
  )

  assert.equal(result.endpoint, '/api/estimates/estimate-1')
  assert.equal(result.method, 'PUT')
  assert.deepEqual(result.payload, { saved: true })
  assert.equal(result.errorMessage, null)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].input, '/api/estimates/estimate-1')
  assert.equal(calls[0].init?.method, 'PUT')
  assert.equal(calls[0].init?.body, JSON.stringify(payload))
  assert.equal(new Headers(calls[0].init?.headers).get('Content-Type'), 'application/json')
})

test('saveEstimateV2Inputs preserves parsed API error envelopes for diagnostics', async () => {
  const request = createSaveRequester(async () =>
    createNativeResponse(
      JSON.stringify({
        error: {
          code: 'INVALID_ESTIMATE_DRAFT',
          message: 'Validation failed.',
        },
      }),
      { status: 422, statusText: 'Unprocessable Entity' }
    )
  )

  const result = await saveEstimateV2Inputs(
    {
      endpoint: '/api/estimates/estimate-1',
      payload: createMinimalSavePayload(),
    },
    request
  )

  assert.equal(result.response.ok, false)
  assert.equal(result.response.status, 422)
  assert.deepEqual(result.parsed.json, {
    error: {
      code: 'INVALID_ESTIMATE_DRAFT',
      message: 'Validation failed.',
    },
  })
  assert.equal(result.errorMessage, 'Validation failed.')
})

test('saveEstimateV2Inputs falls back to response text when an error response is not JSON', async () => {
  const request = createSaveRequester(async () =>
    createNativeResponse('upstream unavailable', {
      status: 503,
      statusText: 'Service Unavailable',
    })
  )

  const result = await saveEstimateV2Inputs(
    {
      endpoint: '/api/estimates/estimate-1',
      payload: createMinimalSavePayload(),
    },
    request
  )

  assert.equal(result.response.status, 503)
  assert.equal(result.parsed.json, null)
  assert.equal(result.parsed.text, 'upstream unavailable')
  assert.equal(result.errorMessage, 'upstream unavailable')
})

test('saveEstimateV2Inputs keeps custom headers and adds the autosave header', async () => {
  const calls: Array<{ init?: RequestInit }> = []
  const request = createSaveRequester(async (_input, init) => {
    calls.push({ init })
    return createNativeResponse(JSON.stringify({ data: { autosave: true } }))
  })

  await saveEstimateV2Inputs(
    {
      endpoint: '/api/estimates/estimate-1',
      payload: createMinimalSavePayload(),
      trigger: 'auto',
      headers: {
        'X-Debug-Trace': 'trace-1',
      },
    },
    request
  )

  const headers = new Headers(calls[0].init?.headers)
  assert.equal(headers.get('X-Estimate-Save-Mode'), 'auto')
  assert.equal(headers.get('X-Debug-Trace'), 'trace-1')
  assert.equal(headers.get('Content-Type'), 'application/json')
})
