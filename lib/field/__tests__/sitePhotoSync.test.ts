import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildNextRetryAtIso,
  computeUploadRetryDelayMs,
  isRetryDue,
  shouldRetryUploadStatus,
} from '../sitePhotoSync.ts'

test('computeUploadRetryDelayMs increases with retry count and is capped', () => {
  const first = computeUploadRetryDelayMs(0)
  const second = computeUploadRetryDelayMs(1)
  const tenth = computeUploadRetryDelayMs(10)

  assert.equal(first, 750)
  assert.equal(second, 1500)
  assert.equal(tenth, 30000)
})

test('buildNextRetryAtIso schedules in the future', () => {
  const now = '2026-04-07T12:00:00.000Z'
  const next = buildNextRetryAtIso(now, 2)
  assert.ok(Date.parse(next) > Date.parse(now))
})

test('isRetryDue respects due timestamp', () => {
  const now = '2026-04-07T12:00:00.000Z'
  assert.equal(isRetryDue('2026-04-07T11:59:00.000Z', now), true)
  assert.equal(isRetryDue('2026-04-07T12:01:00.000Z', now), false)
  assert.equal(isRetryDue(null, now), true)
})

test('shouldRetryUploadStatus matches transient statuses', () => {
  assert.equal(shouldRetryUploadStatus(408), true)
  assert.equal(shouldRetryUploadStatus(429), true)
  assert.equal(shouldRetryUploadStatus(503), true)
  assert.equal(shouldRetryUploadStatus(400), false)
  assert.equal(shouldRetryUploadStatus(404), false)
})
