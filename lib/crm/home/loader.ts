import { monthKeyLocal } from './calendar.ts'
import { buildCalendarTodayEvents, buildNotesReminders } from './selectors.ts'
import {
  applyCrmHomeSourcePatch,
  createInitialCrmHomeLoadState,
  createSkippedCrmHomeSourceResult,
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
  CrmHomeSourceErrorKey,
  CrmHomeSourcePatch,
  CrmHomeSourceResult,
  DashboardCustomer,
  DashboardJob,
} from './types.ts'

type ParserResult<T> = {
  value: T
  availability: 'available' | 'missing' | 'invalid'
  errorMessage: string | null
}

function resolveStatus(
  availability: CrmHomeSourceResult<unknown>['availability'],
  ok: boolean
): CrmHomeSourceResult<unknown>['status'] {
  if (!ok) return 'error'
  if (availability === 'invalid') return 'degraded'
  return 'ready'
}

function resolveSourceResult<T>(
  response: CrmHomeFetchResponse,
  parser: (payload: unknown) => ParserResult<T>,
  fallbackValue: T,
  fallbackErrorMessage: string,
  logError: CrmHomeLoaderDependencies['logError'],
  now: Date
): CrmHomeSourceResult<T> {
  const lastLoadedAt = now.toISOString()

  if (!response.ok) {
    const errorMessage = response.errorMessage ?? fallbackErrorMessage
    logError(response.source, errorMessage, response.payload)
    return {
      source: response.source,
      ok: false,
      status: 'error',
      availability: 'unavailable',
      value: fallbackValue,
      errorMessage,
      rawPayload: response.payload,
      lastLoadedAt,
    }
  }

  const parsed = parser(response.payload)
  if (parsed.errorMessage) {
    logError(response.source, parsed.errorMessage, response.payload)
  }

  return {
    source: response.source,
    ok: true,
    status: resolveStatus(parsed.availability, true),
    availability: parsed.availability,
    value: parsed.value,
    errorMessage: parsed.errorMessage,
    rawPayload: response.payload,
    lastLoadedAt,
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
    deps.logError,
    now
  )

  return {
    ...parsed,
    value: buildCalendarTodayEvents(parsed.value, now),
  }
}

async function loadJobsPatch(
  deps: CrmHomeLoaderDependencies,
  now: Date
): Promise<CrmHomeSourcePatch['jobs']> {
  const response = await deps.fetchJson('jobs', '/api/jobs')
  const source = resolveSourceResult(
    response,
    readJobsPayload,
    [] as DashboardJob[],
    'Unable to load jobs.',
    deps.logError,
    now
  )

  return {
    source,
    data: source.value,
  }
}

async function loadCustomersPatch(
  deps: CrmHomeLoaderDependencies,
  now: Date
): Promise<CrmHomeSourcePatch['customers']> {
  const response = await deps.fetchJson('customers', '/api/customers')
  const source = resolveSourceResult(
    response,
    readCustomersPayload,
    [] as DashboardCustomer[],
    'Unable to load customers.',
    deps.logError,
    now
  )

  return {
    source,
    data: source.value,
  }
}

async function loadNotesPatch(
  deps: CrmHomeLoaderDependencies,
  now: Date
): Promise<CrmHomeSourcePatch['notes']> {
  const response = await deps.fetchJson('notes', '/api/notes/dashboard')
  const source = resolveSourceResult(
    response,
    readNotesDashboardPayload,
    null,
    'Unable to load notes dashboard.',
    deps.logError,
    now
  )

  return {
    source,
    data: source.value ? buildNotesReminders(source.value) : [],
  }
}

async function loadCalendarPatch(
  deps: CrmHomeLoaderDependencies,
  now: Date
): Promise<Pick<CrmHomeSourcePatch, 'calendarStatus' | 'calendarEvents'>> {
  const statusResponse = await deps.fetchJson('calendarStatus', '/api/google-calendar/status')
  const statusSource = resolveSourceResult(
    statusResponse,
    readCalendarStatusPayload,
    false,
    'Unable to load calendar status.',
    deps.logError,
    now
  )

  if (statusSource.availability === 'available' && statusSource.value) {
    const eventsSource = await loadCalendarTodayEvents(deps, now)
    return {
      calendarStatus: {
        source: statusSource,
        data: true,
      },
      calendarEvents: {
        source: eventsSource,
        data: eventsSource.value,
      },
    }
  }

  return {
    calendarStatus: {
      source: statusSource,
      data: statusSource.availability === 'available' ? statusSource.value : false,
    },
    calendarEvents: {
      source: createSkippedCrmHomeSourceResult(
        'calendarEvents',
        'missing',
        now.toISOString(),
        []
      ),
      data: [],
    },
  }
}

export async function loadCrmHomeSources(
  deps: CrmHomeLoaderDependencies,
  sourceKeys: CrmHomeSourceErrorKey[]
): Promise<CrmHomeSourcePatch> {
  const now = deps.now ?? new Date()
  const patch: CrmHomeSourcePatch = {}
  const requested = new Set(sourceKeys)

  const parallelTasks: Promise<void>[] = []

  if (requested.has('jobs')) {
    parallelTasks.push(
      loadJobsPatch(deps, now).then((result) => {
        patch.jobs = result
      })
    )
  }

  if (requested.has('customers')) {
    parallelTasks.push(
      loadCustomersPatch(deps, now).then((result) => {
        patch.customers = result
      })
    )
  }

  if (requested.has('notes')) {
    parallelTasks.push(
      loadNotesPatch(deps, now).then((result) => {
        patch.notes = result
      })
    )
  }

  const wantsCalendar =
    requested.has('calendarStatus') || requested.has('calendarEvents')

  if (wantsCalendar) {
    parallelTasks.push(
      loadCalendarPatch(deps, now).then((result) => {
        patch.calendarStatus = result.calendarStatus
        patch.calendarEvents = result.calendarEvents
      })
    )
  }

  await Promise.all(parallelTasks)
  return patch
}

export async function loadCrmHomeData(
  deps: CrmHomeLoaderDependencies
): Promise<CrmHomeLoadState> {
  const now = deps.now ?? new Date()
  const initialState = createInitialCrmHomeLoadState(now)
  const patch = await loadCrmHomeSources(deps, [
    'jobs',
    'customers',
    'calendarStatus',
    'notes',
  ])
  return applyCrmHomeSourcePatch(initialState, patch, now)
}
