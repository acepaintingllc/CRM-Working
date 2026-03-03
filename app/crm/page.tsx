'use client'

import { authedFetch } from '@/lib/auth/authedFetch'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowRight,
  CalendarCheck,
  CircleX,
  DollarSign,
  LayoutDashboard,
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
            {greeting}, Austin <span aria-hidden="true">👋</span>
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
