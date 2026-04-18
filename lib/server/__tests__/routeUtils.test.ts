import assert from 'node:assert/strict'
import test from 'node:test'
import { isUuid, parseUuidParam } from '../routeUtils.ts'

test('isUuid validates canonical UUIDs', () => {
  assert.equal(isUuid('d4e9f6ea-4ac6-4e8f-8e62-a4bc90f2d67d'), true)
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
