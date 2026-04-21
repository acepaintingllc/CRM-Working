import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyCrmHomeSourcePatch,
  buildCrmHomeErrors,
  createInitialCrmHomeLoadState,
  createLoadingCrmHomeLoadState,
  createResolvedCrmHomeLoadState,
  createSkippedCrmHomeSourceResult,
  createCrmHomeSourceState,
  deriveCrmHomeSummary,
  getCrmHomeWarningSources,
  readCalendarEventsPayload,
  readCalendarStatusPayload,
  readCustomersPayload,
  readJobsPayload,
  readNotesDashboardPayload,
} from '../home/state.ts'

test('readJobsPayload returns rows for valid payloads and rejects malformed payloads', () => {
  const valid = readJobsPayload({
    jobs: [
      {
        id: 'job-1',
        status: 'completed',
        title: 'Kitchen repaint',
        customer_name: 'Alice Jones',
        customer_address: '123 Main St',
        estimate_total_amount: '1200',
      },
      {
        id: '',
        status: 'lost',
      },
    ],
  })

  assert.equal(valid.errorMessage, null)
  assert.equal(valid.availability, 'available')
  assert.equal(valid.value.length, 1)
  assert.equal(valid.value[0]?.id, 'job-1')

  const malformed = readJobsPayload({ bad: true })
  assert.deepEqual(malformed.value, [])
  assert.equal(malformed.availability, 'invalid')
  assert.equal(malformed.errorMessage, 'Malformed jobs response.')
})

test('readCustomersPayload preserves valid customers and drops malformed rows', () => {
  const result = readCustomersPayload({
    customers: [
      {
        id: 'customer-1',
        name: 'Alice Jones',
        email: 'alice@example.com',
        phone: '555-1111',
        address: '123 Main St',
      },
      {
        id: null,
        name: 'Broken',
      },
    ],
  })

  assert.equal(result.errorMessage, null)
  assert.equal(result.availability, 'available')
  assert.equal(result.value.length, 1)
  assert.equal(result.value[0]?.id, 'customer-1')
})

test('calendar payload readers distinguish missing and malformed status payloads', () => {
  const status = readCalendarStatusPayload({ connected: true })
  assert.equal(status.value, true)
  assert.equal(status.availability, 'available')
  assert.equal(status.errorMessage, null)

  const missingStatus = readCalendarStatusPayload({})
  assert.equal(missingStatus.value, false)
  assert.equal(missingStatus.availability, 'missing')
  assert.equal(missingStatus.errorMessage, 'Missing calendar status response.')

  const badStatus = readCalendarStatusPayload({ connected: 'yes' })
  assert.equal(badStatus.value, false)
  assert.equal(badStatus.availability, 'invalid')
  assert.equal(badStatus.errorMessage, 'Malformed calendar status response.')

  const events = readCalendarEventsPayload({
    events: [
      {
        id: 'event-1',
        calendarId: 'primary',
        summary: 'Estimate review',
        start: '2026-04-21T10:00:00.000Z',
        end: '2026-04-21T11:00:00.000Z',
        htmlLink: 'https://example.com',
      },
      {
        id: 'event-2',
        calendarId: null,
      },
    ],
  })

  assert.equal(events.errorMessage, null)
  assert.equal(events.availability, 'available')
  assert.equal(events.value.length, 1)
  assert.equal(events.value[0]?.id, 'event-1')
})

test('readNotesDashboardPayload returns safe defaults and reports malformed payloads', () => {
  const valid = readNotesDashboardPayload({
    tasks: {
      overdue: [
        {
          id: 'task-1',
          title: 'Past due',
          description: null,
          due_at: '2026-04-20T10:00:00.000Z',
          is_all_day: false,
          has_due_time: true,
        },
      ],
      due_today: [],
    },
  })

  assert.equal(valid.errorMessage, null)
  assert.equal(valid.availability, 'available')
  assert.equal(valid.value?.tasks.overdue.length, 1)

  const missingBuckets = readNotesDashboardPayload({
    tasks: {},
  })
  assert.equal(missingBuckets.errorMessage, null)
  assert.equal(missingBuckets.availability, 'available')
  assert.deepEqual(missingBuckets.value?.tasks.overdue, [])
  assert.deepEqual(missingBuckets.value?.tasks.due_today, [])

  const malformed = readNotesDashboardPayload({ nope: true })
  assert.equal(malformed.value, null)
  assert.equal(malformed.availability, 'invalid')
  assert.equal(malformed.errorMessage, 'Malformed notes dashboard response.')
})

test('load state helpers derive summary and warning sources from source states', () => {
  const initial = createInitialCrmHomeLoadState(new Date('2026-04-21T12:00:00.000Z'))
  assert.equal(initial.summary.isInitialLoading, true)
  assert.equal(initial.summary.isReloading, false)
  assert.equal(initial.summary.hasCriticalError, false)
  assert.equal(initial.summary.hasWarnings, false)

  const reloading = createLoadingCrmHomeLoadState(initial, ['jobs', 'notes'])
  assert.equal(reloading.summary.isInitialLoading, true)
  assert.equal(reloading.sources.jobs.status, 'loading')
  assert.equal(reloading.sources.notes.status, 'loading')

  const resolved = createResolvedCrmHomeLoadState({
    jobs: [],
    customers: [],
    calendarConnected: false,
    calendarTodayEvents: [],
    notesReminders: [],
    now: new Date('2026-04-21T12:00:00.000Z'),
    sources: {
      jobs: createCrmHomeSourceState('error', 'unavailable', 'Unable to load jobs.', '2026-04-21T12:00:00.000Z'),
      customers: createCrmHomeSourceState('ready', 'available', null, '2026-04-21T12:00:00.000Z'),
      calendarStatus: createCrmHomeSourceState('ready', 'available', null, '2026-04-21T12:00:00.000Z'),
      calendarEvents: createCrmHomeSourceState('ready', 'missing', null, '2026-04-21T12:00:00.000Z'),
      notes: createCrmHomeSourceState('degraded', 'invalid', 'Malformed notes dashboard response.', '2026-04-21T12:00:00.000Z'),
    },
  })

  assert.equal(resolved.summary.hasCriticalError, true)
  assert.equal(resolved.summary.hasWarnings, false)
  assert.deepEqual(buildCrmHomeErrors(resolved.sources), {
    jobs: 'Unable to load jobs.',
    notes: 'Malformed notes dashboard response.',
  })
  assert.deepEqual(getCrmHomeWarningSources(resolved.sources), ['notes'])
})

test('applyCrmHomeSourcePatch merges source updates and explicit skipped calendar events state', () => {
  const initial = createInitialCrmHomeLoadState(new Date('2026-04-21T12:00:00.000Z'))

  const patched = applyCrmHomeSourcePatch(
    initial,
    {
      jobs: {
        source: {
          source: 'jobs',
          ok: true,
          status: 'ready',
          availability: 'available',
          value: [
            {
              id: 'job-1',
              status: 'completed',
              title: 'Kitchen repaint',
              customer_name: 'Alice Jones',
              customer_address: '123 Main St',
              estimate_total_amount: 1200,
            },
          ],
          errorMessage: null,
          rawPayload: null,
          lastLoadedAt: '2026-04-21T12:00:00.000Z',
        },
        data: [
          {
            id: 'job-1',
            status: 'completed',
            title: 'Kitchen repaint',
            customer_name: 'Alice Jones',
            customer_address: '123 Main St',
            estimate_total_amount: 1200,
          },
        ],
      },
      calendarEvents: {
        source: createSkippedCrmHomeSourceResult(
          'calendarEvents',
          'missing',
          '2026-04-21T12:00:00.000Z',
          []
        ),
        data: [],
      },
    },
    new Date('2026-04-21T12:00:00.000Z')
  )

  assert.equal(patched.data.metrics.salesTotal, 1200)
  assert.equal(patched.sources.calendarEvents.availability, 'missing')
  assert.equal(patched.summary.isInitialLoading, false)
  assert.equal(patched.summary.isReloading, true)
})

test('deriveCrmHomeSummary treats non-critical degraded sources as warnings only', () => {
  const summary = deriveCrmHomeSummary({
    jobs: createCrmHomeSourceState('ready', 'available', null, '2026-04-21T12:00:00.000Z'),
    customers: createCrmHomeSourceState('degraded', 'invalid', 'Malformed customers response.', '2026-04-21T12:00:00.000Z'),
    calendarStatus: createCrmHomeSourceState('ready', 'available', null, '2026-04-21T12:00:00.000Z'),
    calendarEvents: createCrmHomeSourceState('ready', 'missing', null, '2026-04-21T12:00:00.000Z'),
    notes: createCrmHomeSourceState('ready', 'available', null, '2026-04-21T12:00:00.000Z'),
  })

  assert.equal(summary.hasCriticalError, false)
  assert.equal(summary.hasWarnings, true)
  assert.deepEqual(summary.warningSources, ['customers'])
})
