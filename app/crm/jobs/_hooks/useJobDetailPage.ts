'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useLoadableResource } from '@/app/crm/_hooks/useLoadableResource'
import { useEntityDetailActions } from '@/app/crm/_hooks/useEntityDetailActions'
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
import type {
  StageEmailSentResult,
  StageEmailStage,
} from '@/app/crm/jobs/_components/StageEmailModal'
import type { JobWorkflowResolvedAction } from '@/lib/jobs/types'

type JobDetailResource = {
  job: JobDetail | null
  estimateFile: EstimateDriveFile | null
  estimateFileError: string | null
  paintLogs: PaintLogRow[]
  afterPhotos: JobPhoto[]
  sitePhotos: SitePhoto[]
}

const emptyJobDetailResource: JobDetailResource = {
  job: null,
  estimateFile: null,
  estimateFileError: null,
  paintLogs: [],
  afterPhotos: [],
  sitePhotos: [],
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Failed to load job.'
}

export function useJobDetailPage() {
  const params = useParams()
  const rawId = (params as { id?: string } | null | undefined)?.id
  const id = Array.isArray(rawId) ? rawId[0] : rawId
  const router = useRouter()
  const searchParams = useSearchParams()
  const [notice, setNotice] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [emailStage, setEmailStage] = useState<StageEmailStage | null>(null)
  const [closeoutOpen, setCloseoutOpen] = useState(false)
  const [timelineOpen, setTimelineOpen] = useState(true)

  const resource = useLoadableResource<JobDetailResource>({
    initialData: emptyJobDetailResource,
    load: async () => {
      if (typeof id !== 'string' || !id) {
        throw new Error('Missing job id in URL.')
      }

      const detail = await fetchJobDetail(id)
      return {
        job: detail.job,
        estimateFile: detail.estimateFile as EstimateDriveFile | null,
        estimateFileError: detail.estimateFileError,
        paintLogs: detail.paintLogs,
        afterPhotos: detail.afterPhotos,
        sitePhotos: detail.sitePhotos,
      }
    },
    getErrorMessage,
    reloadKey: id,
  })

  const detailActions = useEntityDetailActions({
    deleteMessage: 'Delete this job? This cannot be undone.',
    deleteAction: async () => {
      if (!id || typeof id !== 'string' || deleting) return false
      setDeleting(true)
      resource.setError(null)
      try {
        await deleteJobRequest(id)
        router.replace('/crm/jobs')
        return true
      } catch (deleteError) {
        resource.setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete job.')
        return false
      } finally {
        setDeleting(false)
      }
    },
  })

  useEffect(() => {
    const composeValue = searchParams.get('compose')
    const stage = isStageEmailStage(composeValue) ? composeValue : null
    if (!stage || resource.loading || !resource.data.job) return
    if (stage === 'completed') {
      setCloseoutOpen(true)
      return
    }
    if (emailStage === stage) return
    setEmailStage(stage)
  }, [searchParams, resource.loading, resource.data.job, emailStage])

  const patchJob = async (patch: Record<string, unknown>) => {
    if (!id || typeof id !== 'string' || !resource.data.job) return null
    try {
      const updated =
        typeof patch.status === 'string'
          ? await patchJobStatus(id, patch.status as JobStatus)
          : await patchJobDateFields(id, patch)
      resource.setData((current) => ({
        ...current,
        job: current.job ? { ...current.job, ...updated } : current.job,
      }))
      resource.setError(null)
      return (updated ?? null) as Partial<JobDetail> | null
    } catch (patchError) {
      resource.setError(patchError instanceof Error ? patchError.message : 'Failed to update job.')
      return null
    }
  }

  const refreshCloseoutData = async () => {
    if (!id || typeof id !== 'string') return
    try {
      const closeout = await fetchCloseoutData(id)
      resource.setData((current) => ({
        ...current,
        paintLogs: closeout.paintLogs,
        afterPhotos: closeout.afterPhotos,
        sitePhotos: closeout.sitePhotos,
      }))
    } catch {
      // Keep the page interactive if closeout-specific reload fails.
    }
  }

  const nowIso = () => new Date().toISOString()

  const openStageEmail = (stage: StageEmailStage) => {
    resource.setError(null)
    setEmailStage(stage)
  }

  const openCloseout = () => {
    resource.setError(null)
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
    resource.setError(null)
    if (result.job) {
      resource.setData((current) => ({
        ...current,
        job: current.job ? { ...current.job, ...(result.job as Partial<JobDetail>) } : current.job,
      }))
    }
    setNotice(result.warning ?? 'Email sent')
  }

  const markCompletedAndPrompt = async () => {
    if (!resource.data.job) return
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
    resource.setError(null)
    if (result.job) {
      resource.setData((current) => ({
        ...current,
        job: current.job ? { ...current.job, ...(result.job as Partial<JobDetail>) } : current.job,
      }))
    }
    if (result.notice) setNotice(result.notice)
    await refreshCloseoutData()
  }

  const handleStatusChange = async (nextStatus: string) => {
    if (!resource.data.job || nextStatus === resource.data.job.status) return
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

  const statusMessage = useMemo(
    () => detailActions.statusMessage ?? notice,
    [detailActions.statusMessage, notice]
  )

  const runWorkflowAction = async (action: JobWorkflowResolvedAction) => {
    if (!resource.data.job) return
    if (action.confirmMessage && !window.confirm(action.confirmMessage)) return
    if (action.kind === 'navigate' && action.href) {
      router.push(action.href)
      return
    }
    if (action.kind === 'stage_email' && action.stage) {
      openStageEmail(action.stage)
      return
    }
    if (action.kind === 'patch_status' && action.status) {
      await handleStatusChange(action.status)
      return
    }
    if (action.kind === 'open_closeout') {
      openCloseout()
      return
    }
    if (action.kind === 'patch_date' && action.dateField === 'completed_at') {
      await markCompletedAndPrompt()
      return
    }
    if (action.kind === 'patch_date' && action.dateField === 'estimate_sent_at') {
      await patchJob({ estimate_sent_at: new Date().toISOString() })
    }
  }

  return {
    id,
    router,
    resource,
    job: resource.data.job,
    notice: statusMessage,
    deleting,
    emailStage,
    closeoutOpen,
    timelineOpen,
    setTimelineOpen,
    estimateFile: resource.data.estimateFile,
    estimateFileError: resource.data.estimateFileError,
    paintLogs: resource.data.paintLogs,
    afterPhotos: resource.data.afterPhotos,
    sitePhotos: resource.data.sitePhotos,
    copy: detailActions.copyValue,
    patchJob,
    deleteJob: detailActions.confirmAndDelete,
    openStageEmail,
    openCloseout,
    closeStageEmail,
    closeCloseout,
    handleStageEmailSent,
    handleCloseoutSaved,
    handleStatusChange,
    markCompletedAndPrompt,
    runWorkflowAction,
    formatDate,
    formatRange,
    formatStatus,
  }
}
