import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildMonthWeekRows,
  eventTouchesDay,
  resolveSelectedDayKeyForMonth,
} from '../calendar/helpers.ts'
import type { CalendarEvent } from '../calendar/types.ts'

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'event-1',
    calendarId: 'primary',
    summary: 'Event',
    start: '2026-04-21T10:00:00.000Z',
    end: '2026-04-21T11:00:00.000Z',
    htmlLink: null,
    ...overrides,
  }
}

test('resolveSelectedDayKeyForMonth keeps same-month dates and resets out-of-month dates', () => {
  const month = new Date(2026, 4, 1)

  assert.equal(resolveSelectedDayKeyForMonth('2026-05-18', month), '2026-05-18')
  assert.equal(resolveSelectedDayKeyForMonth('2026-04-18', month), '2026-05-01')
  assert.equal(resolveSelectedDayKeyForMonth('bad-key', month), '2026-05-01')
})

test('eventTouchesDay handles all-day and multi-day timed events', () => {
  const day = new Date(2026, 3, 21, 12, 0, 0)

  assert.equal(eventTouchesDay(makeEvent({ start: '2026-04-21', end: '2026-04-22' }), day), true)
  assert.equal(
    eventTouchesDay(
      makeEvent({
        start: '2026-04-20T23:00:00',
        end: '2026-04-21T02:00:00',
      }),
      day
    ),
    true
  )
})

test('buildMonthWeekRows produces stable row counts for overlapping segments', () => {
  const monthWeeks = [
    [
      new Date(2026, 3, 19),
      new Date(2026, 3, 20),
      new Date(2026, 3, 21),
      new Date(2026, 3, 22),
      new Date(2026, 3, 23),
      new Date(2026, 3, 24),
      new Date(2026, 3, 25),
    ],
  ]

  const rows = buildMonthWeekRows(monthWeeks, [
    makeEvent({ id: 'a', start: '2026-04-21', end: '2026-04-23' }),
    makeEvent({ id: 'b', start: '2026-04-21', end: '2026-04-22' }),
  ])

  assert.equal(rows[0]?.segments.length, 2)
  assert.equal(rows[0]?.rowCount, 2)
  assert.ok((rows[0]?.weekMinHeight ?? 0) >= 132)
})
