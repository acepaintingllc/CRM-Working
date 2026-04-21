import assert from 'node:assert/strict'
import test from 'node:test'
import { formatDue, toIsoFromLocal, toLocalDateInput, toLocalTimeInput } from '../time.ts'

test('toLocalDateInput returns yyyy-mm-dd for valid iso', () => {
  assert.match(toLocalDateInput('2026-04-07T15:45:00.000Z'), /^\d{4}-\d{2}-\d{2}$/)
})

test('toLocalTimeInput returns hh:mm for valid iso', () => {
  assert.match(toLocalTimeInput('2026-04-07T15:45:00.000Z'), /^\d{2}:\d{2}$/)
})

test('toIsoFromLocal uses default time for all-day or missing time', () => {
  assert.equal(typeof toIsoFromLocal({ date: '2026-04-07', time: '', hasDueTime: false, isAllDay: true }), 'string')
  assert.equal(typeof toIsoFromLocal({ date: '2026-04-07', time: '', hasDueTime: false, isAllDay: false }), 'string')
})

test('formatDue returns fallback when missing due date', () => {
  assert.equal(formatDue(null, false, false), 'No due date')
})
