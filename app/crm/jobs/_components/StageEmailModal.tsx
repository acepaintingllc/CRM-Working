'use client'

import { authedFetch } from '@/lib/auth/authedFetch'
import type { EmailSendStatus } from '@/lib/email/types'
import { Mail, Send, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

export type StageEmailStage =
  | 'estimate_scheduled'
  | 'estimate_sent'
  | 'follow_up'
  | 'scheduled'
  | 'completed'

export type StageEmailSentResult = {
  job?: Partial<JobEmailDetails> | null
  stage: StageEmailStage
  status: EmailSendStatus
  replayed: boolean
  warning?: string | null
}

type JobEmailDetails = {
  id: string
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  customer_address: string | null
  title: string
  status: string
  estimate_date: string | null
  scheduled_date: string | null
  scheduled_end_date: string | null
  scheduled_email_sent_at?: string | null
  completed_at: string | null
  completed_email_sent_at?: string | null
}

type EmailTemplate = {
  stage: string
  subject: string | null
  body: string | null
}

type EstimateDriveFile = {
  id: string
  name: string
  webViewLink?: string | null
}

type StageEmailModalProps = {
  jobId: string | null
  stage: StageEmailStage | null
  open: boolean
  onClose: () => void
  onSent?: (result: StageEmailSentResult) => void
}

function createIdempotencyKey(stage: StageEmailStage, jobId: string) {
  const suffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `stage:${stage}:job:${jobId}:${suffix}`
}

function formatStageName(stage: StageEmailStage) {
  switch (stage) {
    case 'estimate_scheduled':
      return 'estimate scheduled'
    case 'estimate_sent':
      return 'estimate'
    case 'follow_up':
      return 'follow up'
    case 'scheduled':
      return 'scheduled'
    case 'completed':
      return 'review'
    default:
      return 'email'
  }
}

export function stageEmailActionLabel(stage: StageEmailStage, alreadySent: boolean) {
  switch (stage) {
    case 'scheduled':
      return alreadySent ? 'Resend scheduled email' : 'Send scheduled email'
    case 'completed':
      return alreadySent ? 'Resend review email' : 'Send review email'
    case 'estimate_scheduled':
      return 'Send estimate scheduled email'
    case 'estimate_sent':
      return 'Send estimate email'
    case 'follow_up':
      return 'Send follow up email'
    default:
      return 'Send email'
  }
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function formatRange(start: string | null | undefined, end: string | null | undefined) {
  if (start && end) return `${formatDate(start)} - ${formatDate(end)}`
  if (start) return formatDate(start)
  if (end) return formatDate(end)
  return ''
}

function applyTemplate(
  value: string,
  job: JobEmailDetails | null,
  scheduledBlocks: string,
  estimateFile: EstimateDriveFile | null
) {
  const vars: Record<string, string> = {
    customerName: job?.customer_name ?? '',
    customerEmail: job?.customer_email ?? '',
    customerPhone: job?.customer_phone ?? '',
    customerAddress: job?.customer_address ?? '',
    jobTitle: job?.title ?? '',
    estimateDate: formatDate(job?.estimate_date),
    scheduledDate: formatDate(job?.scheduled_date),
    scheduledBlocks: scheduledBlocks || formatRange(job?.scheduled_date, job?.scheduled_end_date),
    estimateFileName: estimateFile?.name ?? '',
    estimateFileLink: estimateFile?.webViewLink ?? '',
    reviewLink:
      process.env.NEXT_PUBLIC_REVIEW_LINK ?? 'https://g.page/r/CXTTS4mREhqcEBM/review',
    customer_name: job?.customer_name ?? '',
    customer_email: job?.customer_email ?? '',
    customer_phone: job?.customer_phone ?? '',
    customer_address: job?.customer_address ?? '',
    job_title: job?.title ?? '',
    estimate_date: formatDate(job?.estimate_date),
    scheduled_date: formatDate(job?.scheduled_date),
    scheduled_blocks: scheduledBlocks || formatRange(job?.scheduled_date, job?.scheduled_end_date),
    estimate_file_name: estimateFile?.name ?? '',
    estimate_file_link: estimateFile?.webViewLink ?? '',
    review_link:
      process.env.NEXT_PUBLIC_REVIEW_LINK ?? 'https://g.page/r/CXTTS4mREhqcEBM/review',
  }

  return Object.entries(vars).reduce(
    (acc, [key, replacement]) => acc.replaceAll(`{{${key}}}`, replacement ?? ''),
    value
  )
}

export default function StageEmailModal({
  jobId,
  stage,
  open,
  onClose,
  onSent,
}: StageEmailModalProps) {
  const [job, setJob] = useState<JobEmailDetails | null>(null)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [blockingIssues, setBlockingIssues] = useState<string[]>([])
  const [estimateFile, setEstimateFile] = useState<EstimateDriveFile | null>(null)

  const needsEstimateAttachment = stage === 'estimate_sent' || stage === 'follow_up'
  const alreadySent = useMemo(() => {
    if (!job || !stage) return false
    if (stage === 'scheduled') return Boolean(job.scheduled_email_sent_at)
    if (stage === 'completed') return Boolean(job.completed_email_sent_at)
    return false
  }, [job, stage])

  useEffect(() => {
    if (!open || !jobId || !stage) return

    let cancelled = false

    const loadComposer = async () => {
      setLoading(true)
      setSending(false)
      setError(null)
      setBlockingIssues([])
      setJob(null)
      setSubject('')
      setBody('')
      setEstimateFile(null)

      const requests: Array<Promise<Response>> = [
        authedFetch('/api/email-templates', { cache: 'no-store' }),
        authedFetch(`/api/jobs/${jobId}`, { cache: 'no-store' }),
      ]

      if (stage === 'scheduled') {
        requests.push(authedFetch(`/api/jobs/${jobId}/schedules`, { cache: 'no-store' }))
      }
      if (needsEstimateAttachment) {
        requests.push(authedFetch(`/api/jobs/${jobId}/estimate-file`, { cache: 'no-store' }))
      }

      try {
        const responses = await Promise.all(requests)
        const templatesRes = responses[0]
        const jobRes = responses[1]
        const scheduledRes = stage === 'scheduled' ? responses[2] : null
        const estimateRes = needsEstimateAttachment
          ? responses[responses.length - 1]
          : null

        const jobPayload = await jobRes.json().catch(() => null)
        if (!jobRes.ok) {
          if (!cancelled) {
            setError(jobPayload?.error ?? jobRes.statusText)
            setLoading(false)
          }
          return
        }

        const loadedJob = (jobPayload?.job ?? null) as JobEmailDetails | null
        if (!loadedJob) {
          if (!cancelled) {
            setError('Job not found.')
            setLoading(false)
          }
          return
        }

        const templatesPayload = await templatesRes.json().catch(() => null)
        const templates = ((templatesPayload?.templates ?? []) as EmailTemplate[]).filter(Boolean)
        const template = templates.find((row) => row.stage === stage) ?? null

        let scheduledBlocks = ''
        if (scheduledRes) {
          const scheduledPayload = await scheduledRes.json().catch(() => null)
          if (scheduledRes.ok) {
            scheduledBlocks = ((scheduledPayload?.schedules ?? []) as Array<{
              start_at?: string | null
              end_at?: string | null
            }>)
              .map((row) => {
                if (!row?.start_at || !row?.end_at) return null
                return `${formatDate(row.start_at)} - ${formatDate(row.end_at)}`
              })
              .filter((value): value is string => Boolean(value))
              .join('\n')
          }
        }

        let nextEstimateFile: EstimateDriveFile | null = null
        let estimateFileError: string | null = null
        if (estimateRes) {
          const estimatePayload = await estimateRes.json().catch(() => null)
          if (estimateRes.ok && estimatePayload?.file) {
            nextEstimateFile = estimatePayload.file as EstimateDriveFile
          } else {
            estimateFileError =
              typeof estimatePayload?.error === 'string'
                ? estimatePayload.error
                : 'No matching estimate file found in Drive.'
          }
        }

        const nextBlockingIssues: string[] = []
        if (!templatesRes.ok) {
          nextBlockingIssues.push(templatesPayload?.error ?? templatesRes.statusText)
        } else if (!template) {
          nextBlockingIssues.push(
            `Missing ${formatStageName(stage)} email template. Add one in Email templates before sending.`
          )
        }
        if (!loadedJob.customer_email) {
          nextBlockingIssues.push('Customer email is missing for this job.')
        }
        if (needsEstimateAttachment && !nextEstimateFile) {
          nextBlockingIssues.push(estimateFileError ?? 'No matching estimate file found in Drive.')
        }

        if (!cancelled) {
          setJob(loadedJob)
          setEstimateFile(nextEstimateFile)
          setBlockingIssues(nextBlockingIssues)
          setSubject(
            template ? applyTemplate(template.subject ?? '', loadedJob, scheduledBlocks, nextEstimateFile) : ''
          )
          setBody(
            template ? applyTemplate(template.body ?? '', loadedJob, scheduledBlocks, nextEstimateFile) : ''
          )
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setError('Failed to load email composer.')
          setLoading(false)
        }
      }
    }

    void loadComposer()

    return () => {
      cancelled = true
    }
  }, [jobId, needsEstimateAttachment, open, stage])

  if (!open || !jobId || !stage) return null

  const canSend = !loading && !sending && !error && blockingIssues.length === 0
  const closeLabel = stage === 'completed' ? 'Skip for now' : 'Cancel'
  const actionLabel = stageEmailActionLabel(stage, alreadySent)

  const sendComposed = async () => {
    if (!jobId || !stage || !canSend || sending) return

    setSending(true)
    setError(null)
    const idempotencyKey = createIdempotencyKey(stage, jobId)

    const res = await authedFetch(`/api/jobs/${jobId}/send-stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage, subject, body, idempotency_key: idempotencyKey }),
    })
    const payload = await res.json().catch(() => null)
    setSending(false)

    if (!res.ok) {
      setError(payload?.error ?? res.statusText)
      return
    }

    if (payload?.job) {
      setJob((prev) => (prev ? { ...prev, ...payload.job } : prev))
    }
    onSent?.({
      stage,
      status:
        (typeof payload?.status === 'string' ? (payload.status as EmailSendStatus) : 'sent'),
      replayed: Boolean(payload?.replayed),
      job: (payload?.job ?? null) as Partial<JobEmailDetails> | null,
      warning:
        (payload?.warning as string | null | undefined) ??
        (payload?.replayed ? 'This send request was already processed. No duplicate email was sent.' : null),
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="stage-email-modal-title"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
          <div>
            <div className="text-xs font-extrabold tracking-wide text-gray-500 uppercase">
              Stage Email
            </div>
            <h2 id="stage-email-modal-title" className="mt-1 text-xl font-extrabold text-gray-900">
              {actionLabel}
            </h2>
            <div className="mt-1 text-sm text-gray-600">
              {job?.customer_email ? `To: ${job.customer_email}` : 'Customer email required'}
            </div>
          </div>
          <button
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/70"
            aria-label="Close email composer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-4 px-5 py-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          )}

          {blockingIssues.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {blockingIssues.map((issue) => (
                <div key={issue}>{issue}</div>
              ))}
            </div>
          )}

          {needsEstimateAttachment && (
            <div
              className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                estimateFile
                  ? 'border-green-200 bg-green-50 text-green-800'
                  : 'border-amber-200 bg-amber-50 text-amber-900'
              }`}
            >
              {estimateFile
                ? `Estimate attachment ready: ${estimateFile.name}`
                : 'Estimate attachment is required before this email can be sent.'}
            </div>
          )}

          {loading ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-4 text-sm text-gray-600">
              Loading email template...
            </div>
          ) : (
            <>
              <div>
                <div className="mb-1 text-xs font-extrabold tracking-wide text-gray-500 uppercase">
                  Subject
                </div>
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none ring-black/70 focus:ring-2"
                />
              </div>

              <div>
                <div className="mb-1 text-xs font-extrabold tracking-wide text-gray-500 uppercase">
                  Body
                </div>
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  className="min-h-[220px] w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none ring-black/70 focus:ring-2"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-5 py-4">
          <div className="inline-flex items-center gap-2 text-sm text-gray-600">
            <Mail size={16} />
            <span>{alreadySent ? 'This stage email has already been sent once.' : 'Ready to send.'}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onClose}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/70"
            >
              {closeLabel}
            </button>
            <button
              onClick={() => void sendComposed()}
              disabled={!canSend}
              className={`inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-black/70 ${
                canSend
                  ? 'border border-black bg-black text-white'
                  : 'cursor-not-allowed border border-gray-300 bg-gray-100 text-gray-400'
              }`}
            >
              <Send size={16} />
              <span>{sending ? 'Sending...' : actionLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
