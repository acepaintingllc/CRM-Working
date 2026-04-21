import assert from 'node:assert/strict'
import test from 'node:test'
import {
  eventOccursToday,
  eventSortValue,
  formatEventWindow,
  parseStoredCalendarIds,
} from '../home/calendar.ts'
import type { CalendarEvent } from '../home/types.ts'

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

test('parseStoredCalendarIds keeps only non-empty string ids', () => {
  assert.deepEqual(parseStoredCalendarIds('["primary","","team"]'), ['primary', 'team'])
  assert.equal(parseStoredCalendarIds('{"bad":true}'), null)
})

test('eventOccursToday supports date-only and date-time events', () => {
  const now = new Date('2026-04-21T12:00:00.000Z')

  assert.equal(
    eventOccursToday(makeEvent({ start: '2026-04-21', end: '2026-04-22' }), now),
    true
  )
  assert.equal(
    eventOccursToday(
      makeEvent({
        start: '2026-04-21T15:00:00.000Z',
        end: '2026-04-21T16:00:00.000Z',
      }),
      now
    ),
    true
  )
  assert.equal(
    eventOccursToday(
      makeEvent({
        start: '2026-04-22T09:00:00.000Z',
        end: '2026-04-22T10:00:00.000Z',
      }),
      now
    ),
    false
  )
})

test('eventSortValue sorts undated events last', () => {
  const early = makeEvent({ start: '2026-04-21T08:00:00.000Z' })
  const late = makeEvent({ start: '2026-04-21T12:00:00.000Z' })
  const unknown = makeEvent({ start: null })

  assert.ok(eventSortValue(early) < eventSortValue(late))
  assert.ok(eventSortValue(unknown) > eventSortValue(late))
})

test('formatEventWindow renders all-day and timed events', () => {
  assert.equal(formatEventWindow('2026-04-21', '2026-04-22'), '4/21/2026 (all day)')
  assert.match(
    formatEventWindow('2026-04-21T09:00:00.000Z', '2026-04-21T10:30:00.000Z'),
    /4\/21\/2026 \|/
  )
})
