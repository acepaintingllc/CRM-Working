import assert from 'node:assert/strict'
import test from 'node:test'

import {
  fetchCalendars,
  fetchCalendarStatus,
  fetchEvents,
  readCalendarEventsPayload,
  readCalendarInfosPayload,
  resolveInitialSelectedCalendarIds,
} from '../calendar/api.ts'

function createResponse(ok: boolean, payload: unknown, statusText = ok ? 'OK' : 'Server Error') {
  return {
    ok,
    statusText,
    json: async () => payload,
  } as Response
}

test('readCalendarInfosPayload parses valid calendar payloads', () => {
  const result = readCalendarInfosPayload({
    calendars: [
      {
        id: 'primary',
        summary: 'Primary',
        primary: true,
        backgroundColor: '#ffffff',
        foregroundColor: '#111111',
      },
    ],
  })

  assert.equal(result.valid, true)
  assert.equal(result.value[0]?.id, 'primary')
})

test('readCalendarEventsPayload rejects malformed event payloads', () => {
  const result = readCalendarEventsPayload({
    events: [{ id: 'event-1', summary: 'Missing calendar id' }],
  })

  assert.equal(result.valid, false)
  assert.deepEqual(result.value, [])
})

test('resolveInitialSelectedCalendarIds prefers valid stored ids, then Austin and primary', () => {
  const calendars = [
    {
      id: 'primary',
      summary: 'Primary',
      primary: true,
      backgroundColor: null,
      foregroundColor: null,
    },
    {
      id: 'austin',
      summary: "Austin's Work",
      primary: false,
      backgroundColor: null,
      foregroundColor: null,
    },
  ]

  assert.deepEqual(resolveInitialSelectedCalendarIds(calendars, ['missing', 'primary']), ['primary'])
  assert.deepEqual(resolveInitialSelectedCalendarIds(calendars, null), ['austin', 'primary'])
})

test('fetchCalendarStatus returns a safe error on invalid payloads', async () => {
  const result = await fetchCalendarStatus(async () => createResponse(true, { nope: true }))

  assert.equal(result.value, false)
  assert.equal(result.errorMessage, 'Invalid calendar status response.')
})

test('fetchCalendars and fetchEvents return safe errors on malformed payloads', async () => {
  const calendars = await fetchCalendars(async () => createResponse(true, { calendars: [{ nope: true }] }))
  const events = await fetchEvents(
    {
      selectedCalendarIds: ['primary'],
      visibleMonth: new Date('2026-04-01T00:00:00.000Z'),
    },
    async () => createResponse(true, { events: [{ id: 'event-1' }] })
  )

  assert.deepEqual(calendars.value, [])
  assert.equal(calendars.errorMessage, 'Invalid calendar list response.')
  assert.deepEqual(events.value, [])
  assert.equal(events.errorMessage, 'Invalid calendar events response.')
})
