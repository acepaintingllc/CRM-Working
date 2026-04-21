'use client'

import { authedFetch } from '@/lib/auth/authedFetch'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Briefcase, Filter, Plus } from 'lucide-react'

type JobRow = {
  id: string
  title: string
  customer_id: string
  customer_name: string | null
  status: string
}

export default function NewEstimatePage() {
  const router = useRouter()
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [jobId, setJobId] = useState('')
  const [jobSearch, setJobSearch] = useState('')
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoadingJobs(true)
      try {
        const res = await authedFetch('/api/jobs', { cache: 'no-store' })
        const payload = await res.json().catch(() => null)
        if (!res.ok) {
          setError(payload?.error ?? res.statusText)
          return
        }
        const allJobs = (payload?.jobs ?? []) as JobRow[]
        setJobs(allJobs.filter((job) => job.customer_id))
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load jobs')
      } finally {
        setLoadingJobs(false)
      }
    }
    void load()
  }, [])

  const filteredJobs = useMemo(() => {
    const q = jobSearch.trim().toLowerCase()
    if (!q) return jobs
    return jobs.filter((job) => {
      const haystack = `${job.title} ${job.customer_name ?? ''} ${job.customer_id}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [jobs, jobSearch])

  const selectedJob = useMemo(() => jobs.find((job) => job.id === jobId) ?? null, [jobs, jobId])
  const fieldLabelClass = 'text-[11px] font-black uppercase tracking-[0.08em] text-slate-600'
  const controlClass =
    'h-12 w-full rounded-xl border border-slate-300/90 bg-white px-3.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-900/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500'

  const createEstimate = async () => {
    if (!jobId || !selectedJob) {
      setError('Select a job')
      return
    }
    setSaving(true)
    setError(null)
    const res = await authedFetch('/api/estimates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: selectedJob.id,
        customer_id: selectedJob.customer_id,
      }),
    })
    const payload = await res.json().catch(() => null)
    setSaving(false)
    if (!res.ok) {
      setError(payload?.error ?? res.statusText)
      return
    }
    router.push(`/crm/estimates/${payload.id}`)
  }

  return (
    <div className="crm-page mx-auto max-w-[820px]">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4 shadow-sm sm:p-6">
        <div className="crm-topbar mb-4 flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-600">
              Estimate Setup
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">New estimate</h1>
            <div className="max-w-[56ch] text-sm text-slate-600">
              Create a DB-backed estimate and link it to this job in one step.
            </div>
          </div>
          <Link
            href="/crm/estimates"
            className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Back</span>
          </Link>
        </div>

        <div className="mb-4 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.08em] text-slate-500">
              <Briefcase size={14} aria-hidden="true" />
              <span>Eligible Jobs</span>
            </div>
            <div className="text-xl font-black text-slate-900">{jobs.length}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.08em] text-slate-500">
              <Filter size={14} aria-hidden="true" />
              <span>Filtered Results</span>
            </div>
            <div className="text-xl font-black text-slate-900">{filteredJobs.length}</div>
          </div>
        </div>

        <div className="crm-card rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="grid gap-4">
            <label className="grid gap-1.5">
              <div className={fieldLabelClass}>Search Jobs</div>
              <input
                value={jobSearch}
                onChange={(e) => setJobSearch(e.target.value)}
                placeholder="Search by job title, customer, or ID"
                className={controlClass}
              />
            </label>

            <label className="grid gap-1.5">
              <div className={fieldLabelClass}>Job</div>
              <select
                value={jobId}
                onChange={(e) => {
                  setJobId(e.target.value)
                  setError(null)
                }}
                disabled={loadingJobs || saving}
                className={controlClass}
              >
                <option value="">{loadingJobs ? 'Loading jobs...' : 'Select a job'}</option>
                {filteredJobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title} - {job.customer_name ?? job.customer_id}
                  </option>
                ))}
              </select>
            </label>

            {!loadingJobs && jobs.length === 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                No jobs with a customer are available yet. Add a customer to a job first, then create the estimate.
              </div>
            )}

            {!loadingJobs && jobs.length > 0 && filteredJobs.length === 0 && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                No jobs match your search.
              </div>
            )}

            {selectedJob && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                Customer: <span className="font-black">{selectedJob.customer_name ?? selectedJob.customer_id}</span>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">
                {error}
              </div>
            )}

            <button
              onClick={() => void createEstimate()}
              disabled={saving || loadingJobs || !selectedJob}
              className="inline-flex h-12 items-center justify-center gap-1.5 rounded-xl border border-slate-900 bg-slate-900 px-5 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                'Creating...'
              ) : (
                <>
                  <Plus size={16} aria-hidden="true" />
                  <span>Create estimate</span>
                </>
              )}
            </button>
          </div>
          {loadingJobs && (
            <div className="mt-3 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">
              Syncing jobs...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
