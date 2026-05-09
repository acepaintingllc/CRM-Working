import { formatEventWindow } from '@/lib/crm/home/calendar'
import { formatCurrency, formatTaskDue } from '@/lib/crm/home/formatters'
import { buildSearchResults } from '@/lib/crm/home/selectors'
import { buildSearchSections } from './display'
import type {
  CrmHomeData,
  CrmHomeMetrics,
  CrmHomeSourceErrorKey,
  CrmHomeSourceStateMap,
  CrmHomeSummary,
} from '@/lib/crm/home/types'

type HomeStatusBannerVm = {
  visible: boolean
  tone: 'critical' | 'warning'
  title: string
  message: string
  retryLabel: string
}

type HomeSearchVm = {
  query: string
  sections: Array<{
    key: 'customers' | 'jobs'
    label: 'Customers' | 'Jobs'
    items: Array<{
      key: string
      href: string
      title: string
      subtitle: string | null
    }>
  }>
  isOpen: boolean
}

type HomeTopBarVm = {
  todayLabel: string
  greeting: string
  search: HomeSearchVm
}

type HomeMetricsVm = {
  metrics: CrmHomeMetrics
  isLoading: boolean
  isUnavailable: boolean
}

type ActivityItemVm = {
  id: string
  href: string
  title: string
  customerName: string
  amountLabel: string | null
  status: string | null
}

type CurrentJobItemVm = {
  id: string
  href: string
  title: string
  customerName: string
  scheduleLabel: string
  status: string | null
}

type CurrentJobsCardVm = {
  items: CurrentJobItemVm[]
  isEmpty: boolean
}

type ActivityCardVm = {
  items: ActivityItemVm[]
  isEmpty: boolean
  isUnavailable: boolean
  emptyMessage: string
  unavailableMessage: string
  tasksHref: string
  viewAllHref: string | null
  viewAllLabel: string | null
}

type CalendarEventRowVm = {
  key: string
  title: string
  subtitle: string
  href: string | null
}

type CalendarSignalsPanelVm = {
  loading: boolean
  errors: string[]
  disconnected: boolean
  disconnectedMessage: string
  connectHref: string
  connectLabel: string
  emptyMessage: string
  events: CalendarEventRowVm[]
}

type ReminderRowVm = {
  key: string
  href: string
  title: string
  subtitle: string
  tone: 'danger' | 'default'
}

type ReminderSignalsPanelVm = {
  loading: boolean
  isEmpty: boolean
  errors: string[]
  emptyMessage: string
  count: number
  items: ReminderRowVm[]
}

type SignalsFooterActionVm = {
  href: string
  label: string
  icon: 'calendar' | 'tasks'
}

type HomeSignalsVm = {
  calendarTabLabel: string
  remindersTabLabel: string
  calendar: CalendarSignalsPanelVm
  reminders: ReminderSignalsPanelVm
  footerActions: SignalsFooterActionVm[]
}

type QuickActionVm = {
  href: string
  label: string
  icon: 'calculator' | 'tasks' | 'users' | 'wrench'
  tone: 'primary' | 'secondary'
}

type HomeQuickActionsVm = {
  items: QuickActionVm[]
}

export type CrmHomePageViewModel = {
  topBar: HomeTopBarVm
  statusBanner: HomeStatusBannerVm | null
  metrics: HomeMetricsVm
  currentJobs: CurrentJobsCardVm
  activity: ActivityCardVm
  signals: HomeSignalsVm
  quickActions: HomeQuickActionsVm
}

const warningSourceLabels: Record<CrmHomeSourceErrorKey, string> = {
  jobs: 'Jobs',
  customers: 'Customers',
  calendarStatus: 'Calendar status',
  calendarEvents: 'Calendar events',
  tasks: 'Tasks',
}

function buildStatusBannerVm(params: {
  sources: CrmHomeSourceStateMap
  summary: CrmHomeSummary
}): HomeStatusBannerVm | null {
  const { sources, summary } = params
  if (!summary.hasCriticalError && !summary.hasWarnings) return null

  const degradedSources = summary.warningSources.map((key) => warningSourceLabels[key])

  return {
    visible: true,
    tone: summary.hasCriticalError ? 'critical' : 'warning',
    title: summary.hasCriticalError
      ? 'Dashboard metrics are unavailable.'
      : 'Some dashboard data is degraded.',
    message: summary.hasCriticalError
      ? (sources.jobs.errorMessage ?? 'Unable to load jobs.')
      : `Unavailable sources: ${degradedSources.join(', ')}.`,
    retryLabel: summary.isBusy ? 'Retrying...' : 'Retry',
  }
}

function buildActivityVm(
  data: CrmHomeData,
  sources: CrmHomeSourceStateMap,
  summary: CrmHomeSummary
): ActivityCardVm {
  const items = data.activityJobs.map((job) => {
    const amount = Number(job.estimate_total_amount)
    return {
      id: job.id,
      href: `/crm/jobs/${job.id}`,
      title: job.title ?? 'Untitled job',
      customerName: job.customer_name ?? 'No customer',
      amountLabel: Number.isFinite(amount) && amount > 0 ? formatCurrency(amount) : null,
      status: job.status,
    }
  })

  const isUnavailable =
    !summary.isInitialLoading &&
    (sources.jobs.status === 'error' || sources.jobs.status === 'degraded')

  return {
    items,
    isEmpty: items.length === 0,
    isUnavailable,
    emptyMessage: 'No activity yet. Create your first job to get started.',
    unavailableMessage: sources.jobs.errorMessage ?? 'Activity is unavailable right now.',
    tasksHref: '/crm/tasks',
    viewAllHref: data.jobs.length > items.length ? '/crm/jobs' : null,
    viewAllLabel: data.jobs.length > items.length ? `View all ${data.jobs.length} jobs` : null,
  }
}

function buildCurrentJobsVm(data: CrmHomeData): CurrentJobsCardVm {
  const items = data.currentJobs.map((job) => ({
    id: job.id,
    href: `/crm/jobs/${job.id}`,
    title: job.title ?? 'Untitled job',
    customerName: job.customer_name ?? 'No customer',
    scheduleLabel: formatEventWindow(job.scheduled_date ?? null, job.scheduled_end_date ?? null),
    status: job.status,
  }))

  return {
    items,
    isEmpty: items.length === 0,
  }
}

function buildSignalsVm(
  data: CrmHomeData,
  sources: CrmHomeSourceStateMap
): HomeSignalsVm {
  const calendarErrors = [sources.calendarStatus.errorMessage, sources.calendarEvents.errorMessage].filter(
    (error): error is string => Boolean(error)
  )
  const taskErrors = [sources.tasks.errorMessage].filter((error): error is string => Boolean(error))
  const calendarStatusReady = sources.calendarStatus.availability === 'available'

  return {
    calendarTabLabel: 'Calendar',
    remindersTabLabel: 'Reminders',
    calendar: {
      loading:
        sources.calendarStatus.status === 'loading' || sources.calendarEvents.status === 'loading',
      errors: calendarErrors,
      disconnected: calendarStatusReady && data.signals.calendarConnected === false,
      disconnectedMessage: 'Google Calendar is not connected.',
      connectHref: '/crm/calendar',
      connectLabel: 'Connect Google',
      emptyMessage: 'No calendar items today.',
      events: data.signals.calendarTodayEvents.map((event) => ({
        key: `${event.calendarId}:${event.id}`,
        title: event.summary ?? '(No title)',
        subtitle: formatEventWindow(event.start, event.end),
        href: event.htmlLink,
      })),
    },
    reminders: {
      loading: sources.tasks.status === 'loading',
      isEmpty: data.signals.taskReminders.length === 0,
      errors: taskErrors,
      emptyMessage: 'No reminders today.',
      count: data.signals.taskReminders.length,
      items: data.signals.taskReminders.slice(0, 4).map((signal) => ({
        key: `${signal.kind}:${signal.task.id}`,
        href: `/crm/tasks?focus=${encodeURIComponent(signal.task.id)}`,
        title: signal.task.title,
        subtitle: `${signal.kind === 'overdue' ? 'Overdue' : 'Due today'} \u2022 ${formatTaskDue(
          signal.task.due_at,
          signal.task.is_all_day,
          signal.task.has_due_time
        )}`,
        tone: signal.kind === 'overdue' ? 'danger' : 'default',
      })),
    },
    footerActions: [
      { href: '/crm/calendar', label: 'Calendar', icon: 'calendar' },
      { href: '/crm/tasks', label: 'Tasks', icon: 'tasks' },
    ],
  }
}

function buildQuickActionsVm(): HomeQuickActionsVm {
  return {
    items: [
      { href: '/crm/customers/new', label: 'Customer', icon: 'users', tone: 'primary' },
      { href: '/crm/jobs/new', label: 'New job', icon: 'wrench', tone: 'primary' },
      { href: '/crm/quotes/create', label: 'New quote', icon: 'calculator', tone: 'primary' },
      { href: '/crm/tasks', label: 'New task', icon: 'tasks', tone: 'secondary' },
    ],
  }
}

export function buildCrmHomePageViewModel(params: {
  data: CrmHomeData
  sources: CrmHomeSourceStateMap
  summary: CrmHomeSummary
  search: string
}): CrmHomePageViewModel {
  const { data, sources, summary, search } = params
  const results = buildSearchResults(data.customers, data.jobs, search)

  return {
    topBar: {
      todayLabel: data.todayLabel,
      greeting: data.greeting,
      search: {
        query: search,
        sections: buildSearchSections(results),
        isOpen: search.trim() !== '',
      },
    },
    statusBanner: buildStatusBannerVm({
      sources,
      summary,
    }),
    metrics: {
      metrics: data.metrics,
      isLoading: sources.jobs.status === 'loading',
      isUnavailable:
        !summary.isInitialLoading &&
        (sources.jobs.status === 'error' || sources.jobs.status === 'degraded'),
    },
    currentJobs: buildCurrentJobsVm(data),
    activity: buildActivityVm(data, sources, summary),
    signals: buildSignalsVm(data, sources),
    quickActions: buildQuickActionsVm(),
  }
}
