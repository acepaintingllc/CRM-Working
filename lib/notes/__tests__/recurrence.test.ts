import assert from 'node:assert/strict'
import test from 'node:test'
import { computeNextDueAtIso, getNextRecurrenceDate } from '../recurrence.ts'

test('daily recurrence advances one day by default', () => {
  const base = new Date('2026-04-07T15:00:00.000Z')
  const next = getNextRecurrenceDate(base, { frequency: 'daily' })
  assert.equal(next.toISOString(), '2026-04-08T15:00:00.000Z')
})

test('weekdays skips weekend', () => {
  const friday = new Date('2026-04-10T09:00:00.000Z')
  const next = getNextRecurrenceDate(friday, { frequency: 'weekdays' })
  assert.equal(next.toISOString(), '2026-04-13T09:00:00.000Z')
})

test('monthly recurrence keeps day when possible', () => {
  const jan31 = new Date('2026-01-31T12:00:00.000Z')
  const next = getNextRecurrenceDate(jan31, { frequency: 'monthly' })
  assert.equal(next.toISOString(), '2026-02-28T12:00:00.000Z')
})

test('computeNextDueAtIso uses completedAt when due is missing', () => {
  const iso = computeNextDueAtIso({
    currentDueAtIso: null,
    completedAt: new Date('2026-04-07T00:00:00.000Z'),
    recurrenceRule: { frequency: 'weekly' },
  })
  assert.equal(iso, '2026-04-14T00:00:00.000Z')
})
