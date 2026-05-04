'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { invalidateSwrKey } from '@/app/crm/_hooks/swrCache'
import { useSwrResource } from '@/app/crm/_hooks/useSwrResource'
import {
  fetchJobList,
  patchJobDateFields,
  patchJobStatus,
} from '@/lib/jobs/client'
import type { JobSummary } from '@/types/jobs/api'
import {
  filterCompletedJobs,
  getVisibleJobBoardColumns,
  groupJobsByStatus,
} from '@/lib/jobs/board'
import {
  JOB_STATUS_OPTIONS,
  type JobStatus,
  type JobWorkflowResolvedAction,
} from '@/lib/jobs/types'
import type {
  StageEmailStage,
  StageEmailSentResult,
} from '@/app/crm/jobs/_components/StageEmailModal'

type JobsBoardDeps = {
  fetchJobList?: typeof fetchJobList
  patchJobStatus?: typeof patchJobStatus
  patchJobDateFields?: typeof patchJobDateFields
  confirm?: (message: string) => boolean
}

const columns: { key: JobStatus; title: string }[] = JOB_STATUS_OPTIONS.map((option) => ({
  key: option.value,
  title: option.title,
}))
const emptyJobs: JobSummary[] = []
const jobsBoardKey = '/api/jobs'

export function useJobsBoardPage(deps: JobsBoardDeps = {}) {
  const router = useRouter()
  const loadJobs = deps.fetchJobList ?? fetchJobList
  const saveStatus = deps.patchJobStatus ?? patchJobStatus
  const saveFields = deps.patchJobDateFields ?? patchJobDateFields
  const confirm = deps.confirm ?? ((message: string) => window.confirm(message))

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
  const jobsResource = useSwrResource<JobSummary[]>(jobsBoardKey, {
    fallbackData: emptyJobs,
    load: () => loadJobs(),
  })
  const saveStatusRef = useRef(saveStatus)
  const saveFieldsRef = useRef(saveFields)

  useEffect(() => {
    saveStatusRef.current = saveStatus
  }, [saveStatus])

  useEffect(() => {
    saveFieldsRef.current = saveFields
  }, [saveFields])

  const jobs = jobsResource.data ?? emptyJobs
  const loading = jobsResource.loading
  const error = jobsResource.error
  const setError = jobsResource.setError
  const setJobs = jobsResource.setData
  const load = jobsResource.refresh

  const grouped = useMemo(() => groupJobsByStatus(jobs), [jobs])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)')
    const apply = () => setCompactActions(media.matches)
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [])

  const patchJob = async (id: string, patch: Record<string, unknown>) => {
    try {
      const nextJob =
        typeof patch.status === 'string'
          ? await saveStatusRef.current(id, patch.status as JobStatus)
          : await saveFieldsRef.current(id, patch)
      setJobs((prev) => prev.map((job) => (job.id === id ? { ...job, ...nextJob } : job)))
      await invalidateSwrKey(jobsBoardKey)
      return (nextJob ?? null) as Partial<JobSummary> | null
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : 'Failed to update job.')
      return null
    }
  }

  const filteredCompleted = useMemo(
    () =>
      filterCompletedJobs({
        jobs: grouped.completed,
        query: completedQuery,
        showAll: showAllCompleted,
      }),
    [completedQuery, grouped.completed, showAllCompleted]
  )

  const visibleColumns = useMemo(
    () =>
      getVisibleJobBoardColumns({
        columns,
        grouped,
        showCompleted,
        showLost,
        showEmptyStages,
      }),
    [grouped, showCompleted, showLost, showEmptyStages]
  )

  const nowIso = () => new Date().toISOString()

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
      const patch = result.job as Partial<JobSummary>
      setJobs((prev) => prev.map((job) => (job.id === emailJobId ? { ...job, ...patch } : job)))
    }
    setNotice(result.warning ?? 'Email sent')
  }

  const openCloseout = (jobId: string) => {
    setError(null)
    setCloseoutJobId(jobId)
  }

  const closeCloseout = () => {
    setCloseoutJobId(null)
  }

  const handleCloseoutSaved = (result: { job?: Partial<JobSummary> | null; notice?: string | null }) => {
    setError(null)
    if (closeoutJobId && result.job) {
      setJobs((prev) =>
        prev.map((job) => (job.id === closeoutJobId ? { ...job, ...result.job } : job))
      )
    }
    if (result.notice) setNotice(result.notice)
  }

  const markCompletedAndPrompt = async (job: JobSummary) => {
    const updated = await patchJob(job.id, { completed_at: nowIso() })
    if (updated) {
      setNotice(null)
      setCloseoutJobId(job.id)
    }
  }

  const runBoardAction = async (job: JobSummary, action: JobWorkflowResolvedAction) => {
    if (action.confirmMessage && !confirm(action.confirmMessage)) return
    if (action.kind === 'navigate' && action.href) {
      router.push(action.href)
      return
    }
    if (action.kind === 'stage_email' && action.stage) {
      openStageEmail(job.id, action.stage)
      return
    }
    if (action.kind === 'open_closeout') {
      openCloseout(job.id)
      return
    }
    if (action.kind === 'patch_status' && action.status) {
      await patchJob(job.id, { status: action.status })
      return
    }
    if (action.kind === 'patch_date' && action.dateField === 'completed_at') {
      await markCompletedAndPrompt(job)
      return
    }
    if (action.kind === 'patch_date' && action.dateField === 'estimate_sent_at') {
      await patchJob(job.id, { estimate_sent_at: nowIso() })
    }
  }

  return {
    jobs,
    loading,
    error,
    notice,
    completedQuery,
    setCompletedQuery,
    showAllCompleted,
    setShowAllCompleted,
    showCompleted,
    setShowCompleted,
    showLost,
    setShowLost,
    showEmptyStages,
    setShowEmptyStages,
    compactActions,
    emailJobId,
    emailStage,
    closeoutJobId,
    grouped,
    filteredCompleted,
    visibleColumns,
    load,
    patchJob,
    runBoardAction,
    openStageEmail,
    closeStageEmail,
    handleStageEmailSent,
    openCloseout,
    closeCloseout,
    handleCloseoutSaved,
  }
}
