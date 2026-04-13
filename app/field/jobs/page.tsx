'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, BriefcaseBusiness, Search } from 'lucide-react'
import { authedFetch } from '@/lib/auth/authedFetch'

type JobRow = {
  id: string
  title: string
  customer_name: string | null
  customer_address: string | null
  status: string | null
  scheduled_date?: string | null
  has_site_photos?: boolean | null
}

const stageOrder: Record<string, number> = {
  estimate_scheduled: 0,
  estimate_sent: 1,
  follow_up: 2,
  scheduled: 3,
  completed: 4,
  lost: 5,
}

function normalizeStatus(status: string | null | undefined) {
  return (status ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, '_')
    .replace(/_+/g, '_')
}

function isArchivedStatus(status: string | null | undefined) {
  const normalized = normalizeStatus(status)
  return normalized === 'completed' || normalized === 'lost'
}

function sortByStageThenSchedule(a: JobRow, b: JobRow) {
  const aRank = stageOrder[normalizeStatus(a.status)] ?? Number.MAX_SAFE_INTEGER
  const bRank = stageOrder[normalizeStatus(b.status)] ?? Number.MAX_SAFE_INTEGER
  if (aRank !== bRank) return aRank - bRank

  const aDate = a.scheduled_date ? Date.parse(a.scheduled_date) : Number.POSITIVE_INFINITY
  const bDate = b.scheduled_date ? Date.parse(b.scheduled_date) : Number.POSITIVE_INFINITY
  if (!Number.isNaN(aDate) && !Number.isNaN(bDate) && aDate !== bDate) {
    return aDate - bDate
  }

  return a.title.localeCompare(b.title)
}

function matchesSearch(job: JobRow, query: string) {
  const haystack = `${job.title} ${job.customer_name ?? ''} ${job.customer_address ?? ''} ${job.id}`.toLowerCase()
  return haystack.includes(query)
}

function formatStatus(value: string | null | undefined) {
  const text = (value ?? '').replaceAll('_', ' ').trim()
  if (!text) return 'Unknown'
  return text.replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatDate(value: string | null | undefined) {
  if (!value) return null
  try {
    return new Date(value).toLocaleDateString()
  } catch {
    return value
  }
}

export default function FieldJobsPage() {
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      const res = await authedFetch('/api/jobs', { cache: 'no-store' })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        setJobs([])
        setError(payload?.error ?? res.statusText)
        setLoading(false)
        return
      }
      setJobs((payload?.jobs ?? []) as JobRow[])
      setLoading(false)
    }

    void load()
  }, [])

  const filteredJobs = useMemo(() => {
    const query = search.trim().toLowerCase()
    const activeJobs = jobs.filter((job) => !isArchivedStatus(job.status))
    const archivedWithPhotos = jobs.filter(
      (job) => isArchivedStatus(job.status) && Boolean(job.has_site_photos)
    )

    const visible = query
      ? [
          ...activeJobs.filter((job) => matchesSearch(job, query)),
          ...archivedWithPhotos.filter((job) => matchesSearch(job, query)),
        ]
      : activeJobs.slice()

    return visible.sort(sortByStageThenSchedule)
  }, [jobs, search])

  const activeCount = useMemo(
    () => jobs.filter((job) => !isArchivedStatus(job.status)).length,
    [jobs]
  )

  return (
    <div className="grid gap-3">
      <section className="rounded-[30px] border border-white/75 bg-white/92 p-4 shadow-[0_22px_50px_rgba(15,23,42,0.12)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
              Jobs
            </div>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
              Choose a job and start shooting.
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Camera stays open while you capture. Photos sync into that job.
            </p>
          </div>
          <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-3 py-2 text-center">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
              Active
            </div>
            <div className="text-2xl font-black text-slate-900">{activeCount}</div>
          </div>
        </div>

        <label className="mt-4 flex items-center gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
          <Search size={18} className="text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search job, customer, address, or ID"
            className="w-full border-0 bg-transparent text-sm text-slate-900 outline-none"
          />
        </label>
        <div className="mt-2 text-xs font-semibold text-slate-500">
          Completed/lost jobs stay hidden until searched, and only appear when they already have field photos.
        </div>
      </section>

      {error && (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-[28px] border border-white/75 bg-white/92 px-4 py-6 text-sm font-semibold text-slate-500 shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
          Loading jobs...
        </div>
      ) : (
        <section className="grid gap-3">
          {filteredJobs.length === 0 ? (
            <div className="rounded-[28px] border border-white/75 bg-white/92 px-4 py-8 text-center shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
              <div className="text-lg font-black text-slate-900">No jobs match that search.</div>
              <div className="mt-1 text-sm text-slate-500">Try the customer name, street, or part of the job title.</div>
            </div>
          ) : (
            filteredJobs.map((job) => (
              <Link
                key={job.id}
                href={`/field/jobs/${job.id}`}
                className="rounded-[28px] border border-white/75 bg-white/92 p-4 shadow-[0_20px_40px_rgba(15,23,42,0.12)] transition hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                      <BriefcaseBusiness size={12} />
                      <span>{formatStatus(job.status)}</span>
                    </div>
                    <div className="mt-3 text-xl font-black leading-tight text-slate-900">{job.title}</div>
                    <div className="mt-1 text-sm font-semibold text-slate-700">
                      {job.customer_name ?? 'No customer linked'}
                    </div>
                    {job.customer_address && (
                      <div className="mt-1 text-sm text-slate-500">{job.customer_address}</div>
                    )}
                    {job.scheduled_date && (
                      <div className="mt-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-600">
                        Scheduled {formatDate(job.scheduled_date)}
                      </div>
                    )}
                  </div>
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700">
                    <ArrowRight size={18} />
                  </div>
                </div>
              </Link>
            ))
          )}
        </section>
      )}
    </div>
  )
}
