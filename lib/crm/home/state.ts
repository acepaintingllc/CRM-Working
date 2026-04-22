import { createCrmHomeData } from './selectors.ts'
import type {
  CalendarEvent,
  CrmHomeLoadState,
  CrmHomeSourceAvailability,
  CrmHomeSourceErrorKey,
  CrmHomeSourceErrorMap,
  CrmHomeSourcePatch,
  CrmHomeSourceResult,
  CrmHomeSourceState,
  CrmHomeSourceStateMap,
  CrmHomeSummary,
  DashboardCustomer,
  DashboardJob,
  NotesReminderSignal,
} from './types.ts'

const CRM_HOME_SOURCE_KEYS: CrmHomeSourceErrorKey[] = [
  'jobs',
  'customers',
  'calendarStatus',
  'calendarEvents',
  'notes',
]

type ParserResult<T> = {
  value: T
  availability: Extract<CrmHomeSourceAvailability, 'available' | 'missing' | 'invalid'>
  errorMessage: string | null
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : null
}

function readNotesTaskSignal(value: unknown) {
  if (!isRecord(value)) return null
  const id = readString(value.id)
  const title = readString(value.title)
  if (!id || !title) return null
  return {
    id,
    title,
    description: readString(value.description),
    due_at: readString(value.due_at),
    is_all_day: value.is_all_day === true,
    has_due_time: value.has_due_time === true,
  }
}

function readJob(value: unknown) {
  if (!isRecord(value)) return null
  const id = readString(value.id)
  if (!id) return null
  return {
    id,
    status: readString(value.status),
    title: readString(value.title),
    customer_name: readString(value.customer_name),
    customer_address: readString(value.customer_address),
    estimate_total_amount:
      typeof value.estimate_total_amount === 'number' || typeof value.estimate_total_amount === 'string'
        ? value.estimate_total_amount
        : null,
  }
}

function readCustomer(value: unknown) {
  if (!isRecord(value)) return null
  const id = readString(value.id)
  if (!id) return null
  return {
    id,
    name: readString(value.name),
    email: readString(value.email),
    phone: readString(value.phone),
    address: readString(value.address),
  }
}

function readCalendarEvent(value: unknown) {
  if (!isRecord(value)) return null
  const id = readString(value.id)
  const calendarId = readString(value.calendarId)
  if (!id || !calendarId) return null
  return {
    id,
    calendarId,
    summary: readString(value.summary),
    start: readString(value.start),
    end: readString(value.end),
    htmlLink: readString(value.htmlLink),
  }
}

export function readJobsPayload(payload: unknown): ParserResult<DashboardJob[]> {
  const rows =
    isRecord(payload) && Array.isArray(payload.jobs)
      ? payload.jobs
      : isRecord(payload) && Array.isArray(payload.data)
        ? payload.data
        : null
  if (!rows) {
    return {
      value: [],
      availability: 'invalid',
      errorMessage: 'Malformed jobs response.',
    }
  }
  return {
    value: rows.map(readJob).filter((job): job is DashboardJob => job != null),
    availability: 'available',
    errorMessage: null,
  }
}

export function readCustomersPayload(payload: unknown): ParserResult<DashboardCustomer[]> {
  const rows =
    isRecord(payload) && Array.isArray(payload.customers)
      ? payload.customers
      : isRecord(payload) && Array.isArray(payload.data)
        ? payload.data
        : null

  if (!rows) {
    return {
      value: [],
      availability: 'invalid',
      errorMessage: 'Malformed customers response.',
    }
  }
  return {
    value: rows
      .map(readCustomer)
      .filter((customer): customer is DashboardCustomer => customer != null),
    availability: 'available',
    errorMessage: null,
  }
}

export function readCalendarStatusPayload(payload: unknown): ParserResult<boolean> {
  const data = isRecord(payload) && isRecord(payload.data) ? payload.data : payload

  if (!isRecord(data) || !('connected' in data)) {
    return {
      value: false,
      availability: 'missing',
      errorMessage: 'Missing calendar status response.',
    }
  }

  if (typeof data.connected !== 'boolean') {
    return {
      value: false,
      availability: 'invalid',
      errorMessage: 'Malformed calendar status response.',
    }
  }

  return { value: data.connected, availability: 'available', errorMessage: null }
}

export function readCalendarEventsPayload(payload: unknown): ParserResult<CalendarEvent[]> {
  const data = isRecord(payload) && isRecord(payload.data) ? payload.data : payload

  if (!isRecord(data) || !Array.isArray(data.events)) {
    return {
      value: [],
      availability: 'invalid',
      errorMessage: 'Malformed calendar events response.',
    }
  }
  return {
    value: data.events
      .map(readCalendarEvent)
      .filter((event): event is CalendarEvent => event != null),
    availability: 'available',
    errorMessage: null,
  }
}

export function readNotesDashboardPayload(payload: unknown): ParserResult<{
  tasks: {
    overdue: NonNullable<ReturnType<typeof readNotesTaskSignal>>[]
    due_today: NonNullable<ReturnType<typeof readNotesTaskSignal>>[]
  }
} | null> {
  if (!isRecord(payload) || !isRecord(payload.tasks)) {
    return {
      value: null,
      availability: 'invalid',
      errorMessage: 'Malformed notes dashboard response.',
    }
  }

  const overdue = Array.isArray(payload.tasks.overdue)
    ? payload.tasks.overdue
        .map(readNotesTaskSignal)
        .filter((task): task is NonNullable<ReturnType<typeof readNotesTaskSignal>> => task != null)
    : []
  const dueToday = Array.isArray(payload.tasks.due_today)
    ? payload.tasks.due_today
        .map(readNotesTaskSignal)
        .filter((task): task is NonNullable<ReturnType<typeof readNotesTaskSignal>> => task != null)
    : []

  return {
    value: {
      tasks: {
        overdue,
        due_today: dueToday,
      },
    },
    availability: 'available',
    errorMessage: null,
  }
}

export function createCrmHomeSourceState(
  status: CrmHomeSourceState['status'],
  availability: CrmHomeSourceAvailability,
  errorMessage: string | null = null,
  lastLoadedAt: string | null = null,
  canRefresh = true
): CrmHomeSourceState {
  return {
    status,
    availability,
    errorMessage,
    lastLoadedAt,
    canRefresh,
  }
}

export function createInitialCrmHomeSourceStateMap(): CrmHomeSourceStateMap {
  return {
    jobs: createCrmHomeSourceState('loading', 'missing'),
    customers: createCrmHomeSourceState('loading', 'missing'),
    calendarStatus: createCrmHomeSourceState('loading', 'missing'),
    calendarEvents: createCrmHomeSourceState('loading', 'missing'),
    notes: createCrmHomeSourceState('loading', 'missing'),
  }
}

export function sourceResultToState<T>(result: CrmHomeSourceResult<T>): CrmHomeSourceState {
  return {
    status: result.status,
    availability: result.availability,
    errorMessage: result.errorMessage,
    lastLoadedAt: result.lastLoadedAt,
    canRefresh: true,
  }
}

export function createSkippedCrmHomeSourceResult(
  source: CrmHomeSourceErrorKey,
  availability: Extract<CrmHomeSourceAvailability, 'missing'>,
  lastLoadedAt: string,
  value: CalendarEvent[]
): CrmHomeSourceResult<CalendarEvent[]> {
  return {
    source,
    ok: true,
    status: 'ready',
    availability,
    value,
    errorMessage: null,
    rawPayload: null,
    lastLoadedAt,
  }
}

export function buildCrmHomeErrors(
  sources: CrmHomeSourceStateMap
): CrmHomeSourceErrorMap {
  const next: CrmHomeSourceErrorMap = {}
  for (const key of CRM_HOME_SOURCE_KEYS) {
    const message = sources[key].errorMessage
    if (message) next[key] = message
  }
  return next
}

export function getCrmHomeWarningSources(sources: CrmHomeSourceStateMap) {
  return CRM_HOME_SOURCE_KEYS.filter((key) => {
    if (key === 'jobs') return false
    const source = sources[key]
    return source.status === 'error' || source.status === 'degraded'
  })
}

export function deriveCrmHomeSummary(sources: CrmHomeSourceStateMap): CrmHomeSummary {
  const isBusy = CRM_HOME_SOURCE_KEYS.some((key) => sources[key].status === 'loading')
  const hasLoadedAnySource = CRM_HOME_SOURCE_KEYS.some((key) => sources[key].lastLoadedAt != null)
  const isInitialLoading = isBusy && !hasLoadedAnySource
  const isReloading = isBusy && hasLoadedAnySource
  const jobsSource = sources.jobs
  const hasCriticalError = jobsSource.status === 'error' || jobsSource.status === 'degraded'
  const warningSources = getCrmHomeWarningSources(sources)

  return {
    isInitialLoading,
    isReloading,
    hasCriticalError,
    hasWarnings: !hasCriticalError && warningSources.length > 0,
    warningSources,
    isBusy,
  }
}

function createDataFromStateParts(params: {
  data: CrmHomeLoadState['data']
  jobs?: DashboardJob[]
  customers?: DashboardCustomer[]
  calendarConnected?: boolean | null
  calendarTodayEvents?: CalendarEvent[]
  notesReminders?: NotesReminderSignal[]
  now?: Date
}) {
  const { data, now } = params
  return createCrmHomeData({
    jobs: params.jobs ?? data.jobs,
    customers: params.customers ?? data.customers,
    calendarConnected: params.calendarConnected ?? data.signals.calendarConnected,
    calendarTodayEvents: params.calendarTodayEvents ?? data.signals.calendarTodayEvents,
    notesReminders: params.notesReminders ?? data.signals.notesReminders,
    now,
  })
}

export function createInitialCrmHomeLoadState(now = new Date()): CrmHomeLoadState {
  const sources = createInitialCrmHomeSourceStateMap()
  return {
    data: createCrmHomeData({
      jobs: [],
      customers: [],
      calendarConnected: null,
      calendarTodayEvents: [],
      notesReminders: [],
      now,
    }),
    sources,
    summary: deriveCrmHomeSummary(sources),
  }
}

export function createLoadingCrmHomeLoadState(
  previousState: CrmHomeLoadState,
  sourceKeys: CrmHomeSourceErrorKey[]
): CrmHomeLoadState {
  const sources = { ...previousState.sources }

  for (const key of sourceKeys) {
    sources[key] = {
      ...sources[key],
      status: 'loading',
      errorMessage: null,
    }
  }

  return {
    data: previousState.data,
    sources,
    summary: deriveCrmHomeSummary(sources),
  }
}

export function applyCrmHomeSourcePatch(
  previousState: CrmHomeLoadState,
  patch: CrmHomeSourcePatch,
  now = new Date()
): CrmHomeLoadState {
  const sources = { ...previousState.sources }
  let jobs = previousState.data.jobs
  let customers = previousState.data.customers
  let calendarConnected = previousState.data.signals.calendarConnected
  let calendarTodayEvents = previousState.data.signals.calendarTodayEvents
  let notesReminders = previousState.data.signals.notesReminders

  if (patch.jobs) {
    sources.jobs = sourceResultToState(patch.jobs.source)
    jobs = patch.jobs.data
  }

  if (patch.customers) {
    sources.customers = sourceResultToState(patch.customers.source)
    customers = patch.customers.data
  }

  if (patch.calendarStatus) {
    sources.calendarStatus = sourceResultToState(patch.calendarStatus.source)
    calendarConnected = patch.calendarStatus.data
  }

  if (patch.calendarEvents) {
    sources.calendarEvents = sourceResultToState(patch.calendarEvents.source)
    calendarTodayEvents = patch.calendarEvents.data
  }

  if (patch.notes) {
    sources.notes = sourceResultToState(patch.notes.source)
    notesReminders = patch.notes.data
  }

  const data = createDataFromStateParts({
    data: previousState.data,
    jobs,
    customers,
    calendarConnected,
    calendarTodayEvents,
    notesReminders,
    now,
  })

  return {
    data,
    sources,
    summary: deriveCrmHomeSummary(sources),
  }
}

export function createResolvedCrmHomeLoadState(params: {
  now?: Date
  jobs: DashboardJob[]
  customers: DashboardCustomer[]
  calendarConnected: boolean | null
  calendarTodayEvents: CalendarEvent[]
  notesReminders: NotesReminderSignal[]
  sources: Partial<CrmHomeSourceStateMap>
}): CrmHomeLoadState {
  const baseSources = createInitialCrmHomeSourceStateMap()
  const sources = {
    ...baseSources,
    ...params.sources,
  }

  return {
    data: createCrmHomeData({
      jobs: params.jobs,
      customers: params.customers,
      calendarConnected: params.calendarConnected,
      calendarTodayEvents: params.calendarTodayEvents,
      notesReminders: params.notesReminders,
      now: params.now,
    }),
    sources,
    summary: deriveCrmHomeSummary(sources),
  }
}
