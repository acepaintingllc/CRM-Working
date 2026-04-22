'use client'

import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  fetchCloseoutData,
  fetchJobDetail,
} from '@/lib/jobs/actions'
import {
  deleteJob as deleteJobRequest,
  patchJobDateFields,
  patchJobStatus,
  type EstimateDriveFile,
  type JobDetail,
  type JobPhoto,
  type SitePhoto,
} from '@/lib/jobs/client'
import {
  isStageEmailStage,
  type JobStatus,
} from '@/lib/jobs/types'
import type { PaintLogRow } from '@/lib/jobs/paintLog'
import type { StageEmailSentResult, StageEmailStage } from '@/app/crm/jobs/_components/StageEmailModal'

export function useJobDetailPage() {
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
    } catch {
      // Keep the page interactive if closeout-specific reload fails.
    }
  }

  const nowIso = () => new Date().toISOString()

  const deleteJob = async () => {
    if (!id || typeof id !== 'string' || deleting) return
    const ok = window.confirm('Delete this job? This cannot be undone.')
    if (!ok) return
    setDeleting(true)
    setError(null)
    try {
      await deleteJobRequest(id)
      router.replace('/crm/jobs')
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete job.')
    } finally {
      setDeleting(false)
    }
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

  return {
    id,
    router,
    searchParams,
    job,
    loading,
    error,
    setError,
    notice,
    deleting,
    emailStage,
    closeoutOpen,
    timelineOpen,
    setTimelineOpen,
    estimateFile,
    estimateFileError,
    paintLogs,
    afterPhotos,
    sitePhotos,
    copy,
    patchJob,
    deleteJob,
    openStageEmail,
    openCloseout,
    closeStageEmail,
    closeCloseout,
    handleStageEmailSent,
    handleCloseoutSaved,
    handleStatusChange,
    markCompletedAndPrompt,
    formatDate,
    formatRange,
    formatStatus,
    setEmailStage,
  }
}
