export type DashboardJob = {
  id: string
  status: string | null
  title: string | null
  customer_name: string | null
  customer_address: string | null
  estimate_total_amount: number | string | null
}

export type DashboardCustomer = {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  address: string | null
}

export type CalendarEvent = {
  id: string
  calendarId: string
  summary: string | null
  start: string | null
  end: string | null
  htmlLink: string | null
}

export type NotesTaskSignal = {
  id: string
  title: string
  description: string | null
  due_at: string | null
  is_all_day: boolean
  has_due_time: boolean
}

export type NotesDashboardPayload = {
  tasks: {
    overdue: NotesTaskSignal[]
    due_today: NotesTaskSignal[]
  }
}

export type NotesReminderSignal = {
  kind: 'overdue' | 'due_today'
  task: NotesTaskSignal
}

export type CrmHomeMetrics = {
  won: number
  lost: number
  total: number
  winRate: number
  avgTicket: number | null
  salesTotal: number
  pipelineTotal: number
  totalEstimates: number
  openJobsCount: number
  openJobsTotal: number
  openJobsAvgValue: number | null
}

export type CrmHomeSearchResults = {
  customers: DashboardCustomer[]
  jobs: DashboardJob[]
}

export type CrmHomeSignals = {
  calendarConnected: boolean | null
  calendarTodayEvents: CalendarEvent[]
  notesReminders: NotesReminderSignal[]
}

export type CrmHomeData = {
  jobs: DashboardJob[]
  customers: DashboardCustomer[]
  metrics: CrmHomeMetrics
  activityJobs: DashboardJob[]
  signals: CrmHomeSignals
  greeting: string
  todayLabel: string
}

export type CrmHomeSourceErrorKey =
  | 'jobs'
  | 'customers'
  | 'calendarStatus'
  | 'calendarEvents'
  | 'notes'

export type CrmHomeSourceErrorMap = Partial<Record<CrmHomeSourceErrorKey, string>>

export type CrmHomeFetchResponse = {
  source: CrmHomeSourceErrorKey
  ok: boolean
  payload: unknown
  errorMessage: string | null
}

export type CrmHomeSourceResult<T> = {
  source: CrmHomeSourceErrorKey
  ok: boolean
  value: T
  errorMessage: string | null
  rawPayload: unknown
}

export type CrmHomeLoaderDependencies = {
  now?: Date
  fetchJson: (source: CrmHomeSourceErrorKey, url: string) => Promise<CrmHomeFetchResponse>
  readSelectedCalendarIds: () => string[] | null
  logError: (source: CrmHomeSourceErrorKey, message: string, detail?: unknown) => void
}

export type CrmHomeLoadState = {
  data: CrmHomeData
  errorsBySource: CrmHomeSourceErrorMap
  isInitialLoading: boolean
  isReloading: boolean
  hasCriticalError: boolean
  hasWarnings: boolean
}
