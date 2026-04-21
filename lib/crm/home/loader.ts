import { monthKeyLocal } from './calendar.ts'
import { buildCalendarTodayEvents, buildNotesReminders } from './selectors.ts'
import {
  buildCrmHomeErrors,
  createResolvedCrmHomeLoadState,
  readCalendarEventsPayload,
  readCalendarStatusPayload,
  readCustomersPayload,
  readJobsPayload,
  readNotesDashboardPayload,
} from './state.ts'
import type {
  CalendarEvent,
  CrmHomeFetchResponse,
  CrmHomeLoadState,
  CrmHomeLoaderDependencies,
  CrmHomeSourceResult,
  DashboardCustomer,
  DashboardJob,
  NotesDashboardPayload,
} from './types.ts'

type ParserResult<T> = {
  value: T
  error: string | null
}

function resolveSourceResult<T>(
  response: CrmHomeFetchResponse,
  parser: (payload: unknown) => ParserResult<T>,
  fallbackValue: T,
  fallbackErrorMessage: string,
  logError: CrmHomeLoaderDependencies['logError']
): CrmHomeSourceResult<T> {
  if (!response.ok) {
    const errorMessage = response.errorMessage ?? fallbackErrorMessage
    logError(response.source, errorMessage, response.payload)
    return {
      source: response.source,
      ok: false,
      value: fallbackValue,
      errorMessage,
      rawPayload: response.payload,
    }
  }

  const parsed = parser(response.payload)
  if (parsed.error) {
    logError(response.source, parsed.error, response.payload)
  }

  return {
    source: response.source,
    ok: true,
    value: parsed.value,
    errorMessage: parsed.error,
    rawPayload: response.payload,
  }
}

async function loadCalendarTodayEvents(
  deps: CrmHomeLoaderDependencies,
  now: Date
): Promise<CrmHomeSourceResult<CalendarEvent[]>> {
  const params = new URLSearchParams()
  params.set('month', monthKeyLocal(now))
  params.set('limit', '250')

  const selectedCalendarIds = deps.readSelectedCalendarIds()
  if (selectedCalendarIds && selectedCalendarIds.length > 0) {
    params.set('calendar_ids', selectedCalendarIds.join(','))
  } else {
    params.set('calendar_ids', 'primary')
  }

  const response = await deps.fetchJson(
    'calendarEvents',
    `/api/google-calendar/events?${params.toString()}`
  )

  const parsed = resolveSourceResult(
    response,
    readCalendarEventsPayload,
    [] as CalendarEvent[],
    'Unable to load calendar events.',
    deps.logError
  )

  return {
    ...parsed,
    value: buildCalendarTodayEvents(parsed.value, now),
  }
}

export async function loadCrmHomeData(
  deps: CrmHomeLoaderDependencies
): Promise<CrmHomeLoadState> {
  const now = deps.now ?? new Date()

  const [jobsResponse, customersResponse, calendarStatusResponse, notesResponse] =
    await Promise.all([
      deps.fetchJson('jobs', '/api/jobs'),
      deps.fetchJson('customers', '/api/customers'),
      deps.fetchJson('calendarStatus', '/api/google-calendar/status'),
      deps.fetchJson('notes', '/api/notes/dashboard'),
    ])

  const jobsResult = resolveSourceResult(
    jobsResponse,
    readJobsPayload,
    [] as DashboardJob[],
    'Unable to load jobs.',
    deps.logError
  )
  const customersResult = resolveSourceResult(
    customersResponse,
    readCustomersPayload,
    [] as DashboardCustomer[],
    'Unable to load customers.',
    deps.logError
  )
  const calendarStatusResult = resolveSourceResult(
    calendarStatusResponse,
    readCalendarStatusPayload,
    false,
    'Unable to load calendar status.',
    deps.logError
  )
  const notesResult = resolveSourceResult(
    notesResponse,
    readNotesDashboardPayload,
    null as NotesDashboardPayload | null,
    'Unable to load notes dashboard.',
    deps.logError
  )

  let calendarTodayEvents: CalendarEvent[] = []
  let calendarEventsError: string | null = null
  if (calendarStatusResult.value) {
    const calendarEventsResult = await loadCalendarTodayEvents(deps, now)
    calendarTodayEvents = calendarEventsResult.value
    calendarEventsError = calendarEventsResult.errorMessage
  }

  const errorsBySource = buildCrmHomeErrors([
    [jobsResult.source, jobsResult.errorMessage],
    [customersResult.source, customersResult.errorMessage],
    [calendarStatusResult.source, calendarStatusResult.errorMessage],
    ['calendarEvents', calendarEventsError],
    [notesResult.source, notesResult.errorMessage],
  ])

  return createResolvedCrmHomeLoadState({
    now,
    jobs: jobsResult.value,
    customers: customersResult.value,
    calendarConnected: calendarStatusResult.value ? true : false,
    calendarTodayEvents,
    notesReminders: notesResult.value ? buildNotesReminders(notesResult.value) : [],
    errorsBySource,
  })
}
