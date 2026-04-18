'use client'

import { authedFetch } from '@/lib/auth/authedFetch'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  BellRing,
  CalendarCheck,
  NotebookText,
  Plus,
  Search,
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

  const salesTotal = useMemo(
    () =>
      jobs
        .filter((j) => j.status === 'completed')
        .reduce((sum, j) => {
          const n = Number(j.estimate_total_amount)
          return sum + (Number.isFinite(n) ? n : 0)
        }, 0),
    [jobs]
  )

  const pipelineTotal = useMemo(
    () =>
      jobs.reduce((sum, j) => {
        const n = Number(j.estimate_total_amount)
        return sum + (Number.isFinite(n) && n > 0 ? n : 0)
      }, 0),
    [jobs]
  )

  const openJobs = useMemo(
    () => jobs.filter((j) => j.status !== 'completed' && j.status !== 'lost'),
    [jobs]
  )

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div className="min-h-full py-5 md:py-7" style={{ background: 'var(--crm-bg)' }}>
      <div className="mx-auto grid max-w-6xl gap-4 px-4 md:gap-5 md:px-6">

        {/* Top bar: greeting + date + search */}
        <div
          className="crm-card flex flex-col gap-3 rounded-2xl border p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
          style={{ background: 'var(--crm-card)', borderColor: 'var(--crm-border)' }}
        >
          <div>
            <div
              className="text-[11px] font-extrabold uppercase tracking-widest"
              style={{ color: 'var(--crm-muted)' }}
            >
              {today}
            </div>
            <h1
              className="mt-0.5 text-xl font-extrabold md:text-2xl"
              style={{ color: 'var(--crm-text)' }}
            >
              {greeting}, Austin
            </h1>
          </div>
          <div className="relative w-full sm:w-72">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--crm-muted)' }}
              aria-hidden="true"
            />
            <input
              aria-label="Search customers or jobs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customers or jobs..."
              className="w-full rounded-xl border py-2.5 pl-8 pr-3 text-sm outline-none transition"
              style={{
                background: 'var(--crm-input)',
                borderColor: 'var(--crm-border)',
                color: 'var(--crm-text)',
              }}
            />
            {search.trim() !== '' && (
              <div
                className="absolute left-0 right-0 top-full z-20 mt-1.5 grid gap-2 rounded-xl border p-3 shadow-xl"
                style={{ background: 'var(--crm-card)', borderColor: 'var(--crm-border)' }}
              >
                {searchResults.customers.length > 0 && (
                  <div>
                    <div
                      className="mb-1 text-[10px] font-extrabold uppercase tracking-widest"
                      style={{ color: 'var(--crm-muted)' }}
                    >
                      Customers
                    </div>
                    {searchResults.customers.map((c) => (
                      <Link
                        key={c.id}
                        href={`/crm/customers/${c.id}`}
                        className="block rounded-lg px-2.5 py-2 text-sm transition"
                        style={{ color: 'var(--crm-text)' }}
                      >
                        <div className="font-semibold">{c.name}</div>
                        {(c.email || c.phone) && (
                          <div className="text-xs" style={{ color: 'var(--crm-muted)' }}>
                            {[c.email, c.phone].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
                {searchResults.jobs.length > 0 && (
                  <div>
                    <div
                      className="mb-1 text-[10px] font-extrabold uppercase tracking-widest"
                      style={{ color: 'var(--crm-muted)' }}
                    >
                      Jobs
                    </div>
                    {searchResults.jobs.map((j) => (
                      <Link
                        key={j.id}
                        href={`/crm/jobs/${j.id}`}
                        className="block rounded-lg px-2.5 py-2 text-sm transition"
                        style={{ color: 'var(--crm-text)' }}
                      >
                        <div className="font-semibold">{j.title ?? 'Untitled job'}</div>
                        {j.customer_name && (
                          <div className="text-xs" style={{ color: 'var(--crm-muted)' }}>
                            {j.customer_name}
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
                {searchResults.customers.length === 0 && searchResults.jobs.length === 0 && (
                  <div className="text-sm" style={{ color: 'var(--crm-muted)' }}>
                    No results.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sales hero row */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {/* Big sales card */}
          <div
            className="crm-card col-span-2 rounded-2xl border p-5 shadow-sm md:col-span-1 md:p-6"
            style={{ background: 'var(--crm-card)', borderColor: 'var(--crm-border)' }}
          >
            <div
              className="flex items-center justify-between"
            >
              <div
                className="text-[11px] font-extrabold uppercase tracking-widest"
                style={{ color: 'var(--crm-muted)' }}
              >
                Sales
              </div>
              <Link
                href="/crm/jobs"
                className="text-xs font-semibold underline-offset-2 hover:underline"
                style={{ color: 'var(--crm-muted)' }}
              >
                View
              </Link>
            </div>
            <div
              className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl"
              style={{ color: 'var(--crm-text)' }}
            >
              {formatCurrency(salesTotal)}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-4" style={{ borderColor: 'var(--crm-border)' }}>
              <div>
                <div className="text-xs" style={{ color: 'var(--crm-muted)' }}>
                  Estimates Won
                </div>
                <div className="mt-0.5 text-xl font-extrabold" style={{ color: 'var(--crm-text)' }}>
                  {counts?.won ?? '-'}
                </div>
              </div>
              <div>
                <div className="text-xs" style={{ color: 'var(--crm-muted)' }}>
                  Avg. Value
                </div>
                <div className="mt-0.5 text-xl font-extrabold" style={{ color: 'var(--crm-text)' }}>
                  {counts?.avgTicket != null ? formatCurrency(counts.avgTicket) : '-'}
                </div>
              </div>
            </div>
          </div>

          {/* Win Rate donut */}
          <div
            className="crm-card flex flex-col items-center justify-center gap-3 rounded-2xl border p-6 shadow-sm"
            style={{ background: 'var(--crm-card)', borderColor: 'var(--crm-border)' }}
          >
            <div
              className="text-[11px] font-extrabold uppercase tracking-widest"
              style={{ color: 'var(--crm-muted)' }}
            >
              Win Rate
            </div>
            <DonutRing pct={counts?.winRate ?? 0} label={`${counts?.winRate ?? 0}%`} />
            <div className="text-xs" style={{ color: 'var(--crm-muted)' }}>
              {counts?.total ?? 0} total decisions
            </div>
          </div>

          {/* Pipeline Value */}
          <div
            className="crm-card rounded-2xl border p-5 shadow-sm md:p-6"
            style={{ background: 'var(--crm-card)', borderColor: 'var(--crm-border)' }}
          >
            <div className="flex items-center justify-between">
              <div
                className="text-[11px] font-extrabold uppercase tracking-widest"
                style={{ color: 'var(--crm-muted)' }}
              >
                Pipeline
              </div>
              <Link
                href="/crm/jobs"
                className="text-xs font-semibold underline-offset-2 hover:underline"
                style={{ color: 'var(--crm-muted)' }}
              >
                View
              </Link>
            </div>
            <div
              className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl"
              style={{ color: 'var(--crm-text)' }}
            >
              {formatCurrency(pipelineTotal)}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-4" style={{ borderColor: 'var(--crm-border)' }}>
              <div>
                <div className="text-xs" style={{ color: 'var(--crm-muted)' }}>
                  Open Jobs
                </div>
                <div className="mt-0.5 text-xl font-extrabold" style={{ color: 'var(--crm-text)' }}>
                  {openJobs.length}
                </div>
              </div>
              <div>
                <div className="text-xs" style={{ color: 'var(--crm-muted)' }}>
                  Avg. Open Value
                </div>
                <div className="mt-0.5 text-xl font-extrabold" style={{ color: 'var(--crm-text)' }}>
                  {(() => {
                    const openWithVal = openJobs.filter((j) => {
                      const n = Number(j.estimate_total_amount)
                      return Number.isFinite(n) && n > 0
                    })
                    if (openWithVal.length === 0) return '-'
                    const avg = openWithVal.reduce((s, j) => s + Number(j.estimate_total_amount), 0) / openWithVal.length
                    return formatCurrency(avg)
                  })()}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Estimates metrics row */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {/* Total Estimates */}
          <div
            className="crm-card rounded-2xl border p-5 shadow-sm"
            style={{ background: 'var(--crm-card)', borderColor: 'var(--crm-border)' }}
          >
            <div className="flex items-center justify-between">
              <div
                className="text-[11px] font-extrabold uppercase tracking-widest"
                style={{ color: 'var(--crm-muted)' }}
              >
                Total Estimates
              </div>
              <Link
                href="/crm/jobs"
                className="text-xs font-semibold underline-offset-2 hover:underline"
                style={{ color: 'var(--crm-muted)' }}
              >
                View
              </Link>
            </div>
            <div className="mt-2 text-3xl font-extrabold" style={{ color: 'var(--crm-text)' }}>
              {jobs.length}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 border-t pt-3" style={{ borderColor: 'var(--crm-border)' }}>
              <div>
                <div className="text-xs" style={{ color: 'var(--crm-muted)' }}>Worth</div>
                <div className="mt-0.5 text-sm font-extrabold" style={{ color: 'var(--crm-text)' }}>
                  {formatCurrency(pipelineTotal)}
                </div>
              </div>
              <div>
                <div className="text-xs" style={{ color: 'var(--crm-muted)' }}>Avg. Value</div>
                <div className="mt-0.5 text-sm font-extrabold" style={{ color: 'var(--crm-text)' }}>
                  {counts?.avgTicket != null ? formatCurrency(counts.avgTicket) : '-'}
                </div>
              </div>
            </div>
          </div>

          {/* Open Estimates */}
          <div
            className="crm-card rounded-2xl border p-5 shadow-sm"
            style={{ background: 'var(--crm-card)', borderColor: 'var(--crm-border)' }}
          >
            <div className="flex items-center justify-between">
              <div
                className="text-[11px] font-extrabold uppercase tracking-widest"
                style={{ color: 'var(--crm-muted)' }}
              >
                Open Estimates
              </div>
              <Link
                href="/crm/jobs"
                className="text-xs font-semibold underline-offset-2 hover:underline"
                style={{ color: 'var(--crm-muted)' }}
              >
                View
              </Link>
            </div>
            <div className="mt-2 text-3xl font-extrabold" style={{ color: 'var(--crm-text)' }}>
              {openJobs.length}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 border-t pt-3" style={{ borderColor: 'var(--crm-border)' }}>
              <div>
                <div className="text-xs" style={{ color: 'var(--crm-muted)' }}>Worth</div>
                <div className="mt-0.5 text-sm font-extrabold" style={{ color: 'var(--crm-text)' }}>
                  {formatCurrency(
                    openJobs.reduce((sum, j) => {
                      const n = Number(j.estimate_total_amount)
                      return sum + (Number.isFinite(n) && n > 0 ? n : 0)
                    }, 0)
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs" style={{ color: 'var(--crm-muted)' }}>Avg. Value</div>
                <div className="mt-0.5 text-sm font-extrabold" style={{ color: 'var(--crm-text)' }}>
                  {(() => {
                    const openWithVal = openJobs.filter((j) => {
                      const n = Number(j.estimate_total_amount)
                      return Number.isFinite(n) && n > 0
                    })
                    if (openWithVal.length === 0) return '-'
                    const avg =
                      openWithVal.reduce((s, j) => s + Number(j.estimate_total_amount), 0) /
                      openWithVal.length
                    return formatCurrency(avg)
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* Close Rate */}
          <div
            className="crm-card col-span-2 rounded-2xl border p-5 shadow-sm sm:col-span-1"
            style={{ background: 'var(--crm-card)', borderColor: 'var(--crm-border)' }}
          >
            <div
              className="text-[11px] font-extrabold uppercase tracking-widest"
              style={{ color: 'var(--crm-muted)' }}
            >
              Close Rate
            </div>
            <div className="mt-2 text-3xl font-extrabold" style={{ color: 'var(--crm-text)' }}>
              {counts?.winRate ?? 0}%
            </div>
            <div className="mt-3">
              <div
                className="h-5 overflow-hidden rounded-full"
                style={{ background: 'var(--crm-border)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${counts?.winRate ?? 0}%`,
                    background: 'var(--crm-accent)',
                  }}
                />
              </div>
              <div className="mt-2 text-xs" style={{ color: 'var(--crm-muted)' }}>
                {counts?.won ?? 0} won · {counts?.lost ?? 0} lost
              </div>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div
          className="crm-card flex flex-col gap-3 rounded-2xl border p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
          style={{ background: 'var(--crm-card)', borderColor: 'var(--crm-border)' }}
        >
          <div
            className="flex items-center gap-1.5 text-sm font-extrabold"
            style={{ color: 'var(--crm-text)' }}
          >
            <Plus size={15} aria-hidden="true" />
            Quick actions
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Link
              href="/crm/customers/new"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-extrabold transition-transform hover:scale-[1.02] sm:justify-start sm:py-2"
              style={{ background: 'var(--crm-accent)', color: 'var(--crm-accent-text)' }}
            >
              <Users size={13} aria-hidden="true" />
              New customer
            </Link>
            <Link
              href="/crm/jobs/new"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-extrabold transition-transform hover:scale-[1.02] sm:justify-start sm:py-2"
              style={{ background: 'var(--crm-accent)', color: 'var(--crm-accent-text)' }}
            >
              <Wrench size={13} aria-hidden="true" />
              New job
            </Link>
            <Link
              href="/crm/calendar"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition sm:justify-start sm:py-2"
              style={{
                borderColor: 'var(--crm-border)',
                background: 'var(--crm-button)',
                color: 'var(--crm-button-text)',
              }}
            >
              <CalendarCheck size={13} aria-hidden="true" />
              Calendar
            </Link>
            <Link
              href="/crm/customers"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition sm:justify-start sm:py-2"
              style={{
                borderColor: 'var(--crm-border)',
                background: 'var(--crm-button)',
                color: 'var(--crm-button-text)',
              }}
            >
              <Users size={13} aria-hidden="true" />
              Customers
            </Link>
          </div>
        </div>

        {/* Activity + Today Signals */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Activity feed */}
          <div
            className="crm-card rounded-2xl border shadow-sm"
            style={{ background: 'var(--crm-card)', borderColor: 'var(--crm-border)' }}
          >
            <div
              className="flex items-center gap-3 border-b px-5 pt-5 pb-3"
              style={{ borderColor: 'var(--crm-border)' }}
            >
              <button
                className="rounded-lg px-3 py-1.5 text-sm font-extrabold"
                style={{ background: 'var(--crm-accent)', color: 'var(--crm-accent-text)' }}
              >
                Activity
              </button>
              <Link
                href="/crm/notes/tasks"
                className="rounded-lg px-3 py-1.5 text-sm font-semibold transition"
                style={{ color: 'var(--crm-muted)' }}
              >
                Tasks
              </Link>
            </div>
            <div className="px-5 py-4">
              {jobs.length === 0 ? (
                <div className="py-8 text-center text-sm" style={{ color: 'var(--crm-muted)' }}>
                  No activity yet. Create your first job to get started.
                </div>
              ) : (
                <div className="grid gap-0">
                  {jobs.slice(0, 8).map((job, i) => (
                    <Link
                      key={job.id}
                      href={`/crm/jobs/${job.id}`}
                      className="group flex gap-3 py-3 transition"
                      style={{
                        borderBottom: i < Math.min(jobs.length, 8) - 1 ? `1px solid var(--crm-border)` : 'none',
                      }}
                    >
                      <div
                        className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-extrabold"
                        style={{
                          background: job.status === 'completed'
                            ? 'var(--crm-success-bg)'
                            : job.status === 'lost'
                              ? 'var(--crm-danger-bg)'
                              : 'var(--crm-border)',
                          color: job.status === 'completed'
                            ? 'var(--crm-success-text)'
                            : job.status === 'lost'
                              ? 'var(--crm-danger-text)'
                              : 'var(--crm-muted)',
                        }}
                      >
                        {job.status === 'completed' ? '✓' : job.status === 'lost' ? '✕' : '·'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div
                          className="truncate text-sm font-semibold"
                          style={{ color: 'var(--crm-text)' }}
                        >
                          {job.title ?? 'Untitled job'}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2">
                          <span className="text-xs" style={{ color: 'var(--crm-muted)' }}>
                            {job.customer_name ?? 'No customer'}
                          </span>
                          {job.estimate_total_amount != null &&
                            Number(job.estimate_total_amount) > 0 && (
                              <span
                                className="text-xs font-semibold"
                                style={{ color: 'var(--crm-text-soft)' }}
                              >
                                · {formatCurrency(Number(job.estimate_total_amount))}
                              </span>
                            )}
                        </div>
                      </div>
                      <div
                        className="flex-shrink-0 self-center text-xs font-semibold"
                        style={{ color: 'var(--crm-muted)' }}
                      >
                        {formatStatus(job.status)}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              {jobs.length > 8 && (
                <Link
                  href="/crm/jobs"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold underline-offset-2 hover:underline"
                  style={{ color: 'var(--crm-muted)' }}
                >
                  View all {jobs.length} jobs <ArrowRight size={11} />
                </Link>
              )}
            </div>
          </div>

          {/* Today Signals */}
          <div
            className="crm-card rounded-2xl border shadow-sm"
            style={{ background: 'var(--crm-card)', borderColor: 'var(--crm-border)' }}
          >
            <div
              className="flex items-center gap-3 border-b px-5 pt-5 pb-3"
              style={{ borderColor: 'var(--crm-border)' }}
            >
              <button
                className="rounded-lg px-3 py-1.5 text-sm font-extrabold"
                style={{ background: 'var(--crm-accent)', color: 'var(--crm-accent-text)' }}
              >
                Calendar
              </button>
              <button
                className="rounded-lg px-3 py-1.5 text-sm font-semibold"
                style={{ color: 'var(--crm-muted)' }}
              >
                Reminders
              </button>
            </div>

            <div className="px-5 py-4">
              {signalsLoading ? (
                <div className="py-8 text-center text-sm" style={{ color: 'var(--crm-muted)' }}>
                  Loading...
                </div>
              ) : calendarConnected === false ? (
                <div className="grid gap-2 py-4">
                  <div className="text-sm" style={{ color: 'var(--crm-muted)' }}>
                    Google Calendar is not connected.
                  </div>
                  <Link
                    href="/crm/calendar"
                    className="inline-flex w-fit items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-extrabold"
                    style={{ background: 'var(--crm-accent)', color: 'var(--crm-accent-text)' }}
                  >
                    Connect Google
                  </Link>
                </div>
              ) : calendarError ? (
                <div className="py-4 text-sm" style={{ color: 'var(--crm-danger-text)' }}>
                  {calendarError}
                </div>
              ) : calendarTodayEvents.length === 0 ? (
                <div className="py-8 text-center text-sm" style={{ color: 'var(--crm-muted)' }}>
                  No calendar items today.
                </div>
              ) : (
                <div className="grid gap-0">
                  {calendarTodayEvents.map((event, i) => (
                    <div
                      key={`${event.calendarId}:${event.id}`}
                      className="py-3"
                      style={{
                        borderBottom:
                          i < calendarTodayEvents.length - 1
                            ? `1px solid var(--crm-border)`
                            : 'none',
                      }}
                    >
                      <div
                        className="text-sm font-semibold"
                        style={{ color: 'var(--crm-text)' }}
                      >
                        {event.summary ?? '(No title)'}
                      </div>
                      <div className="mt-0.5 text-xs" style={{ color: 'var(--crm-muted)' }}>
                        {formatEventWindow(event.start, event.end)}
                      </div>
                      {event.htmlLink && (
                        <a
                          href={event.htmlLink}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex text-xs font-semibold underline-offset-2 hover:underline"
                          style={{ color: 'var(--crm-muted)' }}
                        >
                          Open event
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Notes reminders */}
              {!signalsLoading && notesReminders.length > 0 && (
                <div
                  className="mt-4 border-t pt-4"
                  style={{ borderColor: 'var(--crm-border)' }}
                >
                  <div
                    className="mb-2 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-widest"
                    style={{ color: 'var(--crm-muted)' }}
                  >
                    <BellRing size={12} aria-hidden="true" />
                    Reminders
                    <span
                      className="ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-extrabold"
                      style={{ background: 'var(--crm-border)', color: 'var(--crm-muted)' }}
                    >
                      {notesReminders.length}
                    </span>
                  </div>
                  <div className="grid gap-2">
                    {notesReminders.slice(0, 4).map((signal) => (
                      <Link
                        key={`${signal.kind}:${signal.task.id}`}
                        href={`/crm/notes/tasks?focus=${encodeURIComponent(signal.task.id)}`}
                        className="flex items-start gap-2 rounded-lg border p-2.5 transition"
                        style={{
                          borderColor:
                            signal.kind === 'overdue'
                              ? 'var(--crm-danger-border)'
                              : 'var(--crm-border)',
                          background:
                            signal.kind === 'overdue'
                              ? 'var(--crm-danger-bg)'
                              : 'transparent',
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <div
                            className="truncate text-sm font-semibold"
                            style={{ color: 'var(--crm-text)' }}
                          >
                            {signal.task.title}
                          </div>
                          <div
                            className="text-xs"
                            style={{
                              color:
                                signal.kind === 'overdue'
                                  ? 'var(--crm-danger-text)'
                                  : 'var(--crm-muted)',
                            }}
                          >
                            {signal.kind === 'overdue' ? 'Overdue' : 'Due today'} ·{' '}
                            {formatTaskDue(
                              signal.task.due_at,
                              signal.task.is_all_day,
                              signal.task.has_due_time
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div
              className="flex gap-2 border-t px-5 py-3"
              style={{ borderColor: 'var(--crm-border)' }}
            >
              <Link
                href="/crm/calendar"
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition"
                style={{
                  borderColor: 'var(--crm-border)',
                  background: 'var(--crm-button)',
                  color: 'var(--crm-button-text)',
                }}
              >
                <CalendarCheck size={13} aria-hidden="true" />
                Calendar
              </Link>
              <Link
                href="/crm/notes"
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition"
                style={{
                  borderColor: 'var(--crm-border)',
                  background: 'var(--crm-button)',
                  color: 'var(--crm-button-text)',
                }}
              >
                <NotebookText size={13} aria-hidden="true" />
                Notes
              </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

function DonutRing({ pct, label }: { pct: number; label: string }) {
  const size = 100
  const r = 36
  const c = 2 * Math.PI * r
  const filled = Math.min(100, Math.max(0, pct))
  const dash = (filled / 100) * c
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={50} cy={50} r={r}
          fill="none"
          stroke="var(--crm-border)"
          strokeWidth={10}
        />
        <circle
          cx={50} cy={50} r={r}
          fill="none"
          stroke="var(--crm-accent)"
          strokeWidth={10}
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
      </svg>
      <span
        className="absolute text-base font-extrabold"
        style={{ color: 'var(--crm-text)' }}
      >
        {label}
      </span>
    </div>
  )
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatStatus(status: string | null) {
  const map: Record<string, string> = {
    estimate_sent: 'Estimate Sent',
    estimate_scheduled: 'Scheduled',
    follow_up: 'Follow Up',
    completed: 'Won',
    lost: 'Lost',
    new: 'New',
    in_progress: 'In Progress',
  }
  if (!status) return 'Open'
  return map[status] ?? status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatTaskDue(iso: string | null, allDay: boolean, hasDueTime: boolean) {
  if (!iso) return 'No due date'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  if (allDay || !hasDueTime) return date.toLocaleDateString()
  return date.toLocaleString()
}
