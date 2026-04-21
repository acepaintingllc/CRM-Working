import assert from 'node:assert/strict'
import test from 'node:test'
import { loadCrmHomeData } from '../home/loader.ts'
import { createLoadingCrmHomeLoadState } from '../home/state.ts'
import type { CrmHomeFetchResponse, CrmHomeSourceErrorKey } from '../home/types.ts'

type FetchMap = Partial<Record<CrmHomeSourceErrorKey, Omit<CrmHomeFetchResponse, 'source'>>>

function createFetchJsonStub(
  fetchMap: FetchMap,
  calls: Array<{ source: CrmHomeSourceErrorKey; url: string }>
) {
  return async (source: CrmHomeSourceErrorKey, url: string): Promise<CrmHomeFetchResponse> => {
    calls.push({ source, url })
    const response = fetchMap[source]
    if (!response) {
      throw new Error(`Missing stub for ${source}`)
    }
    return {
      source,
      ...response,
    }
  }
}

test('loadCrmHomeData resolves successful source data into a ready home state', async () => {
  const calls: Array<{ source: CrmHomeSourceErrorKey; url: string }> = []
  const logCalls: Array<{ source: CrmHomeSourceErrorKey; message: string }> = []

  const state = await loadCrmHomeData({
    now: new Date('2026-04-21T12:00:00.000Z'),
    fetchJson: createFetchJsonStub(
      {
        jobs: {
          ok: true,
          payload: {
            jobs: [
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
          errorMessage: null,
        },
        customers: {
          ok: true,
          payload: {
            customers: [
              {
                id: 'customer-1',
                name: 'Alice Jones',
                email: 'alice@example.com',
                phone: '555-1111',
                address: '123 Main St',
              },
            ],
          },
          errorMessage: null,
        },
        calendarStatus: {
          ok: true,
          payload: { connected: true },
          errorMessage: null,
        },
        calendarEvents: {
          ok: true,
          payload: {
            events: [
              {
                id: 'event-1',
                calendarId: 'primary',
                summary: 'Estimate review',
                start: '2026-04-21T15:00:00.000Z',
                end: '2026-04-21T16:00:00.000Z',
                htmlLink: 'https://example.com/event-1',
              },
            ],
          },
          errorMessage: null,
        },
        notes: {
          ok: true,
          payload: {
            tasks: {
              overdue: [],
              due_today: [
                {
                  id: 'task-1',
                  title: 'Call customer',
                  description: null,
                  due_at: '2026-04-21T18:00:00.000Z',
                  is_all_day: false,
                  has_due_time: true,
                },
              ],
            },
          },
          errorMessage: null,
        },
      },
      calls
    ),
    readSelectedCalendarIds: () => ['primary'],
    logError: (source, message) => {
      logCalls.push({ source, message })
    },
  })

  assert.equal(state.hasCriticalError, false)
  assert.equal(state.hasWarnings, false)
  assert.equal(state.data.metrics.salesTotal, 1200)
  assert.equal(state.data.signals.calendarConnected, true)
  assert.equal(state.data.signals.calendarTodayEvents.length, 1)
  assert.equal(state.data.signals.notesReminders.length, 1)
  assert.equal(calls.some((call) => call.source === 'calendarEvents'), true)
  assert.deepEqual(logCalls, [])
})

test('loadCrmHomeData treats jobs failure as a critical dashboard error', async () => {
  const state = await loadCrmHomeData({
    now: new Date('2026-04-21T12:00:00.000Z'),
    fetchJson: createFetchJsonStub(
      {
        jobs: {
          ok: false,
          payload: { error: 'Jobs failed' },
          errorMessage: 'Jobs failed',
        },
        customers: {
          ok: true,
          payload: { customers: [] },
          errorMessage: null,
        },
        calendarStatus: {
          ok: true,
          payload: { connected: false },
          errorMessage: null,
        },
        notes: {
          ok: true,
          payload: { tasks: { overdue: [], due_today: [] } },
          errorMessage: null,
        },
      },
      []
    ),
    readSelectedCalendarIds: () => null,
    logError: () => undefined,
  })

  assert.equal(state.hasCriticalError, true)
  assert.equal(state.hasWarnings, false)
  assert.equal(state.errorsBySource.jobs, 'Jobs failed')
})

test('loadCrmHomeData treats customers and notes failures as warnings only', async () => {
  const state = await loadCrmHomeData({
    now: new Date('2026-04-21T12:00:00.000Z'),
    fetchJson: createFetchJsonStub(
      {
        jobs: {
          ok: true,
          payload: {
            jobs: [
              {
                id: 'job-1',
                status: 'estimate_sent',
                title: 'Kitchen repaint',
                customer_name: 'Alice Jones',
                customer_address: '123 Main St',
                estimate_total_amount: 1200,
              },
            ],
          },
          errorMessage: null,
        },
        customers: {
          ok: false,
          payload: { error: 'Customers failed' },
          errorMessage: 'Customers failed',
        },
        calendarStatus: {
          ok: true,
          payload: { connected: false },
          errorMessage: null,
        },
        notes: {
          ok: false,
          payload: { error: 'Notes failed' },
          errorMessage: 'Notes failed',
        },
      },
      []
    ),
    readSelectedCalendarIds: () => null,
    logError: () => undefined,
  })

  assert.equal(state.hasCriticalError, false)
  assert.equal(state.hasWarnings, true)
  assert.equal(state.errorsBySource.customers, 'Customers failed')
  assert.equal(state.errorsBySource.notes, 'Notes failed')
})

test('loadCrmHomeData logs malformed payloads and skips calendar events when disconnected', async () => {
  const calls: Array<{ source: CrmHomeSourceErrorKey; url: string }> = []
  const logCalls: Array<{ source: CrmHomeSourceErrorKey; message: string }> = []

  const state = await loadCrmHomeData({
    now: new Date('2026-04-21T12:00:00.000Z'),
    fetchJson: createFetchJsonStub(
      {
        jobs: {
          ok: true,
          payload: { jobs: [] },
          errorMessage: null,
        },
        customers: {
          ok: true,
          payload: { customers: 'bad' },
          errorMessage: null,
        },
        calendarStatus: {
          ok: true,
          payload: { connected: false },
          errorMessage: null,
        },
        notes: {
          ok: true,
          payload: { tasks: 'bad' },
          errorMessage: null,
        },
      },
      calls
    ),
    readSelectedCalendarIds: () => ['primary'],
    logError: (source, message) => {
      logCalls.push({ source, message })
    },
  })

  assert.equal(calls.some((call) => call.source === 'calendarEvents'), false)
  assert.equal(state.hasWarnings, true)
  assert.deepEqual(logCalls, [
    { source: 'customers', message: 'Malformed customers response.' },
    { source: 'notes', message: 'Malformed notes dashboard response.' },
  ])
})

test('reload path clears stale errors before a new successful resolution', async () => {
  const erroredState = await loadCrmHomeData({
    now: new Date('2026-04-21T12:00:00.000Z'),
    fetchJson: createFetchJsonStub(
      {
        jobs: {
          ok: false,
          payload: { error: 'Jobs failed' },
          errorMessage: 'Jobs failed',
        },
        customers: {
          ok: true,
          payload: { customers: [] },
          errorMessage: null,
        },
        calendarStatus: {
          ok: true,
          payload: { connected: false },
          errorMessage: null,
        },
        notes: {
          ok: true,
          payload: { tasks: { overdue: [], due_today: [] } },
          errorMessage: null,
        },
      },
      []
    ),
    readSelectedCalendarIds: () => null,
    logError: () => undefined,
  })

  const loadingState = createLoadingCrmHomeLoadState(erroredState.data, true)
  assert.deepEqual(loadingState.errorsBySource, {})

  const recoveredState = await loadCrmHomeData({
    now: new Date('2026-04-21T12:00:00.000Z'),
    fetchJson: createFetchJsonStub(
      {
        jobs: {
          ok: true,
          payload: { jobs: [] },
          errorMessage: null,
        },
        customers: {
          ok: true,
          payload: { customers: [] },
          errorMessage: null,
        },
        calendarStatus: {
          ok: true,
          payload: { connected: false },
          errorMessage: null,
        },
        notes: {
          ok: true,
          payload: { tasks: { overdue: [], due_today: [] } },
          errorMessage: null,
        },
      },
      []
    ),
    readSelectedCalendarIds: () => null,
    logError: () => undefined,
  })

  assert.deepEqual(recoveredState.errorsBySource, {})
  assert.equal(recoveredState.hasCriticalError, false)
})
