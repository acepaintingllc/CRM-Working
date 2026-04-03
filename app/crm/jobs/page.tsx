'use client'

import { authedFetch } from '@/lib/auth/authedFetch'
import StageEmailModal, {
  stageEmailActionLabel,
  type StageEmailStage,
  type StageEmailSentResult,
} from '@/app/crm/jobs/_components/StageEmailModal'
import JobCompletionCloseoutModal from '@/app/crm/jobs/_components/JobCompletionCloseoutModal'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import {
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Mail,
  Plus,
  RefreshCw,
  Send,
  XCircle,
} from 'lucide-react'

type JobStatus =
  | 'estimate_scheduled'
  | 'estimate_sent'
  | 'follow_up'
  | 'scheduled'
  | 'completed'
  | 'lost'

type Job = {
  id: string
  customer_id: string
  customer_name: string | null
  customer_address: string | null
  title: string
  description: string | null
  status: JobStatus
  created_at?: string | null
  estimate_date: string | null
  estimate_sent_at: string | null
  scheduled_date: string | null
  scheduled_end_date?: string | null
  scheduled_email_sent_at?: string | null
  completed_at: string | null
  completed_email_sent_at?: string | null
  closeout_notes?: string | null
}

const columns: { key: JobStatus; title: string }[] = [
  { key: 'estimate_scheduled', title: 'Estimate scheduled' },
  { key: 'estimate_sent', title: 'Estimate sent' },
  { key: 'follow_up', title: 'Follow up' },
  { key: 'scheduled', title: 'Scheduled' },
  { key: 'completed', title: 'Completed' },
  { key: 'lost', title: 'Lost' },
]

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

export default function JobsPage() {
  const router = useRouter()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [completedQuery, setCompletedQuery] = useState('')
  const [showAllCompleted, setShowAllCompleted] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const [showLost, setShowLost] = useState(false)
  const [showEmptyStages, setShowEmptyStages] = useState(false)
  const [compactActions, setCompactActions] = useState(false)
  const [emailJobId, setEmailJobId] = useState<string | null>(null)
  const [emailStage, setEmailStage] = useState<StageEmailStage | null>(null)
  const [closeoutJobId, setCloseoutJobId] = useState<string | null>(null)

  const grouped = useMemo(() => {
    const map: Record<JobStatus, Job[]> = {
      estimate_scheduled: [],
      estimate_sent: [],
      follow_up: [],
      scheduled: [],
      completed: [],
      lost: [],
    }
    for (const j of jobs) map[j.status]?.push(j)
    return map
  }, [jobs])

  const load = async () => {
    setLoading(true)
    setError(null)

    const res = await authedFetch('/api/jobs', { cache: 'no-store' })
    const payload = await res.json().catch(() => null)
    if (!res.ok) {
      setError(payload?.error ?? res.statusText)
      setJobs([])
      setLoading(false)
      return
    }

    setJobs(payload?.jobs ?? [])
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)')
    const apply = () => setCompactActions(media.matches)
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [])

  const patchJob = async (id: string, patch: Record<string, unknown>) => {
    const res = await authedFetch(`/api/jobs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const payload = await res.json().catch(() => null)
    if (!res.ok) {
      setError(payload?.error ?? res.statusText)
      return null
    }

    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...payload.job } : j)))
    return (payload?.job ?? null) as Partial<Job> | null
  }

  const nowIso = () => new Date().toISOString()

  const formatDate = (iso: string | null) => {
    if (!iso) return null
    try {
      return new Date(iso).toLocaleString()
    } catch {
      return iso
    }
  }

  const formatRange = (start: string | null | undefined, end: string | null | undefined) => {
    if (start && end) return `${formatDate(start)} - ${formatDate(end)}`
    if (start) return formatDate(start)
    if (end) return formatDate(end)
    return null
  }

  const activityForJob = (job: Job) => {
    const items: { label: string; at: string }[] = []
    if (job.completed_email_sent_at) items.push({ label: 'Review email sent', at: job.completed_email_sent_at })
    if (job.completed_at) items.push({ label: 'Completed', at: job.completed_at })
    if (job.scheduled_email_sent_at) items.push({ label: 'Confirmation email sent', at: job.scheduled_email_sent_at })
    if (job.scheduled_date) items.push({ label: 'Scheduled', at: job.scheduled_date })
    if (job.estimate_sent_at) items.push({ label: 'Estimate sent', at: job.estimate_sent_at })
    if (job.estimate_date) items.push({ label: 'Estimate set', at: job.estimate_date })
    if (job.created_at) items.push({ label: 'Job created', at: job.created_at })
    items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    return items.slice(0, 2)
  }

  const filteredCompleted = useMemo(() => {
    const q = completedQuery.trim().toLowerCase()
    let list = grouped.completed
    if (q) {
      list = list.filter((job) => {
        const address = (job.customer_address ?? '')
        const streetOnly = address.split(',')[0] ?? address
        const hay = `${job.title} ${job.customer_name ?? ''} ${address} ${streetOnly} ${job.description ?? ''}`.toLowerCase()
        return hay.includes(q)
      })
    }
    list = [...list].sort((a, b) => {
      const aTime = a.completed_at ? new Date(a.completed_at).getTime() : 0
      const bTime = b.completed_at ? new Date(b.completed_at).getTime() : 0
      return bTime - aTime
    })
    if (!showAllCompleted && !q) return list.slice(0, 5)
    return list
  }, [completedQuery, grouped.completed, showAllCompleted])

  const stop =
    (fn: () => void) =>
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      fn()
    }

  const openStageEmail = (jobId: string, stage: StageEmailStage) => {
    setError(null)
    setEmailJobId(jobId)
    setEmailStage(stage)
  }

  const closeStageEmail = () => {
    setEmailJobId(null)
    setEmailStage(null)
  }

  const handleStageEmailSent = (result: StageEmailSentResult) => {
    setError(null)
    if (emailJobId && result.job) {
      const patch = result.job as Partial<Job>
      setJobs((prev) => prev.map((job) => (job.id === emailJobId ? { ...job, ...patch } : job)))
    }
    setNotice(result.warning ?? 'Email sent')
  }

  const markCompletedAndPrompt = async (job: Job) => {
    const updated = await patchJob(job.id, { completed_at: nowIso() })
    if (updated) {
      setNotice(null)
      setCloseoutJobId(job.id)
    }
  }

  const openCloseout = (jobId: string) => {
    setError(null)
    setCloseoutJobId(jobId)
  }

  const closeCloseout = () => {
    setCloseoutJobId(null)
  }

  const handleCloseoutSaved = (result: { job?: Partial<Job> | null; notice?: string | null }) => {
    setError(null)
    if (closeoutJobId && result.job) {
      setJobs((prev) =>
        prev.map((job) => (job.id === closeoutJobId ? { ...job, ...result.job } : job))
      )
    }
    if (result.notice) setNotice(result.notice)
  }

  const columnCount = (status: JobStatus) => grouped[status].length
  const visibleColumns = columns
    .filter((col) => (col.key === 'completed' ? showCompleted : col.key === 'lost' ? showLost : true))
    .filter((col) => showEmptyStages || columnCount(col.key) > 0)

  return (
    <div className="min-h-full bg-gradient-to-br from-gray-50 to-gray-200 py-4 md:py-6">
      <div className="mx-auto max-w-[2000px] px-4 md:px-6">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="m-0 text-2xl font-bold text-gray-900">Jobs</h1>
            <div className="mt-1 text-sm text-gray-600">
              Track every job through your pipeline from estimate to completion.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowEmptyStages((prev) => !prev)}
            aria-label={showEmptyStages ? 'Hide empty stages' : 'Show empty stages'}
            className={`inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-black/70 ${
              showEmptyStages
                ? 'border-black bg-black text-white'
                : 'border-gray-300 bg-white text-gray-900 hover:bg-gray-50'
            }`}
          >
            {iconLabel(ChevronDown, showEmptyStages ? 'Hide empty stages' : 'Show empty stages', iconSizeMd)}
          </button>
          <button
            onClick={() => setShowCompleted((prev) => !prev)}
            aria-label={showCompleted ? 'Hide completed jobs' : 'Show completed jobs'}
            className={`inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-black/70 ${
              showCompleted
                ? 'border-black bg-black text-white'
                : 'border-gray-300 bg-white text-gray-900 hover:bg-gray-50'
            }`}
          >
            {iconLabel(CheckCircle2, showCompleted ? 'Hide completed' : 'Show completed', iconSizeMd)}
          </button>
          <button
            onClick={() => setShowLost((prev) => !prev)}
            aria-label={showLost ? 'Hide lost jobs' : 'Show lost jobs'}
            className={`inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-black/70 ${
              showLost
                ? 'border-black bg-black text-white'
                : 'border-gray-300 bg-white text-gray-900 hover:bg-gray-50'
            }`}
          >
            {iconLabel(XCircle, showLost ? 'Hide lost' : 'Show lost', iconSizeMd)}
          </button>
          <button
            onClick={() => void load()}
            aria-label="Refresh jobs"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/70"
          >
            {iconLabel(RefreshCw, 'Refresh', iconSizeMd)}
          </button>
          <Link
            href="/crm/jobs/new"
            aria-label="Add job"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-black bg-black px-3 text-sm font-semibold text-white no-underline transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-black/80"
          >
            {iconLabel(Plus, 'Add job', iconSizeMd)}
          </Link>
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded-xl border border-red-200 bg-white p-3 text-red-800 shadow-sm">
          {error}
        </div>
      )}

      {notice && (
        <div className="mt-3 rounded-xl border border-green-200 bg-white p-3 text-green-700 shadow-sm">
          {notice}
        </div>
      )}

      {loading ? (
        <div className="mt-3 text-gray-600">Loading...</div>
      ) : (
        <div className={`mt-3 pb-2 ${compactActions ? 'overflow-x-auto' : ''}`}>
          <div
            className={`grid gap-3 ${compactActions ? 'min-w-max' : ''}`}
            style={{
              gridTemplateColumns: compactActions
                ? `repeat(${Math.max(1, visibleColumns.length)}, minmax(200px, 1fr))`
                : `repeat(${Math.max(1, visibleColumns.length)}, minmax(0, 1fr))`,
            }}
          >
          {visibleColumns.map((col) => (
            <div key={col.key} className="rounded-2xl border border-gray-200 bg-white/90 p-2.5 shadow-sm backdrop-blur">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-extrabold text-gray-900">{col.title}</div>
                <div className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-gray-300 bg-white px-2 text-xs font-extrabold text-gray-700">
                  {columnCount(col.key)}
                </div>
              </div>
              <div className="grid gap-2">
                {col.key === 'completed' && (
                  <div className="grid gap-2">
                    <input
                      type="search"
                      placeholder="Search completed..."
                      value={completedQuery}
                      onChange={(e) => setCompletedQuery(e.target.value)}
                      className="h-9 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none ring-black/70 placeholder:text-gray-400 focus:ring-2"
                    />
                    {!completedQuery && grouped.completed.length > 5 && (
                      <button
                        onClick={() => setShowAllCompleted((prev) => !prev)}
                        style={{ ...smallButton, width: 'fit-content' }}
                      >
                        {showAllCompleted ? 'Show last 5' : 'Show all'}
                      </button>
                    )}
                  </div>
                )}
                {(col.key === 'completed' ? filteredCompleted : grouped[col.key]).length === 0 && (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-white p-3 text-sm text-gray-500">
                    <div className="font-semibold text-gray-700">No jobs in this stage</div>
                    <div className="mt-1 text-xs">
                      {col.key === 'estimate_scheduled'
                        ? 'New jobs will appear here after creation.'
                        : 'Jobs move here automatically as status changes.'}
                    </div>
                  </div>
                )}
                {(col.key === 'completed' ? filteredCompleted : grouped[col.key]).map((job) => (
                  <div
                    key={job.id}
                    onClick={() => router.push(`/crm/jobs/${job.id}`)}
                    className="cursor-pointer rounded-xl border border-gray-200 bg-white p-2.5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="text-base leading-tight font-extrabold text-gray-900 break-words">{job.title}</div>
                    <div className="mt-0.5 text-xs text-gray-500">
                      {job.customer_name ? job.customer_name : `Customer: ${job.customer_id}`}
                    </div>

                    {job.description && (
                      <div className="mt-1.5 text-xs text-gray-700">
                        {job.description}
                      </div>
                    )}

                    <div className="mt-1.5 text-xs leading-4.5 text-gray-500">
                      {job.status === 'scheduled' ? (
                        <>
                          {formatRange(job.scheduled_date, job.scheduled_end_date) && (
                            <div>Scheduled: {formatRange(job.scheduled_date, job.scheduled_end_date)}</div>
                          )}
                          {job.completed_at && <div>Completed: {formatDate(job.completed_at)}</div>}
                        </>
                      ) : (
                        <>
                          {job.estimate_date && <div>Estimate: {formatDate(job.estimate_date)}</div>}
                          {job.scheduled_date && <div>Scheduled: {formatDate(job.scheduled_date)}</div>}
                          {job.completed_at && <div>Completed: {formatDate(job.completed_at)}</div>}
                        </>
                      )}
                    </div>
                    {!compactActions && activityForJob(job).length > 0 && (
                      <div className="mt-2 grid gap-1 border-t border-dashed border-gray-200 pt-1.5 text-[11px] text-gray-500">
                        <div className="font-bold text-gray-700">Recent activity</div>
                        {activityForJob(job).map((item, idx) => (
                          <div key={`${job.id}-act-${idx}`}>
                            {item.label}: {formatDate(item.at)}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {job.status === 'estimate_scheduled' && (
                        <>
                          {compactActions ? (
                            <details onClick={(e) => e.stopPropagation()}>
                              <summary style={smallButton}>{iconLabel(ChevronDown, 'More')}</summary>
                              <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
                                <button
                                  onClick={stop(() => openStageEmail(job.id, 'estimate_sent'))}
                                  style={smallButton}
                                >
                                  {iconLabel(Send, 'Review & send estimate')}
                                </button>
                                <button
                                  onClick={stop(() => void patchJob(job.id, { estimate_sent_at: nowIso() }))}
                                  style={smallButton}
                                >
                                  {iconLabel(Send, 'Mark estimate sent')}
                                </button>
                                <Link
                                  href={`/crm/jobs/${job.id}/estimate`}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ ...smallButton, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                                >
                                  {iconLabel(CalendarClock, 'Set estimate date')}
                                </Link>
                              </div>
                            </details>
                          ) : (
                            <>
                              <button onClick={stop(() => openStageEmail(job.id, 'estimate_sent'))} style={smallButton}>
                                {iconLabel(Send, 'Review & send estimate')}
                              </button>
                              <button
                                onClick={stop(() => void patchJob(job.id, { estimate_sent_at: nowIso() }))}
                                style={smallButton}
                              >
                                {iconLabel(Send, 'Mark estimate sent')}
                              </button>
                              <Link
                                href={`/crm/jobs/${job.id}/estimate`}
                                onClick={(e) => e.stopPropagation()}
                                style={{ ...smallButton, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                              >
                                {iconLabel(CalendarClock, 'Set estimate date')}
                              </Link>
                            </>
                          )}
                        </>
                      )}

                      {job.status === 'estimate_sent' && (
                        <>
                          {compactActions ? (
                            <details onClick={(e) => e.stopPropagation()}>
                              <summary style={smallButton}>{iconLabel(ChevronDown, 'More')}</summary>
                              <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
                                <button
                                  onClick={stop(() => void patchJob(job.id, { status: 'follow_up' }))}
                                  style={smallButton}
                                >
                                  {iconLabel(Mail, 'Move to follow up')}
                                </button>
                                <Link
                                  href={`/crm/jobs/${job.id}/schedule`}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ ...smallButton, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                                >
                                  {iconLabel(CalendarCheck, 'Schedule job')}
                                </Link>
                                <button onClick={stop(() => openStageEmail(job.id, 'follow_up'))} style={smallButton}>
                                  {iconLabel(Mail, 'Send follow up')}
                                </button>
                                <button
                                  onClick={stop(() => {
                                    const ok = window.confirm('Mark this job as lost?')
                                    if (!ok) return
                                    void patchJob(job.id, { status: 'lost' })
                                  })}
                                  style={{ ...smallButton, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}
                                >
                                  {iconLabel(XCircle, 'Mark lost')}
                                </button>
                              </div>
                            </details>
                          ) : (
                            <>
                              <button
                                onClick={stop(() => void patchJob(job.id, { status: 'follow_up' }))}
                                style={smallButton}
                              >
                                {iconLabel(Mail, 'Move to follow up')}
                              </button>
                              <Link
                                href={`/crm/jobs/${job.id}/schedule`}
                                onClick={(e) => e.stopPropagation()}
                                style={{ ...smallButton, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                              >
                                {iconLabel(CalendarCheck, 'Schedule job')}
                              </Link>
                              <button onClick={stop(() => openStageEmail(job.id, 'follow_up'))} style={smallButton}>
                                {iconLabel(Mail, 'Send follow up')}
                              </button>
                              <button
                                onClick={stop(() => {
                                  const ok = window.confirm('Mark this job as lost?')
                                  if (!ok) return
                                  void patchJob(job.id, { status: 'lost' })
                                })}
                                style={{ ...smallButton, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}
                              >
                                {iconLabel(XCircle, 'Mark lost')}
                              </button>
                            </>
                          )}
                        </>
                      )}

                      {job.status === 'follow_up' && (
                        <>
                          {compactActions ? (
                            <details onClick={(e) => e.stopPropagation()}>
                              <summary style={smallButton}>{iconLabel(ChevronDown, 'More')}</summary>
                              <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
                                <Link
                                  href={`/crm/jobs/${job.id}/schedule`}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ ...smallButton, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                                >
                                  {iconLabel(CalendarCheck, 'Schedule job')}
                                </Link>
                                <button onClick={stop(() => openStageEmail(job.id, 'follow_up'))} style={smallButton}>
                                  {iconLabel(Mail, 'Send follow up')}
                                </button>
                                <button
                                  onClick={stop(() => {
                                    const ok = window.confirm('Mark this job as lost?')
                                    if (!ok) return
                                    void patchJob(job.id, { status: 'lost' })
                                  })}
                                  style={{ ...smallButton, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}
                                >
                                  {iconLabel(XCircle, 'Mark lost')}
                                </button>
                              </div>
                            </details>
                          ) : (
                            <>
                              <Link
                                href={`/crm/jobs/${job.id}/schedule`}
                                onClick={(e) => e.stopPropagation()}
                                style={{ ...smallButton, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                              >
                                {iconLabel(CalendarCheck, 'Schedule job')}
                              </Link>
                              <button onClick={stop(() => openStageEmail(job.id, 'follow_up'))} style={smallButton}>
                                {iconLabel(Mail, 'Send follow up')}
                              </button>
                              <button
                                onClick={stop(() => {
                                  const ok = window.confirm('Mark this job as lost?')
                                  if (!ok) return
                                  void patchJob(job.id, { status: 'lost' })
                                })}
                                style={{ ...smallButton, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}
                              >
                                {iconLabel(XCircle, 'Mark lost')}
                              </button>
                            </>
                          )}
                        </>
                      )}

                      {job.status === 'scheduled' && (
                        <>
                          {compactActions ? (
                            <details onClick={(e) => e.stopPropagation()}>
                              <summary style={smallButton}>{iconLabel(ChevronDown, 'More')}</summary>
                              <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
                                <button
                                  onClick={stop(() => openStageEmail(job.id, 'scheduled'))}
                                  style={
                                    job.scheduled_email_sent_at
                                      ? smallButton
                                      : { ...smallButton, background: '#111', border: '1px solid #111', color: '#fff' }
                                  }
                                >
                                  {iconLabel(
                                    Mail,
                                    stageEmailActionLabel('scheduled', Boolean(job.scheduled_email_sent_at))
                                  )}
                                </button>
                                <button
                                  onClick={stop(() => void markCompletedAndPrompt(job))}
                                  style={smallButton}
                                >
                                  {iconLabel(CheckCircle2, 'Mark completed')}
                                </button>
                                <Link
                                  href={`/crm/jobs/${job.id}/schedule`}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ ...smallButton, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                                >
                                  {iconLabel(CalendarCheck, 'Change scheduled date')}
                                </Link>
                              </div>
                            </details>
                          ) : (
                            <>
                              <button
                                onClick={stop(() => openStageEmail(job.id, 'scheduled'))}
                                style={
                                  job.scheduled_email_sent_at
                                    ? smallButton
                                    : { ...smallButton, background: '#111', border: '1px solid #111', color: '#fff' }
                                }
                              >
                                {iconLabel(
                                  Mail,
                                  stageEmailActionLabel('scheduled', Boolean(job.scheduled_email_sent_at))
                                )}
                              </button>
                              <button
                                onClick={stop(() => void markCompletedAndPrompt(job))}
                                style={smallButton}
                              >
                                {iconLabel(CheckCircle2, 'Mark completed')}
                              </button>
                              <Link
                                href={`/crm/jobs/${job.id}/schedule`}
                                onClick={(e) => e.stopPropagation()}
                                style={{ ...smallButton, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                              >
                                {iconLabel(CalendarCheck, 'Change scheduled date')}
                              </Link>
                            </>
                          )}
                        </>
                      )}

                      {job.status === 'completed' && (
                        <>
                          {compactActions ? (
                            <details onClick={(e) => e.stopPropagation()}>
                              <summary style={smallButton}>{iconLabel(ChevronDown, 'More')}</summary>
                              <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
                                <button
                                  onClick={stop(() => openCloseout(job.id))}
                                  style={
                                    job.completed_email_sent_at
                                      ? smallButton
                                      : { ...smallButton, background: '#111', border: '1px solid #111', color: '#fff' }
                                  }
                                >
                                  {iconLabel(Mail, 'Open closeout')}
                                </button>
                              </div>
                            </details>
                          ) : (
                            <button
                              onClick={stop(() => openCloseout(job.id))}
                              style={
                                job.completed_email_sent_at
                                  ? smallButton
                                  : { ...smallButton, background: '#111', border: '1px solid #111', color: '#fff' }
                              }
                            >
                              {iconLabel(Mail, 'Open closeout')}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          </div>
        </div>
      )}
      <StageEmailModal
        jobId={emailJobId}
        stage={emailStage}
        open={emailStage != null && emailJobId != null}
        onClose={closeStageEmail}
        onSent={handleStageEmailSent}
      />
      <JobCompletionCloseoutModal
        jobId={closeoutJobId}
        open={closeoutJobId != null}
        onClose={closeCloseout}
        onSaved={handleCloseoutSaved}
      />
      </div>
    </div>
  )
}

const smallButton: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 10,
  border: '1px solid #d1d5db',
  background: 'white',
  color: '#1f2937',
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
}
