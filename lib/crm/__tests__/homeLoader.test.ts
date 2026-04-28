import assert from 'node:assert/strict'
import test from 'node:test'
import { loadCrmHomeData, loadCrmHomeSources } from '../home/loader.ts'
import { applyCrmHomeSourcePatch } from '../home/state.ts'
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
            data: [
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
        tasks: {
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

  assert.equal(state.summary.hasCriticalError, false)
  assert.equal(state.summary.hasWarnings, false)
  assert.equal(state.data.metrics.salesTotal, 1200)
  assert.equal(state.data.signals.calendarConnected, true)
  assert.equal(state.data.signals.calendarTodayEvents.length, 1)
  assert.equal(state.data.signals.taskReminders.length, 1)
  assert.equal(state.sources.jobs.availability, 'available')
  assert.equal(state.sources.customers.availability, 'available')
  assert.equal(state.data.customers.length, 1)
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
        tasks: {
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

  assert.equal(state.summary.hasCriticalError, true)
  assert.equal(state.summary.hasWarnings, false)
  assert.equal(state.sources.jobs.availability, 'unavailable')
  assert.equal(state.sources.jobs.errorMessage, 'Jobs failed')
})

test('loadCrmHomeData treats customers and tasks failures as warnings only', async () => {
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
        tasks: {
          ok: false,
          payload: { error: 'Tasks failed' },
          errorMessage: 'Tasks failed',
        },
      },
      []
    ),
    readSelectedCalendarIds: () => null,
    logError: () => undefined,
  })

  assert.equal(state.summary.hasCriticalError, false)
  assert.equal(state.summary.hasWarnings, true)
  assert.deepEqual(state.summary.warningSources, ['customers', 'tasks'])
  assert.equal(state.sources.customers.availability, 'unavailable')
  assert.equal(state.sources.tasks.availability, 'unavailable')
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
        tasks: {
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
  assert.equal(state.summary.hasWarnings, true)
  assert.equal(state.sources.calendarEvents.availability, 'missing')
  assert.deepEqual(logCalls, [
    { source: 'customers', message: 'Malformed customers response.' },
    { source: 'tasks', message: 'Malformed tasks dashboard response.' },
  ])
})

test('loadCrmHomeSources marks malformed payloads invalid and keeps partial refresh scoped', async () => {
  const patch = await loadCrmHomeSources(
    {
      now: new Date('2026-04-21T12:00:00.000Z'),
      fetchJson: createFetchJsonStub(
        {
          tasks: {
            ok: true,
            payload: { nope: true },
            errorMessage: null,
          },
        },
        []
      ),
      readSelectedCalendarIds: () => null,
      logError: () => undefined,
    },
    ['tasks']
  )

  assert.equal(patch.tasks?.source.availability, 'invalid')
  assert.equal(patch.tasks?.source.status, 'degraded')
  assert.equal(patch.jobs, undefined)
})

test('partial refresh updates only requested sources and calendar dependencies', async () => {
  const initial = await loadCrmHomeData({
    now: new Date('2026-04-21T12:00:00.000Z'),
    fetchJson: createFetchJsonStub(
      {
        jobs: { ok: true, payload: { jobs: [] }, errorMessage: null },
        customers: { ok: true, payload: { customers: [] }, errorMessage: null },
        calendarStatus: { ok: true, payload: { connected: false }, errorMessage: null },
        tasks: { ok: true, payload: { tasks: { overdue: [], due_today: [] } }, errorMessage: null },
      },
      []
    ),
    readSelectedCalendarIds: () => null,
    logError: () => undefined,
  })

  const calls: Array<{ source: CrmHomeSourceErrorKey; url: string }> = []
  const patch = await loadCrmHomeSources(
    {
      now: new Date('2026-04-21T12:05:00.000Z'),
      fetchJson: createFetchJsonStub(
        {
          calendarStatus: { ok: true, payload: { connected: true }, errorMessage: null },
          calendarEvents: { ok: true, payload: { events: [] }, errorMessage: null },
        },
        calls
      ),
      readSelectedCalendarIds: () => ['primary'],
      logError: () => undefined,
    },
    ['calendarEvents']
  )

  const refreshed = applyCrmHomeSourcePatch(
    initial,
    patch,
    new Date('2026-04-21T12:05:00.000Z')
  )

  assert.equal(calls.some((call) => call.source === 'jobs'), false)
  assert.equal(calls.some((call) => call.source === 'calendarStatus'), true)
  assert.equal(calls.some((call) => call.source === 'calendarEvents'), true)
  assert.equal(refreshed.sources.calendarStatus.availability, 'available')
  assert.equal(refreshed.sources.calendarEvents.availability, 'available')
})
