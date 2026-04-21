'use client'

import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import StageEmailModal, {
  type StageEmailSentResult,
  type StageEmailStage,
} from '@/app/crm/jobs/_components/StageEmailModal'
import JobCompletionCloseoutModal from '@/app/crm/jobs/_components/JobCompletionCloseoutModal'
import JobActionRail from '@/app/crm/jobs/[id]/_components/JobActionRail'
import JobCloseoutPanel from '@/app/crm/jobs/[id]/_components/JobCloseoutPanel'
import JobDetailHeader from '@/app/crm/jobs/[id]/_components/JobDetailHeader'
import JobDetailsPanel from '@/app/crm/jobs/[id]/_components/JobDetailsPanel'
import JobTimeline from '@/app/crm/jobs/[id]/_components/JobTimeline'
import { authedFetch } from '@/lib/auth/authedFetch'
import {
  fetchCloseoutData,
  fetchJobDetail,
  patchJobDateFields,
  patchJobStatus,
  parseResponseBody,
  getResponseErrorMessage,
  type EstimateDriveFile,
  type JobDetail,
  type JobPhoto,
  type SitePhoto,
} from '@/lib/jobs/actions'
import {
  jobsButtonDangerClassName,
  jobsButtonSecondaryClassName,
  jobsButtonSmallClassName,
} from '@/lib/jobs/uiClasses'
import {
  JOB_STATUS_OPTIONS,
  getJobWorkflowActions,
  isStageEmailStage,
  type JobWorkflowResolvedAction,
  type JobStatus,
} from '@/lib/jobs/types'
import type { PaintLogRow } from '@/lib/jobs/paintLog'
import { ArrowLeft, Trash2, type LucideIcon } from 'lucide-react'

const iconSizeMd = 18

function iconLabel(Icon: LucideIcon, label: string, size = iconSizeMd) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon size={size} aria-hidden="true" />
      <span>{label}</span>
    </span>
  )
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
  const [sitePhotos, setSitePhotos] = useState<SitePhoto[]>([])

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
      setSitePhotos([])
      try {
        const detail = await fetchJobDetail(id)
        setJob(detail.job)
        setEstimateFile(detail.estimateFile as EstimateDriveFile | null)
        setEstimateFileError(detail.estimateFileError)
        setPaintLogs(detail.paintLogs)
        setAfterPhotos(detail.afterPhotos)
        setSitePhotos(detail.sitePhotos)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load job.')
        setJob(null)
      }
      setLoading(false)
    }

    void load()
  }, [id])

  useEffect(() => {
    const composeValue = searchParams.get('compose')
    const stage = isStageEmailStage(composeValue) ? composeValue : null
    if (!stage || loading || !job) return
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
    if (!id || typeof id !== 'string') return null
    try {
      const updated =
        typeof patch.status === 'string'
          ? await patchJobStatus(id, patch.status as JobStatus)
          : await patchJobDateFields(id, patch)
      setJob((prev) => (prev ? { ...prev, ...updated } : prev))
      return (updated ?? null) as Partial<JobDetail> | null
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : 'Failed to update job.')
      return null
    }
  }

  const refreshCloseoutData = async () => {
    if (!id || typeof id !== 'string') return
    try {
      const closeout = await fetchCloseoutData(id)
      setPaintLogs(closeout.paintLogs)
      setAfterPhotos(closeout.afterPhotos)
      setSitePhotos(closeout.sitePhotos)
    } catch {}
  }

  const nowIso = () => new Date().toISOString()

  const deleteJob = async () => {
    if (!id || typeof id !== 'string' || deleting) return
    const ok = window.confirm('Delete this job? This cannot be undone.')
    if (!ok) return
    setDeleting(true)
    setError(null)
    const res = await authedFetch(`/api/jobs/${id}`, { method: 'DELETE' })
    const payload = await parseResponseBody(res)
    setDeleting(false)
    if (!res.ok) {
      setError(getResponseErrorMessage(res, payload))
      return
    }
    router.replace('/crm/jobs')
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
    if (searchParams.get('compose') && id && typeof id === "string") {
      router.replace(`/crm/jobs/${id}`)
    }
  }

  const closeCloseout = () => {
    setCloseoutOpen(false)
    if (searchParams.get('compose') && id && typeof id === "string") {
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

  const handleCloseoutSaved = async (result: {
    job?: Partial<JobDetail> | null
    notice?: string | null
  }) => {
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

  const formatStatus = (value: string | null | undefined) => {
    const s = (value ?? '').replaceAll('_', ' ').trim()
    if (!s) return '-'
    return s.replace(/\b\w/g, (m) => m.toUpperCase())
  }

  const detailActions = job ? getJobWorkflowActions('detail', job) : []

  const actionClassName = (action: JobWorkflowResolvedAction) => {
    if (action.tone === 'accent') {
      return 'inline-flex items-center gap-1.5 rounded-[10px] border border-[var(--crm-accent)] bg-[var(--crm-accent)] px-2.5 py-2 text-xs font-bold text-[var(--crm-accent-text)] transition hover:opacity-95'
    }
    if (action.tone === 'danger') {
      return jobsButtonDangerClassName
    }
    return jobsButtonSmallClassName
  }

  const runDetailAction = async (action: JobWorkflowResolvedAction) => {
    if (!job) return
    if (action.confirmMessage && !window.confirm(action.confirmMessage)) return
    if (action.kind === 'navigate' && action.href) {
      router.push(action.href)
      return
    }
    if (action.kind === 'stage_email' && action.stage) {
      openStageEmail(action.stage)
      return
    }
    if (action.kind === 'open_closeout') {
      openCloseout()
      return
    }
    if (action.kind === 'patch_status' && action.status) {
      await patchJob({ status: action.status })
      return
    }
    if (action.kind === 'patch_date' && action.dateField === 'completed_at') {
      await markCompletedAndPrompt()
      return
    }
    if (action.kind === 'patch_date' && action.dateField === 'estimate_sent_at') {
      await patchJob({ estimate_sent_at: nowIso() })
    }
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-gray-50 to-gray-200 py-4 md:py-6">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <JobDetailHeader
          title={job?.title ?? 'Job details'}
          status={job?.status ?? null}
          statusOptions={JOB_STATUS_OPTIONS}
          deleting={deleting}
          onBack={() => router.back()}
          onDelete={() => void deleteJob()}
          onStatusChange={(status) => void handleStatusChange(status)}
          formatStatus={formatStatus}
          deleteButtonClassName={jobsButtonDangerClassName}
        />

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
            <div className="mt-3 flex flex-wrap items-start gap-5">
              <div className="min-w-0 flex-[1_1_420px]">
                <JobDetailsPanel
                  job={job}
                  estimateFile={estimateFile}
                  estimateFileError={estimateFileError}
                  actionButtonClassName={jobsButtonSecondaryClassName}
                  onCopy={(label, value) => void copy(label, value)}
                />
                <JobCloseoutPanel
                  job={job}
                  paintLogs={paintLogs}
                  afterPhotos={afterPhotos}
                  sitePhotos={sitePhotos}
                  detailActions={detailActions}
                  formatDate={formatDate}
                />
                <JobActionRail
                  actions={detailActions}
                  getActionClassName={actionClassName}
                  onAction={(action) => void runDetailAction(action)}
                />
              </div>

              <div className="w-full max-w-full flex-[0_0_300px]">
                <JobTimeline
                  job={job}
                  open={timelineOpen}
                  onToggle={() => setTimelineOpen((prev) => !prev)}
                  onEstimateDateChange={(iso) => void patchJob({ estimate_date: iso })}
                  formatDate={formatDate}
                  formatRange={formatRange}
                />
              </div>
            </div>
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
