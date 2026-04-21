import { createCrmHomeData } from './selectors.ts'
import type {
  CalendarEvent,
  CrmHomeData,
  CrmHomeLoadState,
  CrmHomeSourceErrorKey,
  CrmHomeSourceErrorMap,
  DashboardCustomer,
  DashboardJob,
  NotesReminderSignal,
} from './types.ts'

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

export function readJobsPayload(payload: unknown) {
  if (!isRecord(payload) || !Array.isArray(payload.jobs)) {
    return { value: [] as DashboardJob[], error: 'Malformed jobs response.' }
  }
  return {
    value: payload.jobs.map(readJob).filter((job): job is DashboardJob => job != null),
    error: null,
  }
}

export function readCustomersPayload(payload: unknown) {
  if (!isRecord(payload) || !Array.isArray(payload.customers)) {
    return { value: [] as DashboardCustomer[], error: 'Malformed customers response.' }
  }
  return {
    value: payload.customers
      .map(readCustomer)
      .filter((customer): customer is DashboardCustomer => customer != null),
    error: null,
  }
}

export function readCalendarStatusPayload(payload: unknown) {
  if (!isRecord(payload) || typeof payload.connected !== 'boolean') {
    return { value: false, error: 'Malformed calendar status response.' }
  }
  return { value: payload.connected, error: null }
}

export function readCalendarEventsPayload(payload: unknown) {
  if (!isRecord(payload) || !Array.isArray(payload.events)) {
    return { value: [] as CalendarEvent[], error: 'Malformed calendar events response.' }
  }
  return {
    value: payload.events
      .map(readCalendarEvent)
      .filter((event): event is CalendarEvent => event != null),
    error: null,
  }
}

export function readNotesDashboardPayload(payload: unknown) {
  if (!isRecord(payload) || !isRecord(payload.tasks)) {
    return { value: null, error: 'Malformed notes dashboard response.' }
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
    error: null,
  }
}

export function createInitialCrmHomeLoadState(now = new Date()): CrmHomeLoadState {
  return {
    data: createCrmHomeData({
      jobs: [],
      customers: [],
      calendarConnected: null,
      calendarTodayEvents: [],
      notesReminders: [],
      now,
    }),
    errorsBySource: {},
    isInitialLoading: true,
    isReloading: false,
    hasCriticalError: false,
    hasWarnings: false,
  }
}

export function createLoadingCrmHomeLoadState(
  previousData: CrmHomeData,
  hasLoadedBefore: boolean
): CrmHomeLoadState {
  return {
    data: previousData,
    errorsBySource: {},
    isInitialLoading: !hasLoadedBefore,
    isReloading: hasLoadedBefore,
    hasCriticalError: false,
    hasWarnings: false,
  }
}

export function buildCrmHomeErrors(
  errors: Array<[CrmHomeSourceErrorKey, string | null | undefined]>
): CrmHomeSourceErrorMap {
  const next: CrmHomeSourceErrorMap = {}
  for (const [key, message] of errors) {
    if (message) next[key] = message
  }
  return next
}

export function hasCriticalCrmHomeError(errorsBySource: CrmHomeSourceErrorMap) {
  return Boolean(errorsBySource.jobs)
}

export function hasCrmHomeWarnings(errorsBySource: CrmHomeSourceErrorMap) {
  return Object.keys(errorsBySource).length > 0 && !hasCriticalCrmHomeError(errorsBySource)
}

export function getCrmHomeWarningSources(errorsBySource: CrmHomeSourceErrorMap) {
  return (Object.keys(errorsBySource) as CrmHomeSourceErrorKey[]).filter((key) => key !== 'jobs')
}

export function createResolvedCrmHomeLoadState({
  now = new Date(),
  jobs,
  customers,
  calendarConnected,
  calendarTodayEvents,
  notesReminders,
  errorsBySource,
}: {
  now?: Date
  jobs: DashboardJob[]
  customers: DashboardCustomer[]
  calendarConnected: boolean | null
  calendarTodayEvents: CalendarEvent[]
  notesReminders: NotesReminderSignal[]
  errorsBySource: CrmHomeSourceErrorMap
}): CrmHomeLoadState {
  return {
    data: createCrmHomeData({
      jobs,
      customers,
      calendarConnected,
      calendarTodayEvents,
      notesReminders,
      now,
    }),
    errorsBySource,
    isInitialLoading: false,
    isReloading: false,
    hasCriticalError: hasCriticalCrmHomeError(errorsBySource),
    hasWarnings: hasCrmHomeWarnings(errorsBySource),
  }
}
