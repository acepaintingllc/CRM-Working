'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { authedFetch } from '@/lib/auth/authedFetch'
import StageEmailModal, {
  stageEmailActionLabel,
  type StageEmailStage,
  type StageEmailSentResult,
} from '@/app/crm/jobs/_components/StageEmailModal'
import JobCompletionCloseoutModal, {
  type PaintLogRow,
} from '@/app/crm/jobs/_components/JobCompletionCloseoutModal'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronRight,
  Copy,
  FileText,
  Mail,
  MapPin,
  Send,
  Trash2,
  XCircle,
} from 'lucide-react'

type JobDetail = {
  id: string
  customer_id: string | null
  customer_name: string | null
  customer_address: string | null
  customer_email: string | null
  customer_phone: string | null
  title: string
  description: string | null
  status: string
  estimate_date: string | null
  estimate_sent_at: string | null
  scheduled_date: string | null
  scheduled_end_date: string | null
  scheduled_email_sent_at?: string | null
  completed_at: string | null
  completed_email_sent_at?: string | null
  created_at?: string | null
  linked_estimate_id?: string | null
  closeout_notes?: string | null
  linked_estimates?: Array<{
    id: string
    status: string | null
    sheet_file_path: string | null
    updated_at: string | null
    created_at: string | null
  }>
}

type JobPhoto = {
  id: string
  phase: 'before' | 'after'
  url: string
  caption: string | null
  created_at: string
}

type EstimateDriveFile = {
  id: string
  name: string
  version?: number
  matchMode?: 'exact' | 'normalized' | 'manual' | string
  webViewLink?: string | null
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

function asStageEmailStage(value: string | null): StageEmailStage | null {
  if (
    value === 'estimate_scheduled' ||
    value === 'estimate_sent' ||
    value === 'follow_up' ||
    value === 'scheduled' ||
    value === 'completed'
  ) {
    return value
  }
  return null
}

export default function JobDetailPage() {
  const params = useParams()
  const rawId = (params as { id?: string } | null | undefined)?.id
  const id = Array.isArray(rawId) ? rawId[0] : rawId
  const router = useRouter()
  const searchParams = useSearchParams()

  const [job, setJob] = useState<JobDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [emailStage, setEmailStage] = useState<StageEmailStage | null>(null)
  const [closeoutOpen, setCloseoutOpen] = useState(false)
  const [timelineOpen, setTimelineOpen] = useState(true)
  const [estimateFile, setEstimateFile] = useState<EstimateDriveFile | null>(null)
  const [estimateFileError, setEstimateFileError] = useState<string | null>(null)
  const [paintLogs, setPaintLogs] = useState<PaintLogRow[]>([])
  const [afterPhotos, setAfterPhotos] = useState<JobPhoto[]>([])

  useEffect(() => {
    if (typeof id !== 'string' || !id) {
      setJob(null)
      setLoading(false)
      setError('Missing job id in URL.')
      setNotice(null)
      return
    }

    const load = async () => {
      setLoading(true)
      setError(null)
      setNotice(null)
      setEstimateFile(null)
      setEstimateFileError(null)
      setPaintLogs([])
      setAfterPhotos([])
      const res = await authedFetch(`/api/jobs/${id}`, { cache: 'no-store' })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        setError(payload?.error ?? res.statusText)
        setJob(null)
        setLoading(false)
        return
      }
      setJob(payload?.job ?? null)

      const [estimateRes, paintLogsRes, photosRes] = await Promise.all([
        authedFetch(`/api/jobs/${id}/estimate-file`, { cache: 'no-store' }),
        authedFetch(`/api/jobs/${id}/paint-logs`, { cache: 'no-store' }),
        authedFetch(`/api/jobs/${id}/photos`, { cache: 'no-store' }),
      ])

      const estimatePayload = await estimateRes.json().catch(() => null)
      const paintLogsPayload = await paintLogsRes.json().catch(() => null)
      const photosPayload = await photosRes.json().catch(() => null)

      if (estimateRes.ok && estimatePayload?.file) {
        setEstimateFile(estimatePayload.file as EstimateDriveFile)
      } else {
        setEstimateFile(null)
        setEstimateFileError(
          typeof estimatePayload?.error === 'string'
            ? estimatePayload.error
            : 'No matching estimate in Drive folder'
        )
      }

      if (paintLogsRes.ok && Array.isArray(paintLogsPayload?.rows)) {
        setPaintLogs((paintLogsPayload.rows as PaintLogRow[]).map((row) => ({
          id: row.id,
          sort_order: row.sort_order,
          where_used: row.where_used ?? '',
          paint_product: row.paint_product ?? '',
          sheen: row.sheen ?? '',
          color: row.color ?? '',
          notes: row.notes ?? '',
        })))
      } else {
        setPaintLogs([])
      }

      if (photosRes.ok && Array.isArray(photosPayload?.photos)) {
        const rows = photosPayload.photos as JobPhoto[]
        setAfterPhotos(rows.filter((row) => row.phase === 'after'))
      } else {
        setAfterPhotos([])
      }
      setLoading(false)
    }

    void load()
  }, [id])

  useEffect(() => {
    const stage = asStageEmailStage(searchParams.get('compose'))
    if (!stage) return
    if (loading) return
    if (!job) return
    if (stage === 'completed') {
      setCloseoutOpen(true)
      return
    }
    if (emailStage === stage) return
    setEmailStage(stage)
  }, [searchParams, loading, job, emailStage])

  const copy = async (label: string, value: string | null | undefined) => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      const el = document.createElement('textarea')
      el.value = value
      el.style.position = 'fixed'
      el.style.left = '-9999px'
      document.body.appendChild(el)
      el.focus()
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setNotice(`${label} copied`)
    window.setTimeout(() => setNotice(null), 1200)
  }

  const patchJob = async (patch: Record<string, unknown>) => {
    if (!id || typeof id !== 'string') return
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
    setJob((prev) => (prev ? { ...prev, ...payload.job } : prev))
    return (payload?.job ?? null) as Partial<JobDetail> | null
  }

  const refreshCloseoutData = async () => {
    if (!id || typeof id !== 'string') return
    const [paintRes, photosRes] = await Promise.all([
      authedFetch(`/api/jobs/${id}/paint-logs`, { cache: 'no-store' }),
      authedFetch(`/api/jobs/${id}/photos`, { cache: 'no-store' }),
    ])
    const paintPayload = await paintRes.json().catch(() => null)
    const photosPayload = await photosRes.json().catch(() => null)

    if (paintRes.ok && Array.isArray(paintPayload?.rows)) {
      setPaintLogs((paintPayload.rows as PaintLogRow[]).map((row) => ({
        id: row.id,
        sort_order: row.sort_order,
        where_used: row.where_used ?? '',
        paint_product: row.paint_product ?? '',
        sheen: row.sheen ?? '',
        color: row.color ?? '',
        notes: row.notes ?? '',
      })))
    }

    if (photosRes.ok && Array.isArray(photosPayload?.photos)) {
      const rows = photosPayload.photos as JobPhoto[]
      setAfterPhotos(rows.filter((row) => row.phase === 'after'))
    }
  }

  const nowIso = () => new Date().toISOString()

  const deleteJob = async () => {
    if (!id || typeof id !== 'string') return
    const ok = window.confirm('Delete this job? This cannot be undone.')
    if (!ok) return
    setDeleting(true)
    setError(null)
    const res = await authedFetch(`/api/jobs/${id}`, { method: 'DELETE' })
    const payload = await res.json().catch(() => null)
    setDeleting(false)
    if (!res.ok) {
      setError(payload?.error ?? res.statusText)
      return
    }
    router.push('/crm/jobs')
  }

  const openStageEmail = (stage: StageEmailStage) => {
    setError(null)
    setEmailStage(stage)
  }

  const openCloseout = () => {
    setError(null)
    setCloseoutOpen(true)
  }

  const closeStageEmail = () => {
    setEmailStage(null)
    if (searchParams.get('compose') && id && typeof id === 'string') {
      router.replace(`/crm/jobs/${id}`)
    }
  }

  const closeCloseout = () => {
    setCloseoutOpen(false)
    if (searchParams.get('compose') && id && typeof id === 'string') {
      router.replace(`/crm/jobs/${id}`)
    }
  }

  const handleStageEmailSent = (result: StageEmailSentResult) => {
    setError(null)
    if (result.job) {
      const patch = result.job as Partial<JobDetail>
      setJob((prev) => (prev ? { ...prev, ...patch } : prev))
    }
    setNotice(result.warning ?? 'Email sent')
  }

  const markCompletedAndPrompt = async () => {
    if (!job) return
    const updated = await patchJob({ completed_at: nowIso() })
    if (updated) {
      setNotice(null)
      openCloseout()
    }
  }

  const handleCloseoutSaved = async (result: { job?: Partial<JobDetail> | null; notice?: string | null }) => {
    setError(null)
    if (result.job) {
      setJob((prev) => (prev ? { ...prev, ...(result.job as Partial<JobDetail>) } : prev))
    }
    if (result.notice) setNotice(result.notice)
    await refreshCloseoutData()
  }

  const handleStatusChange = async (nextStatus: string) => {
    if (!job || nextStatus === job.status) return
    if (nextStatus === 'completed') {
      await markCompletedAndPrompt()
      return
    }
    await patchJob({ status: nextStatus })
  }

  const formatDate = (iso: string | null | undefined) => {
    if (!iso) return '-'
    try {
      return new Date(iso).toLocaleString()
    } catch {
      return iso
    }
  }

  const formatRange = (start?: string | null, end?: string | null) => {
    if (!start && !end) return '-'
    if (start && end) return `${formatDate(start)} - ${formatDate(end)}`
    if (start) return `${formatDate(start)} -`
    return `- ${formatDate(end)}`
  }

  const pad2 = (n: number) => String(n).padStart(2, '0')
  const toLocalInputValue = (d: Date) =>
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(
      d.getHours()
    )}:${pad2(d.getMinutes())}`

  const next8amLocalValue = () => {
    const now = new Date()
    const next = new Date(now)
    if (now.getHours() >= 8) next.setDate(next.getDate() + 1)
    next.setHours(8, 0, 0, 0)
    return toLocalInputValue(next)
  }

  const formatStatus = (value: string | null | undefined) => {
    const s = (value ?? '').replaceAll('_', ' ').trim()
    if (!s) return '-'
    return s.replace(/\b\w/g, (m) => m.toUpperCase())
  }

  const timelineItems = job
    ? [
        {
          key: 'created_at',
          label: 'Created',
          value: formatDate(job.created_at),
          at: job.created_at ?? null,
          order: 0,
        },
        {
          key: 'estimate_date',
          label: 'Estimate date',
          value: formatDate(job.estimate_date),
          at: job.estimate_date ?? null,
          order: 1,
        },
        {
          key: 'estimate_sent_at',
          label: 'Estimate sent',
          value: formatDate(job.estimate_sent_at),
          at: job.estimate_sent_at ?? null,
          order: 2,
        },
        {
          key: 'scheduled_range',
          label: 'Scheduled job date range',
          value: formatRange(job.scheduled_date, job.scheduled_end_date),
          at: job.scheduled_date ?? job.scheduled_end_date ?? null,
          order: 3,
        },
        {
          key: 'scheduled_email_sent_at',
          label: 'Confirmation email sent',
          value: formatDate(job.scheduled_email_sent_at),
          at: job.scheduled_email_sent_at ?? null,
          order: 4,
        },
        {
          key: 'completed_at',
          label: 'Completed at',
          value: formatDate(job.completed_at),
          at: job.completed_at ?? null,
          order: 5,
        },
        {
          key: 'completed_email_sent_at',
          label: 'Review email sent',
          value: formatDate(job.completed_email_sent_at),
          at: job.completed_email_sent_at ?? null,
          order: 6,
        },
      ].sort((a, b) => {
        if (a.at && b.at) return b.at.localeCompare(a.at)
        if (a.at) return -1
        if (b.at) return 1
        return a.order - b.order
      })
    : []

  const timelineIconForItem = (key: string) => {
    if (key === 'estimate_date') return CalendarCheck
    if (key === 'estimate_sent_at') return Send
    if (key === 'scheduled_range') return CalendarCheck
    if (key === 'scheduled_email_sent_at') return Mail
    if (key === 'completed_at') return CheckCircle2
    if (key === 'completed_email_sent_at') return Mail
    return Circle
  }

  const renderRow = (
    label: string,
    value: string | null | undefined,
    actions?: React.ReactNode
  ) => (
    <div className="mt-4">
      <div className="text-xs font-extrabold tracking-wide text-gray-500 uppercase">{label}</div>
      <div className="mt-1 flex items-start gap-2">
        <div className="min-w-0 flex-1 text-base font-semibold text-gray-900">{value ?? '-'}</div>
        {actions}
      </div>
    </div>
  )

  const canSendScheduledEmail =
    Boolean(job?.scheduled_date || job?.scheduled_end_date) && job?.status !== 'completed'
  const linkedEstimateHref =
    job?.linked_estimate_id && typeof job.linked_estimate_id === 'string'
      ? `/crm/estimates/${job.linked_estimate_id}`
      : `/crm/jobs/${id}/estimate`
  const linkedEstimateLabel =
    job?.linked_estimate_id && typeof job.linked_estimate_id === 'string'
      ? 'Open linked estimate'
      : 'Open estimate'

  return (
    <div className="min-h-full bg-gradient-to-br from-gray-50 to-gray-200 py-4 md:py-6">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-bold text-gray-900">Job details</h1>
          <p className="m-0 text-sm text-gray-600">Full job overview and schedule.</p>
        </div>
        <button
          onClick={() => router.back()}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/70"
        >
          {iconLabel(ArrowLeft, 'Back', iconSizeMd)}
        </button>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        {loading && <div className="text-gray-500">Loading job...</div>}
        {!loading && error && (
          <div className="mt-3 rounded-xl border border-red-200 bg-white p-3 text-red-800">
            {error}
          </div>
        )}
        {!loading && notice && (
          <div className="mt-3 rounded-xl border border-green-200 bg-white p-3 text-green-700">
            {notice}
          </div>
        )}
        {!loading && !error && !job && <div className="text-gray-500">Job not found.</div>}

        {!loading && job && (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div className="text-3xl font-extrabold tracking-tight text-gray-900">{job.title}</div>
              <div className="inline-flex items-center rounded-full border border-gray-300 bg-gray-100 px-3 py-1 text-xs font-extrabold tracking-wide text-gray-800">
                {formatStatus(job.status)}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="text-xs font-extrabold tracking-wide text-gray-500 uppercase">
                Job stage
              </div>
              <select
                value={job.status}
                onChange={(e) => void handleStatusChange(e.target.value)}
                className="h-9 rounded-xl border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-900 outline-none ring-black/70 focus:ring-2"
              >
                <option value="estimate_scheduled">Estimate scheduled</option>
                <option value="estimate_sent">Estimate sent</option>
                <option value="follow_up">Follow up</option>
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="lost">Lost</option>
              </select>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => void deleteJob()}
                style={{ ...smallButton, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}
                disabled={deleting}
              >
                {deleting ? iconLabel(Trash2, 'Deleting...') : iconLabel(Trash2, 'Delete job')}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-start gap-5">
              <div className="min-w-0 flex-[1_1_420px]">
                {renderRow('Customer', job.customer_name ?? job.customer_id)}
                {renderRow(
                  'Address',
                  job.customer_address,
                  job.customer_address ? (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.customer_address)}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        ...actionButton,
                        display: 'inline-flex',
                        alignItems: 'center',
                        textDecoration: 'none',
                      }}
                    >
                      {iconLabel(MapPin, 'Google Maps')}
                    </a>
                  ) : null
                )}
                {renderRow(
                  'Email',
                  job.customer_email,
                  job.customer_email ? (
                    <button onClick={() => void copy('Email', job.customer_email)} style={actionButton}>
                      {iconLabel(Copy, 'Copy')}
                    </button>
                  ) : null
                )}
                {renderRow(
                  'Phone',
                  job.customer_phone,
                  job.customer_phone ? (
                    <button onClick={() => void copy('Phone', job.customer_phone)} style={actionButton}>
                      {iconLabel(Copy, 'Copy')}
                    </button>
                  ) : null
                )}
                {renderRow(
                  'Latest Estimate',
                  estimateFile
                    ? `${estimateFile.name}${estimateFile.version ? ` (v${estimateFile.version})` : ''}`
                    : estimateFileError ?? 'No matching estimate in Drive folder',
                  estimateFile?.webViewLink ? (
                    <a
                      href={estimateFile.webViewLink}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        ...actionButton,
                        display: 'inline-flex',
                        alignItems: 'center',
                        textDecoration: 'none',
                      }}
                    >
                      {iconLabel(FileText, 'Preview')}
                    </a>
                  ) : null
                )}
                {renderRow('Notes', job.description)}
                {(job.status === 'completed' || paintLogs.length > 0 || afterPhotos.length > 0 || job.closeout_notes) && (
                  <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <div className="text-xs font-extrabold tracking-wide text-gray-500 uppercase">
                      Closeout Reference
                    </div>
                    <div className="mt-2 grid gap-2 text-sm text-gray-800">
                      <div>
                        <div className="text-xs font-bold text-gray-600 uppercase">Closeout notes</div>
                        <div className="mt-1 whitespace-pre-wrap text-sm">
                          {job.closeout_notes?.trim() ? job.closeout_notes : 'No closeout notes yet.'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-600 uppercase">Paint logs</div>
                        {paintLogs.length === 0 ? (
                          <div className="mt-1 text-sm text-gray-600">No paint logs saved yet.</div>
                        ) : (
                          <div className="mt-1 grid gap-2">
                            {paintLogs.map((row, idx) => (
                              <div key={row.id ?? `paint-${idx}`} className="rounded-lg border border-gray-200 bg-white p-2">
                                <div className="font-semibold text-gray-900">
                                  {row.where_used || `Area ${idx + 1}`}
                                </div>
                                <div className="mt-1 text-xs text-gray-700">
                                  Product: {row.paint_product || '-'} | Sheen: {row.sheen || '-'} | Color: {row.color || '-'}
                                </div>
                                {row.notes && <div className="mt-1 text-xs text-gray-600">{row.notes}</div>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-600 uppercase">After photos</div>
                        {afterPhotos.length === 0 ? (
                          <div className="mt-1 text-sm text-gray-600">No after photos uploaded yet.</div>
                        ) : (
                          <div className="mt-1 grid gap-1">
                            {afterPhotos.map((photo) => (
                              <a
                                key={photo.id}
                                href={photo.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm text-gray-800 underline"
                              >
                                After photo - {formatDate(photo.created_at)}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                <div className="mt-5 grid gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {job.status === 'estimate_scheduled' && (
                      <button
                        onClick={() => openStageEmail('estimate_scheduled')}
                        style={{ ...smallButton, background: '#111', border: '1px solid #111', color: 'white' }}
                      >
                        {iconLabel(Mail, 'Edit & send estimate scheduled')}
                      </button>
                    )}

                    {job.status !== 'scheduled' && (
                      <button onClick={() => openStageEmail('estimate_sent')} style={smallButton}>
                        {iconLabel(Send, 'Edit & send estimate')}
                      </button>
                    )}

                    <Link
                      href={linkedEstimateHref}
                      style={{ ...smallButton, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                    >
                      {iconLabel(FileText, linkedEstimateLabel)}
                    </Link>

                    {job.status !== 'estimate_scheduled' && (
                      <Link
                        href={`/crm/jobs/${id}/schedule`}
                        style={{ ...smallButton, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                      >
                        {iconLabel(CalendarCheck, 'Schedule job')}
                      </Link>
                    )}

                    {canSendScheduledEmail && (
                      <button
                        onClick={() => openStageEmail('scheduled')}
                        style={
                          job.scheduled_email_sent_at
                            ? smallButton
                            : { ...smallButton, background: '#111', border: '1px solid #111', color: 'white' }
                        }
                      >
                        {iconLabel(
                          Mail,
                          stageEmailActionLabel('scheduled', Boolean(job.scheduled_email_sent_at))
                        )}
                      </button>
                    )}

                    {job.status === 'estimate_scheduled' && (
                      <button onClick={() => void patchJob({ estimate_sent_at: nowIso() })} style={smallButton}>
                        {iconLabel(Send, 'Mark estimate sent')}
                      </button>
                    )}

                    {job.status === 'estimate_sent' && (
                      <>
                        <button onClick={() => openStageEmail('follow_up')} style={smallButton}>
                          {iconLabel(Mail, 'Edit & send follow up')}
                        </button>
                        <button onClick={() => void patchJob({ status: 'follow_up' })} style={smallButton}>
                          {iconLabel(Mail, 'Move to follow up')}
                        </button>
                        <button
                          onClick={() => void patchJob({ status: 'lost' })}
                          style={{ ...smallButton, background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b' }}
                        >
                          {iconLabel(XCircle, 'Mark lost')}
                        </button>
                      </>
                    )}

                    {job.status === 'follow_up' && (
                      <>
                        <button onClick={() => openStageEmail('follow_up')} style={smallButton}>
                          {iconLabel(Mail, 'Edit & send follow up')}
                        </button>
                        <button onClick={() => router.push(`/crm/jobs/${id}/schedule`)} style={smallButton}>
                          {iconLabel(CalendarCheck, 'Schedule job')}
                        </button>
                        <button
                          onClick={() => void patchJob({ status: 'lost' })}
                          style={{ ...smallButton, background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b' }}
                        >
                          {iconLabel(XCircle, 'Mark lost')}
                        </button>
                      </>
                    )}

                    {job.status === 'scheduled' && (
                      <button
                        onClick={() => void markCompletedAndPrompt()}
                        style={{ ...smallButton, background: '#111', border: '1px solid #111', color: 'white' }}
                      >
                        {iconLabel(CheckCircle2, 'Mark completed')}
                      </button>
                    )}

                    {job.status === 'completed' && (
                      <button
                        onClick={() => openCloseout()}
                        style={
                          job.completed_email_sent_at
                            ? smallButton
                            : { ...smallButton, background: '#111', border: '1px solid #111', color: 'white' }
                        }
                      >
                        {iconLabel(Mail, 'Open closeout')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="w-full max-w-full flex-[0_0_300px]">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                  <button
                    onClick={() => setTimelineOpen((prev) => !prev)}
                    className="flex w-full items-center justify-between rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-extrabold text-gray-900 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/70"
                    aria-expanded={timelineOpen}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {timelineOpen ? (
                        <ChevronDown size={iconSizeSm} aria-hidden="true" />
                      ) : (
                        <ChevronRight size={iconSizeSm} aria-hidden="true" />
                      )}
                      <span>Timeline</span>
                    </span>
                    <span>{timelineOpen ? 'Hide' : 'Show'}</span>
                  </button>
                  {timelineOpen && (
                    <div className="relative mt-3 pl-8">
                      <div className="absolute bottom-0 left-3 top-0 w-px bg-gray-200" aria-hidden="true" />
                      <div className="grid gap-2.5">
                        {timelineItems.map((item) => {
                          const ItemIcon = timelineIconForItem(item.key)
                          const isSet = item.at != null
                          return (
                            <div key={item.key} className="relative">
                              <div
                                className={`absolute left-[-23px] top-3 inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                                  isSet
                                    ? 'border-gray-400 bg-white text-gray-700'
                                    : 'border-gray-300 bg-white text-gray-400'
                                }`}
                                aria-hidden="true"
                              >
                                <ItemIcon size={12} />
                              </div>
                              <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                                <div className="text-xs font-extrabold tracking-wide text-gray-500 uppercase">
                                  {item.label}
                                </div>
                                <div
                                  className={`mt-1 text-sm font-semibold ${
                                    isSet ? 'text-gray-900' : 'text-gray-400'
                                  }`}
                                >
                                  {isSet ? item.value : 'Not set'}
                                </div>
                                {item.key === 'estimate_date' && (
                                  <input
                                    type="datetime-local"
                                    defaultValue={
                                      job.estimate_date
                                        ? toLocalInputValue(new Date(job.estimate_date))
                                        : next8amLocalValue()
                                    }
                                    onChange={(e) => {
                                      if (!e.target.value) return
                                      const iso = new Date(e.target.value).toISOString()
                                      void patchJob({ estimate_date: iso })
                                    }}
                                    className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 outline-none ring-black/70 focus:ring-2"
                                  />
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <Link
        href="/crm/jobs"
        className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-black bg-black px-3 py-2 text-sm font-semibold text-white no-underline transition hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-black/80"
      >
        {iconLabel(ArrowLeft, 'Back to jobs', iconSizeMd)}
      </Link>
      <StageEmailModal
        jobId={typeof id === 'string' ? id : null}
        stage={emailStage}
        open={emailStage != null}
        onClose={closeStageEmail}
        onSent={handleStageEmailSent}
      />
      <JobCompletionCloseoutModal
        jobId={typeof id === 'string' ? id : null}
        open={closeoutOpen}
        onClose={closeCloseout}
        onSaved={(result) => void handleCloseoutSaved(result)}
      />
      </div>
    </div>
  )
}

const actionButton: React.CSSProperties = {
  border: '1px solid #d1d5db',
  borderRadius: 10,
  background: 'white',
  height: 34,
  padding: '0 10px',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: 13,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
}

const smallButton: React.CSSProperties = {
  height: 34,
  padding: '0 10px',
  borderRadius: 10,
  border: '1px solid #d1d5db',
  background: 'white',
  color: '#111',
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
}

