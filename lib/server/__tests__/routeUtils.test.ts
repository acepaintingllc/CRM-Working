import assert from 'node:assert/strict'
import test from 'node:test'
import { isUuid, parseUuidParam, getClientIp } from '../routeUtils.ts'

test('isUuid validates canonical UUIDs', () => {
  assert.equal(isUuid('d4e9f6ea-4ac6-4e8f-8e62-a4bc90f2d67d'), true)
  assert.equal(isUuid('22222222-2222-2222-2222-222222222222'), true)
  assert.equal(isUuid('not-a-uuid'), false)
  assert.equal(isUuid(''), false)
})

test('parseUuidParam returns parsed value for valid UUID', () => {
  const parsed = parseUuidParam('d4e9f6ea-4ac6-4e8f-8e62-a4bc90f2d67d')
  assert.equal(parsed.ok, true)
  if (parsed.ok) {
    assert.equal(parsed.value, 'd4e9f6ea-4ac6-4e8f-8e62-a4bc90f2d67d')
  }
})

test('parseUuidParam rejects invalid UUID input', () => {
  const parsed = parseUuidParam('abc123')
  assert.equal(parsed.ok, false)
})

function makeRequest(forwardedFor: string | null): Request {
  const headers = new Headers()
  if (forwardedFor !== null) headers.set('x-forwarded-for', forwardedFor)
  return new Request('https://example.com', { headers })
}

test('getClientIp returns single IP directly', () => {
  assert.equal(getClientIp(makeRequest('203.0.113.1')), '203.0.113.1')
})

test('getClientIp returns first IP from multi-hop proxy list', () => {
  assert.equal(getClientIp(makeRequest('203.0.113.1, 10.0.0.1, 172.16.0.5')), '203.0.113.1')
})

test('getClientIp returns empty string when header is absent', () => {
  assert.equal(getClientIp(makeRequest(null)), '')
})
