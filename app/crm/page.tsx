'use client'

import { authedFetch } from '@/lib/auth/authedFetch'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowRight,
  BellRing,
  CalendarCheck,
  CircleX,
  DollarSign,
  LayoutDashboard,
  Link2,
  NotebookText,
  Plus,
  Search,
  Settings,
  Trophy,
  TrendingUp,
  Users,
  Wrench,
} from 'lucide-react'

type DashboardJob = {
  id: string
  status: string | null
  title: string | null
  customer_name: string | null
  customer_address: string | null
  estimate_total_amount?: number | string | null
}

type DashboardCustomer = {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  address: string | null
}

type CalendarEvent = {
  id: string
  calendarId: string
  summary: string | null
  start: string | null
  end: string | null
  htmlLink: string | null
}

type NotesTaskSignal = {
  id: string
  title: string
  description: string | null
  due_at: string | null
  is_all_day: boolean
  has_due_time: boolean
}

type NotesDashboardPayload = {
  tasks: {
    overdue: NotesTaskSignal[]
    due_today: NotesTaskSignal[]
  }
}

type NotesReminderSignal = {
  kind: 'overdue' | 'due_today'
  task: NotesTaskSignal
}

const iconSizeSm = 16
const iconSizeMd = 18

function iconLabel(Icon: LucideIcon, label: string, size = iconSizeSm) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon size={size} aria-hidden="true" />
      <span>{label}</span>
    </span>
  )
}

const selectedCalendarsStorageKey = 'acecrm.calendar.selected'

function readStoredCalendarIds() {
  try {
    const raw = localStorage.getItem(selectedCalendarsStorageKey)
    const parsed = raw ? JSON.parse(raw) : null
    if (!Array.isArray(parsed)) return null
    const ids = parsed.filter((value) => typeof value === 'string' && value.trim().length > 0)
    return ids.length > 0 ? (ids as string[]) : null
  } catch {
    return null
  }
}

function monthKeyLocal(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function isDateOnly(value: string | null | undefined) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
}

function parseDate(value: string | null | undefined) {
  if (!value) return null
  if (isDateOnly(value)) {
    const [year, month, day] = value.split('-').map((part) => Number(part))
    if (!year || !month || !day) return null
    return new Date(year, month - 1, day)
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function eventOccursToday(event: CalendarEvent, now: Date) {
  const start = parseDate(event.start)
  if (!start) return false

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrowStart = new Date(todayStart)
  tomorrowStart.setDate(tomorrowStart.getDate() + 1)

  if (isDateOnly(event.start)) {
    const end = parseDate(event.end)
    const eventEnd = end ?? new Date(start.getTime() + 24 * 60 * 60 * 1000)
    return start < tomorrowStart && eventEnd > todayStart
  }

  const end = parseDate(event.end) ?? start
  return start < tomorrowStart && end >= todayStart
}

function eventSortValue(event: CalendarEvent) {
  const start = parseDate(event.start)
  return start?.getTime() ?? Number.MAX_SAFE_INTEGER
}

function formatEventWindow(start: string | null, end: string | null) {
  const startDate = parseDate(start)
  const endDate = parseDate(end)
  if (!startDate) return 'Time TBD'
  if (isDateOnly(start) && isDateOnly(end)) {
    return `${startDate.toLocaleDateString()} (all day)`
  }
  if (isDateOnly(start) && !end) {
    return `${startDate.toLocaleDateString()} (all day)`
  }
  if (endDate) {
    const sameDay =
      startDate.getFullYear() === endDate.getFullYear() &&
      startDate.getMonth() === endDate.getMonth() &&
      startDate.getDate() === endDate.getDate()
    if (sameDay) {
      return `${startDate.toLocaleDateString()} | ${startDate.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      })} - ${endDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
    }
    return `${startDate.toLocaleString()} - ${endDate.toLocaleString()}`
  }
  return startDate.toLocaleString()
}

function sortNotesSignals(signals: NotesReminderSignal[]) {
  return [...signals].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'overdue' ? -1 : 1
    const aDue = a.task.due_at ? new Date(a.task.due_at).getTime() : Number.MAX_SAFE_INTEGER
    const bDue = b.task.due_at ? new Date(b.task.due_at).getTime() : Number.MAX_SAFE_INTEGER
    return aDue - bDue
  })
}

export default function CRMHome() {
  const [counts, setCounts] = useState<{
    won: number
    lost: number
    total: number
    winRate: number
    avgTicket: number | null
  } | null>(null)
  const [jobs, setJobs] = useState<DashboardJob[]>([])
  const [customers, setCustomers] = useState<DashboardCustomer[]>([])
  const [search, setSearch] = useState('')
  const [signalsLoading, setSignalsLoading] = useState(false)
  const [calendarConnected, setCalendarConnected] = useState<boolean | null>(null)
  const [calendarError, setCalendarError] = useState<string | null>(null)
  const [notesError, setNotesError] = useState<string | null>(null)
  const [calendarTodayEvents, setCalendarTodayEvents] = useState<CalendarEvent[]>([])
  const [notesReminders, setNotesReminders] = useState<NotesReminderSignal[]>([])
  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }, [])

  useEffect(() => {
    const load = async () => {
      const res = await authedFetch('/api/jobs', { cache: 'no-store' })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        setCounts(null)
        return
      }
      const jobs = (payload?.jobs ?? []) as DashboardJob[]
      setJobs(jobs)
      const won = jobs.filter((j) => j.status === 'completed').length
      const lost = jobs.filter((j) => j.status === 'lost').length
      const total = won + lost
      const winRate = total > 0 ? Math.round((won / total) * 100) : 0
      const completedWithTotal = jobs.filter((j) => {
        if (j.status !== 'completed') return false
        const n = Number(j.estimate_total_amount)
        return Number.isFinite(n) && n > 0
      })
      const avgTicket =
        completedWithTotal.length > 0
          ? completedWithTotal.reduce((sum, j) => sum + Number(j.estimate_total_amount), 0) /
            completedWithTotal.length
          : null
      setCounts({ won, lost, total, winRate, avgTicket })
    }
    void load()
  }, [])

  useEffect(() => {
    const loadCustomers = async () => {
      const res = await authedFetch('/api/customers', { cache: 'no-store' })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        setCustomers([])
        return
      }
      setCustomers((payload?.customers ?? []) as DashboardCustomer[])
    }
    void loadCustomers()
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadSignals = async () => {
      setSignalsLoading(true)
      setCalendarError(null)
      setNotesError(null)

      const now = new Date()
      let nextCalendarConnected: boolean | null = null
      let nextCalendarError: string | null = null
      let nextCalendarTodayEvents: CalendarEvent[] = []
      let nextNotesError: string | null = null
      let nextNotesReminders: NotesReminderSignal[] = []

      const [calendarStatusRes, notesDashboardRes] = await Promise.all([
        authedFetch('/api/google-calendar/status', { cache: 'no-store' }),
        authedFetch('/api/notes/dashboard', { cache: 'no-store' }),
      ])

      const calendarStatusPayload = await calendarStatusRes.json().catch(() => null)
      const notesDashboardPayload = await notesDashboardRes.json().catch(() => null)

      if (!calendarStatusRes.ok) {
        nextCalendarConnected = false
        nextCalendarError = calendarStatusPayload?.error ?? 'Unable to load calendar status.'
      } else {
        nextCalendarConnected = Boolean(calendarStatusPayload?.connected)
      }

      if (nextCalendarConnected) {
        const params = new URLSearchParams()
        params.set('month', monthKeyLocal(now))
        params.set('limit', '250')
        const selected = readStoredCalendarIds()
        if (selected && selected.length > 0) {
          params.set('calendar_ids', selected.join(','))
        } else {
          params.set('calendar_ids', 'primary')
        }

        const eventsRes = await authedFetch(`/api/google-calendar/events?${params.toString()}`, {
          cache: 'no-store',
        })
        const eventsPayload = await eventsRes.json().catch(() => null)

        if (!eventsRes.ok) {
          nextCalendarError = eventsPayload?.error ?? 'Unable to load calendar events.'
        } else {
          const events = (eventsPayload?.events ?? []) as CalendarEvent[]
          nextCalendarTodayEvents = events
            .filter((event) => eventOccursToday(event, now))
            .sort((a, b) => eventSortValue(a) - eventSortValue(b))
            .slice(0, 8)
        }
      }

      if (!notesDashboardRes.ok) {
        nextNotesError = notesDashboardPayload?.error ?? 'Unable to load notes reminders.'
      } else {
        const typed = notesDashboardPayload as NotesDashboardPayload
        const overdue = (typed.tasks?.overdue ?? []).map((task) => ({ kind: 'overdue' as const, task }))
        const dueToday = (typed.tasks?.due_today ?? []).map((task) => ({
          kind: 'due_today' as const,
          task,
        }))
        nextNotesReminders = sortNotesSignals([...overdue, ...dueToday]).slice(0, 8)
      }

      if (cancelled) return
      setCalendarConnected(nextCalendarConnected)
      setCalendarError(nextCalendarError)
      setCalendarTodayEvents(nextCalendarTodayEvents)
      setNotesError(nextNotesError)
      setNotesReminders(nextNotesReminders)
      setSignalsLoading(false)
    }

    void loadSignals()
    return () => {
      cancelled = true
    }
  }, [])

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return { customers: [], jobs: [] }

    const customerMatches = customers.filter((c) => {
      const hay = `${c.name ?? ''} ${c.email ?? ''} ${c.phone ?? ''} ${c.address ?? ''}`.toLowerCase()
      return hay.includes(q)
    })

    const jobMatches = jobs.filter((j) => {
      const hay = `${j.title ?? ''} ${j.customer_name ?? ''} ${j.customer_address ?? ''}`.toLowerCase()
      return hay.includes(q)
    })

    return {
      customers: customerMatches.slice(0, 5),
      jobs: jobMatches.slice(0, 5),
    }
  }, [customers, jobs, search])

  return (
    <div className="min-h-full bg-gradient-to-br from-gray-50 to-gray-200 py-4 md:py-6">
      <div className="mx-auto grid max-w-6xl gap-4 px-4 md:gap-5 md:px-6">
        <div className="crm-card grid gap-2 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-extrabold uppercase tracking-wide text-gray-500">
            <span className="inline-flex items-center gap-1.5">
              <LayoutDashboard size={iconSizeSm} aria-hidden="true" />
              <span>Dashboard</span>
            </span>
          </div>
          <h1 className="m-0 text-2xl font-extrabold text-gray-900 md:text-3xl">
            {greeting}, Austin
          </h1>
          <p className="text-sm text-gray-600 md:text-[15px]">
            Here&rsquo;s what&rsquo;s happening with your business today.
          </p>
          {counts && (
            <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Win rate"
                value={`${counts.winRate}%`}
                sub={`${counts.total} total decisions`}
                accentClass="border-l-green-500"
                Icon={TrendingUp}
                emptyHint={counts.total === 0 ? 'No estimates yet - create your first estimate' : null}
              />
              <StatCard
                title="Average ticket"
                value={counts.avgTicket == null ? '-' : formatCurrency(counts.avgTicket)}
                sub="Completed jobs with estimate total"
                accentClass="border-l-blue-500"
                Icon={DollarSign}
                emptyHint={counts.avgTicket == null || counts.avgTicket <= 0 ? 'No paid jobs yet - add your first win' : null}
              />
              <StatCard
                title="Estimates won"
                value={String(counts.won)}
                sub="Completed jobs"
                accentClass="border-l-green-500"
                Icon={Trophy}
                emptyHint={counts.won === 0 ? 'No wins yet - close your first estimate' : null}
              />
              <StatCard
                title="Estimates lost"
                value={String(counts.lost)}
                sub="Marked lost"
                accentClass="border-l-red-500"
                Icon={CircleX}
                emptyHint={counts.lost === 0 ? 'No losses logged - keep momentum going' : null}
              />
            </div>
          )}
        </div>

        <div className="crm-card grid gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-extrabold uppercase tracking-wide text-gray-500">
            {iconLabel(Search, 'Global search')}
          </div>
          <input
            aria-label="Search customers or jobs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers or jobs..."
            className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none ring-black/70 transition placeholder:text-gray-400 focus:ring-2"
          />
          {search.trim() === '' && (
            <div className="text-xs text-gray-500">Type to search across customers and jobs.</div>
          )}

          {search.trim() !== '' && (
            <div className="grid gap-3">
              <div>
                <div className="text-xs font-extrabold uppercase tracking-wide text-gray-500">
                  {iconLabel(Users, 'Customers')}
                </div>
                {searchResults.customers.length === 0 && (
                  <div className="text-sm text-gray-500">No customer matches.</div>
                )}
                {searchResults.customers.map((c) => (
                  <Link
                    key={c.id}
                    href={`/crm/customers/${c.id}`}
                    className="mt-1.5 block rounded-xl border border-gray-200 p-2.5 text-gray-900 transition hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/70"
                    aria-label={`Open customer ${c.name ?? c.id}`}
                  >
                    <div className="font-bold">{c.name}</div>
                    {(c.email || c.phone) && (
                      <div className="text-xs text-gray-500">
                        {[c.email, c.phone].filter(Boolean).join(' | ')}
                      </div>
                    )}
                  </Link>
                ))}
              </div>

              <div>
                <div className="text-xs font-extrabold uppercase tracking-wide text-gray-500">
                  {iconLabel(Wrench, 'Jobs')}
                </div>
                {searchResults.jobs.length === 0 && (
                  <div className="text-sm text-gray-500">No job matches.</div>
                )}
                {searchResults.jobs.map((j) => (
                  <Link
                    key={j.id}
                    href={`/crm/jobs/${j.id}`}
                    className="mt-1.5 block rounded-xl border border-gray-200 p-2.5 text-gray-900 transition hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/70"
                    aria-label={`Open job ${j.title ?? j.id}`}
                  >
                    <div className="font-bold">{j.title ?? 'Untitled job'}</div>
                    {(j.customer_name || j.customer_address) && (
                      <div className="text-xs text-gray-500">
                        {[j.customer_name, j.customer_address].filter(Boolean).join(' | ')}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            href="/crm/customers"
            title="Customers"
            sub="Profiles, contact info, and history."
            Icon={Users}
            iconShellClass="border border-gray-300 bg-white text-black"
            highlight
          />
          <FeatureCard
            href="/crm/jobs"
            title="Job Center"
            sub="Estimates, scheduling, and completion tracking."
            Icon={Wrench}
            iconShellClass="border border-gray-300 bg-white text-black"
          />
          <FeatureCard
            href="/crm/calendar"
            title="Calendar"
            sub="Google Calendar view and event management."
            Icon={CalendarCheck}
            iconShellClass="border border-gray-300 bg-white text-black"
          />
          <FeatureCard
            href="/crm/settings"
            title="Settings"
            sub="Templates, integrations, and CRM configuration."
            Icon={Settings}
            iconShellClass="border border-gray-300 bg-white text-black"
          />
        </div>

        <div className="crm-card flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="font-extrabold text-gray-900">{iconLabel(Plus, 'Quick actions', iconSizeMd)}</div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/crm/customers/new"
              aria-label="Create new customer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-black px-3 py-2 text-sm font-extrabold text-white transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-black/80"
            >
              <Plus size={iconSizeSm} aria-hidden="true" />
              <span>New customer</span>
            </Link>
            <Link
              href="/crm/jobs/new"
              aria-label="Create new job"
              className="inline-flex items-center gap-1.5 rounded-xl bg-black px-3 py-2 text-sm font-extrabold text-white transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-black/80"
            >
              <Plus size={iconSizeSm} aria-hidden="true" />
              <span>New job</span>
            </Link>
            <Link
              href="/crm/calendar"
              aria-label="Open calendar"
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-extrabold text-gray-900 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/80"
            >
              <CalendarCheck size={iconSizeSm} aria-hidden="true" />
              <span>Open calendar</span>
            </Link>
          </div>
        </div>

        <div className="crm-card grid gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wide text-gray-500">
                {iconLabel(Link2, 'Today Signals')}
              </div>
              <h2 className="mt-1 text-lg font-extrabold text-gray-900">Do I Have Anything Today?</h2>
              <p className="mt-1 text-sm text-gray-600">Calendar today + notes reminders in one quick scan.</p>
            </div>
          </div>

          {signalsLoading && (
            <div className="text-sm text-gray-500">Loading today signals...</div>
          )}

          {!signalsLoading && (
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-1.5 text-sm font-extrabold text-gray-900">
                    <CalendarCheck size={16} aria-hidden="true" />
                    <span>Calendar Today</span>
                  </div>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-extrabold text-gray-700">
                    {calendarConnected ? calendarTodayEvents.length : 0}
                  </span>
                </div>

                {calendarConnected === false ? (
                  <div className="grid gap-2">
                    <div className="text-sm text-gray-600">Google Calendar is not connected.</div>
                    <Link
                      href="/crm/calendar"
                      className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-black px-3 py-1.5 text-xs font-extrabold text-white"
                    >
                      <CalendarCheck size={14} aria-hidden="true" />
                      <span>Connect Google</span>
                    </Link>
                  </div>
                ) : calendarError ? (
                  <div className="grid gap-2">
                    <div className="text-sm text-red-700">{calendarError}</div>
                    <Link href="/crm/calendar" className="text-xs font-bold text-gray-700 underline">
                      Open calendar
                    </Link>
                  </div>
                ) : calendarTodayEvents.length === 0 ? (
                  <div className="text-sm text-gray-500">No calendar items today.</div>
                ) : (
                  <div className="grid gap-2">
                    {calendarTodayEvents.map((event) => (
                      <div key={`${event.calendarId}:${event.id}`} className="rounded-lg border border-gray-200 p-2">
                        <div className="text-sm font-bold text-gray-900">{event.summary ?? '(No title)'}</div>
                        <div className="text-xs text-gray-600">{formatEventWindow(event.start, event.end)}</div>
                        {event.htmlLink && (
                          <a
                            href={event.htmlLink}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-flex text-xs font-bold text-gray-700 underline"
                          >
                            Open event
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-1.5 text-sm font-extrabold text-gray-900">
                    <BellRing size={16} aria-hidden="true" />
                    <span>Notes Reminders</span>
                  </div>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-extrabold text-gray-700">
                    {notesReminders.length}
                  </span>
                </div>

                {notesError ? (
                  <div className="grid gap-2">
                    <div className="text-sm text-red-700">{notesError}</div>
                    <Link href="/crm/notes" className="text-xs font-bold text-gray-700 underline">
                      Open notes
                    </Link>
                  </div>
                ) : notesReminders.length === 0 ? (
                  <div className="text-sm text-gray-500">No notes reminders today.</div>
                ) : (
                  <div className="grid gap-2">
                    {notesReminders.map((signal) => (
                      <Link
                        key={`${signal.kind}:${signal.task.id}`}
                        href={`/crm/notes/tasks?focus=${encodeURIComponent(signal.task.id)}`}
                        className="rounded-lg border border-gray-200 p-2 hover:bg-gray-50"
                      >
                        <div className="text-sm font-bold text-gray-900">{signal.task.title}</div>
                        <div className="text-xs text-gray-600">
                          {signal.kind === 'overdue' ? 'Overdue' : 'Due today'} |{' '}
                          {formatTaskDue(
                            signal.task.due_at,
                            signal.task.is_all_day,
                            signal.task.has_due_time
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Link
              href="/crm/calendar"
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-extrabold text-gray-900 transition hover:bg-gray-50"
            >
              <CalendarCheck size={14} aria-hidden="true" />
              <span>Open calendar</span>
            </Link>
            <Link
              href="/crm/notes"
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-extrabold text-gray-900 transition hover:bg-gray-50"
            >
              <NotebookText size={14} aria-hidden="true" />
              <span>Open notes</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard(props: {
  title: string
  value: string
  sub: string
  accentClass: string
  Icon: LucideIcon
  emptyHint: string | null
}) {
  const { title, value, sub, accentClass, Icon, emptyHint } = props
  return (
    <div
      className={`rounded-2xl border border-gray-200 border-l-4 bg-white p-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${accentClass}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-extrabold uppercase tracking-wide text-gray-500">{title}</div>
        <Icon size={16} className="text-gray-400" aria-hidden="true" />
      </div>
      <div className="mt-1.5 text-2xl font-extrabold text-gray-900">{value}</div>
      <div className="mt-1 text-xs text-gray-500">{sub}</div>
      {emptyHint && (
        <Link
          href="/crm/jobs/new"
          className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-gray-700 underline-offset-2 hover:text-black hover:underline focus:outline-none focus:ring-2 focus:ring-black/70"
          aria-label={emptyHint}
        >
          <span>{emptyHint}</span>
          <ArrowRight size={12} aria-hidden="true" />
        </Link>
      )}
    </div>
  )
}

function FeatureCard(props: {
  href: string
  title: string
  sub: string
  Icon: LucideIcon
  iconShellClass: string
  highlight?: boolean
}) {
  const { href, title, sub, Icon, iconShellClass, highlight } = props
  return (
    <Link
      href={href}
      className={`block rounded-2xl border bg-white p-4 text-gray-900 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-black/70 ${
        highlight ? 'border-black' : 'border-gray-200'
      }`}
      aria-label={`Open ${title}`}
    >
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
        <span
          className={`inline-flex h-8 w-8 items-center justify-center rounded-md ${iconShellClass}`}
        >
          <Icon size={18} aria-hidden="true" />
        </span>
      </div>
      <div className="mt-2.5 text-base font-extrabold">{title}</div>
      <div className="mt-1 text-sm leading-5 text-gray-600">{sub}</div>
    </Link>
  )
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatTaskDue(iso: string | null, allDay: boolean, hasDueTime: boolean) {
  if (!iso) return 'No due date'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  if (allDay || !hasDueTime) return date.toLocaleDateString()
  return date.toLocaleString()
}
