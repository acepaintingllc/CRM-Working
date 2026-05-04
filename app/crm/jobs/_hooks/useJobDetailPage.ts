'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { authedFetch } from '@/lib/auth/authedFetch'
import { invalidateSwrKey } from '@/app/crm/_hooks/swrCache'
import { useSwrResource } from '@/app/crm/_hooks/useSwrResource'
import { useEntityDetailActions } from '@/app/crm/_hooks/useEntityDetailActions'
import {
  getResponseErrorMessage,
  parseResponseBody,
} from '@/lib/jobs/actions'
import {
  deleteJob as deleteJobRequest,
  getJobPhotosFolderUrl,
  listJobSitePhotos,
  listPaintLogs,
  patchJobDateFields,
  patchJobStatus,
} from '@/lib/jobs/client'
import type { EstimateDriveFile, JobDetail } from '@/types/jobs/api'
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
}

type EstimateFilePayload = {
  data?:
    | {
        file?: EstimateDriveFile | null
      }
    | EstimateDriveFile
  error?: string
}

async function loadEstimateFile(jobId: string) {
  const response = await authedFetch(`/api/jobs/${jobId}/estimate-file`, { cache: 'no-store' })
  const parsed = await parseResponseBody<EstimateFilePayload>(response)
  const payload = parsed.json
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : null
  const file =
    ((data as { file?: EstimateDriveFile | null } | null)?.file ??
      (payload?.data && !Array.isArray(payload.data)
        ? (payload.data as EstimateDriveFile)
        : null)) as EstimateDriveFile | null

  if (response.ok) {
    return {
      estimateFile: file,
      estimateFileError:
        file == null ? payload?.error ?? 'No matching estimate in Drive folder' : null,
    }
  }

  return {
    estimateFile: null,
    estimateFileError: getResponseErrorMessage(
      response,
      parsed,
      'No matching estimate in Drive folder'
    ),
  }
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
  const [resourceError, setResourceError] = useState<string | null>(null)
  const [estimateFile, setEstimateFile] = useState<EstimateDriveFile | null>(null)
  const [estimateFileError, setEstimateFileError] = useState<string | null>(null)
  const [paintLogs, setPaintLogs] = useState<PaintLogRow[]>([])
  const [photosFolderUrl, setPhotosFolderUrl] = useState<string | null>(null)
  const [photosLoading, setPhotosLoading] = useState(false)
  const [secondaryLoading, setSecondaryLoading] = useState(false)
  const secondaryRequestIdRef = useRef(0)
  const photosRequestIdRef = useRef(0)

  const jobKey = typeof id === 'string' && id ? `/api/jobs/${id}` : null
  const jobsBoardKey = '/api/jobs'
  const jobResource = useSwrResource<JobDetail | null>(jobKey, {
    fallbackData: null,
  })
  const job = jobResource.data ?? null

  const setError = useCallback(
    (value: string | null) => {
      setResourceError(value)
      jobResource.setError(value)
    },
    [jobResource]
  )

  const loadSecondaryData = useCallback(async () => {
    if (!id || typeof id !== 'string') {
      setEstimateFile(null)
      setEstimateFileError(null)
      setPaintLogs([])
      setSecondaryLoading(false)
      return false
    }

    const requestId = ++secondaryRequestIdRef.current
    setSecondaryLoading(true)

    try {
      const [estimateState, paintLogRows] = await Promise.all([
        loadEstimateFile(id),
        listPaintLogs(id),
      ])

      if (secondaryRequestIdRef.current !== requestId) return false

      setEstimateFile(estimateState.estimateFile)
      setEstimateFileError(estimateState.estimateFileError)
      setPaintLogs(paintLogRows)
      return true
    } catch {
      if (secondaryRequestIdRef.current !== requestId) return false
      setEstimateFile(null)
      setEstimateFileError('Failed to load job support data.')
      setPaintLogs([])
      return false
    } finally {
      if (secondaryRequestIdRef.current === requestId) {
        setSecondaryLoading(false)
      }
    }
  }, [id])

  useEffect(() => {
    void loadSecondaryData()
  }, [loadSecondaryData])

  const loadPhotosData = useCallback(async () => {
    if (!id || typeof id !== 'string') {
      photosRequestIdRef.current += 1
      setPhotosFolderUrl(null)
      setPhotosLoading(false)
      return true
    }

    const requestId = ++photosRequestIdRef.current
    setPhotosLoading(true)

    try {
      const result = await listJobSitePhotos(id)
      if (photosRequestIdRef.current !== requestId) return false
      setPhotosFolderUrl(
        result?.jobFolder?.webViewLink ?? getJobPhotosFolderUrl(result?.jobFolder?.id) ?? null
      )
      return true
    } catch {
      if (photosRequestIdRef.current !== requestId) return false
      setPhotosFolderUrl(null)
      return true
    } finally {
      if (photosRequestIdRef.current === requestId) {
        setPhotosLoading(false)
      }
    }
  }, [id])

  useEffect(() => {
    void loadPhotosData()
  }, [loadPhotosData])

  const refreshResource = useCallback(async () => {
    const [jobOk, secondaryOk] = await Promise.all([
      jobResource.refresh(),
      loadSecondaryData(),
      loadPhotosData(),
    ])
    return jobOk && secondaryOk
  }, [jobResource, loadSecondaryData, loadPhotosData])

  const resource: {
    data: JobDetailResource
    loading: boolean
    error: string | null
    refresh: () => Promise<boolean>
    setData: (value: JobDetailResource | ((current: JobDetailResource) => JobDetailResource)) => void
    setError: (value: string | null) => void
  } = useMemo(
    () => ({
      data: {
        job,
        estimateFile,
        estimateFileError,
        paintLogs,
      },
      loading:
        (jobKey ? jobResource.loading : false) || secondaryLoading,
      error:
        resourceError ??
        jobResource.error ??
        (jobKey ? null : 'Missing job id in URL.'),
      refresh: refreshResource,
      setData: (value) => {
        const current = {
          job,
          estimateFile,
          estimateFileError,
          paintLogs,
        }
        const next =
          typeof value === 'function'
            ? (value as (current: JobDetailResource) => JobDetailResource)(current)
            : value

        jobResource.setData(next.job)
        setEstimateFile(next.estimateFile)
        setEstimateFileError(next.estimateFileError)
        setPaintLogs(next.paintLogs)
        setResourceError(null)
      },
      setError,
    }),
    [
      estimateFile,
      estimateFileError,
      job,
      jobKey,
      jobResource,
      paintLogs,
      refreshResource,
      resourceError,
      secondaryLoading,
      setError,
    ]
  )

  const detailActions = useEntityDetailActions({
    deleteMessage: 'Delete this job? This cannot be undone.',
    deleteAction: async () => {
      if (!id || typeof id !== 'string' || deleting) return false
      setDeleting(true)
      resource.setError(null)
      try {
        await deleteJobRequest(id)
        await Promise.all([
          jobKey ? invalidateSwrKey(jobKey) : Promise.resolve(undefined),
          invalidateSwrKey(jobsBoardKey),
        ])
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

  const patchJob = useCallback(
    async (patch: Record<string, unknown>) => {
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
        await Promise.all([
          jobKey ? invalidateSwrKey(jobKey) : Promise.resolve(undefined),
          invalidateSwrKey(jobsBoardKey),
        ])
        return (updated ?? null) as Partial<JobDetail> | null
      } catch (patchError) {
        resource.setError(patchError instanceof Error ? patchError.message : 'Failed to update job.')
        return null
      }
    },
    [id, jobKey, jobsBoardKey, resource]
  )

  const refreshCloseoutData = useCallback(async () => {
    await loadSecondaryData()
  }, [loadSecondaryData])

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
      void Promise.all([
        jobKey ? invalidateSwrKey(jobKey) : Promise.resolve(undefined),
        invalidateSwrKey(jobsBoardKey),
      ])
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
      await Promise.all([
        jobKey ? invalidateSwrKey(jobKey) : Promise.resolve(undefined),
        invalidateSwrKey(jobsBoardKey),
      ])
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
    photosFolderUrl,
    photosLoading,
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
