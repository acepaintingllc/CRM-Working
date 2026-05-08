import assert from 'node:assert/strict'
import test from 'node:test'

import {
  normalizeScheduleDateTime,
  normalizeScheduleDateTimeBlock,
} from '../jobScheduleDateTime.ts'

test('job schedule datetime canonicalizes valid ISO, Z, and offset datetimes', () => {
  assert.equal(normalizeScheduleDateTime(' 2026-05-01T10:00:00Z '), '2026-05-01T10:00:00.000Z')
  assert.equal(
    normalizeScheduleDateTime('2026-05-01T10:00:00.125Z'),
    '2026-05-01T10:00:00.125Z'
  )
  assert.equal(
    normalizeScheduleDateTime('2026-05-01T10:00:00-05:00'),
    '2026-05-01T15:00:00.000Z'
  )
})

test('job schedule datetime rejects invalid or empty datetimes', () => {
  assert.equal(normalizeScheduleDateTime(null), null)
  assert.equal(normalizeScheduleDateTime(''), null)
  assert.equal(normalizeScheduleDateTime('   '), null)
  assert.equal(normalizeScheduleDateTime('not a date'), null)
  assert.equal(normalizeScheduleDateTime('2026-05-32T10:00:00Z'), null)
  assert.equal(normalizeScheduleDateTime('2026-05-01T24:00:00Z'), null)
  assert.equal(normalizeScheduleDateTime('2026-05-01'), null)
})

test('job schedule datetime normalizes valid blocks and rejects malformed or inverted blocks', () => {
  assert.deepEqual(
    normalizeScheduleDateTimeBlock({
      start_at: '2026-05-01T10:00:00-05:00',
      end_at: '2026-05-01T12:00:00-05:00',
    }),
    {
      startAt: '2026-05-01T15:00:00.000Z',
      endAt: '2026-05-01T17:00:00.000Z',
    }
  )

  assert.equal(
    normalizeScheduleDateTimeBlock({
      start_at: 'bad',
      end_at: '2026-05-01T12:00:00Z',
    }),
    null
  )

  assert.equal(
    normalizeScheduleDateTimeBlock({
      start_at: '2026-05-01T12:00:00Z',
      end_at: '2026-05-01T10:00:00Z',
    }),
    null
  )
})
