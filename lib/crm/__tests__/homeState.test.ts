import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildCrmHomeErrors,
  createInitialCrmHomeLoadState,
  createLoadingCrmHomeLoadState,
  createResolvedCrmHomeLoadState,
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

  assert.equal(valid.error, null)
  assert.equal(valid.value.length, 1)
  assert.equal(valid.value[0]?.id, 'job-1')

  const malformed = readJobsPayload({ bad: true })
  assert.deepEqual(malformed.value, [])
  assert.equal(malformed.error, 'Malformed jobs response.')
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

  assert.equal(result.error, null)
  assert.equal(result.value.length, 1)
  assert.equal(result.value[0]?.id, 'customer-1')
})

test('calendar payload readers fall back safely on malformed data', () => {
  const status = readCalendarStatusPayload({ connected: true })
  assert.equal(status.value, true)
  assert.equal(status.error, null)

  const badStatus = readCalendarStatusPayload({ connected: 'yes' })
  assert.equal(badStatus.value, false)
  assert.equal(badStatus.error, 'Malformed calendar status response.')

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

  assert.equal(events.error, null)
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

  assert.equal(valid.error, null)
  assert.equal(valid.value?.tasks.overdue.length, 1)

  const missingBuckets = readNotesDashboardPayload({
    tasks: {},
  })
  assert.equal(missingBuckets.error, null)
  assert.deepEqual(missingBuckets.value?.tasks.overdue, [])
  assert.deepEqual(missingBuckets.value?.tasks.due_today, [])

  const malformed = readNotesDashboardPayload({ nope: true })
  assert.equal(malformed.value, null)
  assert.equal(malformed.error, 'Malformed notes dashboard response.')
})

test('load state helpers distinguish initial load, reload, critical errors, and warnings', () => {
  const initial = createInitialCrmHomeLoadState(new Date('2026-04-21T12:00:00.000Z'))
  assert.equal(initial.isInitialLoading, true)
  assert.equal(initial.isReloading, false)
  assert.equal(initial.hasCriticalError, false)
  assert.equal(initial.hasWarnings, false)

  const reloading = createLoadingCrmHomeLoadState(initial.data, true)
  assert.equal(reloading.isInitialLoading, false)
  assert.equal(reloading.isReloading, true)
  assert.deepEqual(reloading.errorsBySource, {})

  const jobErrors = buildCrmHomeErrors([
    ['jobs', 'Unable to load jobs.'],
    ['notes', null],
  ])
  const critical = createResolvedCrmHomeLoadState({
    jobs: [],
    customers: [],
    calendarConnected: false,
    calendarTodayEvents: [],
    notesReminders: [],
    errorsBySource: jobErrors,
    now: new Date('2026-04-21T12:00:00.000Z'),
  })
  assert.equal(critical.hasCriticalError, true)
  assert.equal(critical.hasWarnings, false)
  assert.equal(critical.errorsBySource.jobs, 'Unable to load jobs.')

  const warningErrors = buildCrmHomeErrors([
    ['customers', 'Unable to load customers.'],
    ['notes', 'Unable to load notes dashboard.'],
    ['jobs', null],
  ])
  const warnings = createResolvedCrmHomeLoadState({
    jobs: [],
    customers: [],
    calendarConnected: true,
    calendarTodayEvents: [],
    notesReminders: [],
    errorsBySource: warningErrors,
    now: new Date('2026-04-21T12:00:00.000Z'),
  })
  assert.equal(warnings.hasCriticalError, false)
  assert.equal(warnings.hasWarnings, true)
  assert.deepEqual(getCrmHomeWarningSources(warnings.errorsBySource), ['customers', 'notes'])
})
