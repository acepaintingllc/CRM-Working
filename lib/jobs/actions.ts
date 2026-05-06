'use client'

import type { EmailSendStatus } from '@/lib/email/types'
import { loadEmailTemplates } from '@/lib/emailTemplates/api'
import type { PaintLogRow } from '@/lib/jobs/paintLog'
import {
  loadStageEmailSchedules,
  loadLatestJobEstimateFile,
  loadMatchingJobEstimateFiles,
  listPaintLogs,
  loadJobRecord,
  patchJobCloseoutNotes,
  saveCloseoutPaintLogs,
  sendJobStageEmail,
} from '@/lib/jobs/client'
import type { EstimateDriveFile, JobDetail } from '@/types/jobs/api'
import type { StageEmailStage } from '@/lib/jobs/types'

export type StageEmailTemplate = {
  stage: string
  subject: string | null
  body: string | null
}

export type StageEmailComposerData = {
  job: JobDetail
  template: StageEmailTemplate | null
  scheduledBlocks: string
  estimateFiles: EstimateDriveFile[]
  selectedEstimateFileIds: string[]
  blockingIssues: string[]
}

export type StageEmailSendPayload = {
  stage: StageEmailStage
  subject: string
  body: string
  estimateFileIds?: string[]
  idempotencyKey?: string
}

export type StageEmailSendResult = {
  job?: Partial<JobDetail> | null
  stage: StageEmailStage
  status: EmailSendStatus
  replayed: boolean
  notice?: string | null
  warning?: string | null
}

export type CloseoutData = {
  job: JobDetail
  template: StageEmailTemplate | null
  paintLogs: PaintLogRow[]
}

export type SaveCloseoutPayload = {
  rows: Array<{
    where_used: string
    paint_product: string
    sheen: string
    color: string
    notes: string
  }>
  closeout_notes: string | null
}

export type SaveCloseoutResult = {
  job: Partial<JobDetail> | null
  paintLogs: PaintLogRow[]
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

export async function fetchJobDetail(jobId: string) {
  const [job, estimateState, paintLogs] = await Promise.all([
    loadJobRecord(jobId),
    loadLatestJobEstimateFile(jobId),
    listPaintLogs(jobId),
  ])

  return {
    job,
    estimateFile: estimateState.estimateFile,
    estimateFileError: estimateState.estimateFileError,
    paintLogs,
  }
}

export async function fetchStageEmailComposerData(jobId: string, stage: StageEmailStage) {
  const needsEstimateAttachment = stage === 'estimate_sent' || stage === 'follow_up'
  const [templates, job, scheduledRows, estimateFileState] = await Promise.all([
    loadEmailTemplates().catch((error) => error),
    loadJobRecord(jobId),
    stage === 'scheduled' ? loadStageEmailSchedules(jobId) : null,
    needsEstimateAttachment
      ? loadMatchingJobEstimateFiles(jobId)
      : null,
  ])

  if (!job) {
    throw new Error('Job not found.')
  }
  const templateList = templates instanceof Error ? [] : (templates as StageEmailTemplate[])
  const template = templateList.find((row) => row.stage === stage) ?? null

  let scheduledBlocks = ''
  if (scheduledRows) {
    scheduledBlocks = (scheduledRows as Array<{
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

  let estimateFiles: EstimateDriveFile[] = []
  let selectedEstimateFileIds: string[] = []
  let estimateFileError: string | null = null
  if (estimateFileState) {
    estimateFiles = estimateFileState.estimateFiles
    estimateFileError = estimateFileState.estimateFileError
    if (estimateFiles.length > 0) {
      const latest = estimateFileState.latestEstimateFile
      if (latest?.id && estimateFiles.some((file) => file.id === latest.id)) {
        selectedEstimateFileIds = [latest.id]
      } else {
        selectedEstimateFileIds = [estimateFiles[0].id]
      }
    }
  }

  const blockingIssues: string[] = []
  if (templates instanceof Error) {
    blockingIssues.push(templates.message)
  } else if (!template) {
    const label = stage === 'completed' ? 'review' : stage.replaceAll('_', ' ')
    blockingIssues.push(`Missing ${label} email template. Add one in Email templates before sending.`)
  }
  if (!job.customer_email) {
    blockingIssues.push('Customer email is missing for this job.')
  }
  if (needsEstimateAttachment && estimateFiles.length === 0) {
    blockingIssues.push(estimateFileError ?? 'No matching quote file found in Drive folder.')
  }

  return {
    job,
    template,
    scheduledBlocks: scheduledBlocks || formatRange(job.scheduled_date, job.scheduled_end_date),
    estimateFiles,
    selectedEstimateFileIds,
    blockingIssues,
  } satisfies StageEmailComposerData
}

export async function sendStageEmail(jobId: string, payload: StageEmailSendPayload) {
  const response = await sendJobStageEmail(jobId, payload)

  return {
    stage: payload.stage,
    status: response?.status ?? 'sent',
    replayed: Boolean(response?.replayed),
    job: (response?.job ?? null) as Partial<JobDetail> | null,
    notice:
      response?.notice ??
      (response?.replayed
        ? 'This send request was already processed. No duplicate email was sent.'
        : null),
    warning:
      response?.warning ?? null,
  } satisfies StageEmailSendResult
}

export async function fetchCloseoutData(jobId: string) {
  const [templates, job, paintLogs] = await Promise.all([
    loadEmailTemplates().catch((error) => error),
    loadJobRecord(jobId),
    listPaintLogs(jobId),
  ])
  const templateList = templates instanceof Error ? [] : (templates as StageEmailTemplate[])
  const template = templateList.find((row) => row.stage === 'completed') ?? null
  if (!job) {
    throw new Error('Job not found.')
  }

  return {
    job,
    template,
    paintLogs,
  } satisfies CloseoutData
}

export async function saveCloseout(jobId: string, payload: SaveCloseoutPayload) {
  const [paintPayload, notesPayload] = await Promise.all([
    saveCloseoutPaintLogs(jobId, { rows: payload.rows }),
    patchJobCloseoutNotes(jobId, payload.closeout_notes),
  ])

  return {
    job: (notesPayload ?? null) as Partial<JobDetail> | null,
    paintLogs: paintPayload,
  } satisfies SaveCloseoutResult
}
