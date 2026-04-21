import { eventOccursToday, eventSortValue } from './calendar.ts'
import { formatTodayLabel, getGreeting } from './formatters.ts'
import type {
  CalendarEvent,
  CrmHomeData,
  CrmHomeMetrics,
  CrmHomeSearchResults,
  DashboardCustomer,
  DashboardJob,
  NotesDashboardPayload,
  NotesReminderSignal,
} from './types.ts'

function getPositiveAmount(value: number | string | null | undefined) {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null
}

function getAnyAmount(value: number | string | null | undefined) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

export function buildOpenJobs(jobs: DashboardJob[]) {
  return jobs.filter((job) => job.status !== 'completed' && job.status !== 'lost')
}

export function buildCrmHomeMetrics(jobs: DashboardJob[]): CrmHomeMetrics {
  const won = jobs.filter((job) => job.status === 'completed').length
  const lost = jobs.filter((job) => job.status === 'lost').length
  const total = won + lost
  const winRate = total > 0 ? Math.round((won / total) * 100) : 0

  const completedWithTotal = jobs
    .filter((job) => job.status === 'completed')
    .map((job) => getPositiveAmount(job.estimate_total_amount))
    .filter((value): value is number => value != null)

  const openJobs = buildOpenJobs(jobs)
  const openValues = openJobs
    .map((job) => getPositiveAmount(job.estimate_total_amount))
    .filter((value): value is number => value != null)

  return {
    won,
    lost,
    total,
    winRate,
    avgTicket:
      completedWithTotal.length > 0
        ? completedWithTotal.reduce((sum, value) => sum + value, 0) / completedWithTotal.length
        : null,
    salesTotal: jobs
      .filter((job) => job.status === 'completed')
      .reduce((sum, job) => sum + (getAnyAmount(job.estimate_total_amount) ?? 0), 0),
    pipelineTotal: jobs.reduce(
      (sum, job) => sum + (getPositiveAmount(job.estimate_total_amount) ?? 0),
      0
    ),
    totalEstimates: jobs.length,
    openJobsCount: openJobs.length,
    openJobsTotal: openValues.reduce((sum, value) => sum + value, 0),
    openJobsAvgValue:
      openValues.length > 0
        ? openValues.reduce((sum, value) => sum + value, 0) / openValues.length
        : null,
  }
}

export function buildSearchResults(
  customers: DashboardCustomer[],
  jobs: DashboardJob[],
  search: string,
  limit = 5
): CrmHomeSearchResults {
  const query = search.trim().toLowerCase()
  if (!query) return { customers: [], jobs: [] }

  const customerMatches = customers.filter((customer) => {
    const haystack =
      `${customer.name ?? ''} ${customer.email ?? ''} ${customer.phone ?? ''} ${customer.address ?? ''}`.toLowerCase()
    return haystack.includes(query)
  })

  const jobMatches = jobs.filter((job) => {
    const haystack =
      `${job.title ?? ''} ${job.customer_name ?? ''} ${job.customer_address ?? ''}`.toLowerCase()
    return haystack.includes(query)
  })

  return {
    customers: customerMatches.slice(0, limit),
    jobs: jobMatches.slice(0, limit),
  }
}

export function sortNotesSignals(signals: NotesReminderSignal[]) {
  return [...signals].sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === 'overdue' ? -1 : 1
    const leftDue = left.task.due_at ? new Date(left.task.due_at).getTime() : Number.MAX_SAFE_INTEGER
    const rightDue = right.task.due_at ? new Date(right.task.due_at).getTime() : Number.MAX_SAFE_INTEGER
    return leftDue - rightDue
  })
}

export function buildNotesReminders(payload: NotesDashboardPayload | null | undefined, limit = 8) {
  const overdue = (payload?.tasks?.overdue ?? []).map((task) => ({ kind: 'overdue' as const, task }))
  const dueToday = (payload?.tasks?.due_today ?? []).map((task) => ({
    kind: 'due_today' as const,
    task,
  }))
  return sortNotesSignals([...overdue, ...dueToday]).slice(0, limit)
}

export function buildCalendarTodayEvents(events: CalendarEvent[], now: Date, limit = 8) {
  return events
    .filter((event) => eventOccursToday(event, now))
    .sort((left, right) => eventSortValue(left) - eventSortValue(right))
    .slice(0, limit)
}

export function buildActivityJobs(jobs: DashboardJob[], limit = 8) {
  return jobs.slice(0, limit)
}

export function createCrmHomeData({
  jobs,
  customers,
  calendarConnected,
  calendarTodayEvents,
  notesReminders,
  now = new Date(),
}: {
  jobs: DashboardJob[]
  customers: DashboardCustomer[]
  calendarConnected: boolean | null
  calendarTodayEvents: CalendarEvent[]
  notesReminders: NotesReminderSignal[]
  now?: Date
}): CrmHomeData {
  return {
    jobs,
    customers,
    metrics: buildCrmHomeMetrics(jobs),
    activityJobs: buildActivityJobs(jobs),
    signals: {
      calendarConnected,
      calendarTodayEvents,
      notesReminders,
    },
    greeting: getGreeting(now),
    todayLabel: formatTodayLabel(now),
  }
}
