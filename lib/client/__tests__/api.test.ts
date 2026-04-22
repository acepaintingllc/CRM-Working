import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getApiErrorMessage,
  parseApiResponse,
  requestApiWith,
} from '../apiCore.ts'

test('client api helpers parse JSON and empty response bodies safely', async () => {
  const jsonResponse = new Response(JSON.stringify({ data: { ok: true } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
  const emptyResponse = new Response('')

  assert.deepEqual(await parseApiResponse(jsonResponse), {
    json: { data: { ok: true } },
    text: JSON.stringify({ data: { ok: true } }),
  })
  assert.deepEqual(await parseApiResponse(emptyResponse), {
    json: null,
    text: '',
  })
})

test('client api helpers extract stable API error messages', () => {
  const response = new Response(JSON.stringify({ error: 'Boom.' }), { status: 400 })
  assert.equal(
    getApiErrorMessage(response, {
      json: { error: 'Boom.' },
      text: JSON.stringify({ error: 'Boom.' }),
    }),
    'Boom.'
  )
})

test('client api helpers throw normalized request errors for failed responses', async () => {
  const fetcher = async () =>
    new Response(JSON.stringify({ error: 'Bad request.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })

  await assert.rejects(() => requestApiWith(fetcher, '/api/test'), /Bad request\./)
})

test('client api helpers return parsed JSON for successful requests', async () => {
  const fetcher = async () =>
    new Response(JSON.stringify({ data: { value: 3 } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  const payload = await requestApiWith<{ data: { value: number } }>(fetcher, '/api/test')
  assert.deepEqual(payload, {
    data: { value: 3 },
  })
})
