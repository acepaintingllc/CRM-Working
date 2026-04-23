'use client'

import { authedFetch } from '@/lib/auth/authedFetch'
import {
  type ApiMutationEnvelope,
  getApiErrorMessage,
  loadData,
  mutateData,
  parseApiResponse,
  requestApi,
  type ParsedApiResponse,
} from '@/lib/client/api'
import type { EmailSendStatus } from '@/lib/email/types'
import { loadEmailTemplates } from '@/lib/emailTemplates/api'
import { makeIdempotencyKey } from '@/lib/jobs/idempotency'
import { mapPaintLogRow, type PaintLogRow } from '@/lib/jobs/paintLog'
import {
  listPaintLogs,
  loadJobRecord,
  type EstimateDriveFile,
  type JobDetail,
} from '@/lib/jobs/client'
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

type EstimateFilePayload = {
  data?:
    | {
        file?: EstimateDriveFile | null
        latest?: EstimateDriveFile | null
        files?: EstimateDriveFile[]
      }
    | EstimateDriveFile
  error?: string
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

function getPayloadError(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null
  const error = (payload as { error?: unknown }).error
  return typeof error === 'string' && error.trim() ? error : null
}

export const parseResponseBody = parseApiResponse

export function getResponseErrorMessage(
  response: Response,
  parsed: ParsedApiResponse<unknown>,
  fallback?: string
) {
  return getPayloadError(parsed.json) ?? getApiErrorMessage(response, parsed, fallback)
}

export async function fetchJobDetail(jobId: string) {
  const [job, estimateResponse, paintLogs] = await Promise.all([
    loadJobRecord(jobId),
    authedFetch(`/api/jobs/${jobId}/estimate-file`, { cache: 'no-store' }),
    listPaintLogs(jobId),
  ])

  const estimatePayload = await parseResponseBody(estimateResponse)
  const estimateFilePayload = estimatePayload.json as EstimateFilePayload | null
  const estimateFileData =
    estimateFilePayload?.data && typeof estimateFilePayload.data === 'object'
      ? estimateFilePayload.data
      : null

  return {
    job,
    estimateFile: ((estimateFileData as { file?: EstimateDriveFile | null } | null)?.file ??
      (estimateFilePayload?.data && !Array.isArray(estimateFilePayload.data)
        ? (estimateFilePayload.data as EstimateDriveFile)
        : null)) as EstimateDriveFile | null,
    estimateFileError:
      (((estimateFileData as { file?: EstimateDriveFile | null } | null)?.file ??
        estimateFilePayload?.data) == null)
        ? estimateFilePayload?.error ?? 'No matching estimate in Drive folder'
        : null,
    paintLogs,
  }
}

export async function fetchStageEmailComposerData(jobId: string, stage: StageEmailStage) {
  const needsEstimateAttachment = stage === 'estimate_sent' || stage === 'follow_up'
  const [templates, job, scheduledRows, estimateFileResponse] = await Promise.all([
    loadEmailTemplates().catch((error) => error),
    loadJobRecord(jobId),
    stage === 'scheduled'
      ? loadData<Array<{ start_at?: string | null; end_at?: string | null }>>(
          `/api/jobs/${jobId}/schedules`,
          { cache: 'no-store' }
        )
      : null,
    needsEstimateAttachment
      ? authedFetch(`/api/jobs/${jobId}/estimate-file?all=1`, { cache: 'no-store' })
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
  if (estimateFileResponse) {
    const estimatePayload = await parseResponseBody(estimateFileResponse)
    const estimateResponsePayload = estimatePayload.json as EstimateFilePayload | null
    const estimateResponseData =
      estimateResponsePayload?.data && typeof estimateResponsePayload.data === 'object'
        ? estimateResponsePayload.data
        : null
    const files = Array.isArray((estimateResponseData as { files?: EstimateDriveFile[] } | null)?.files)
      ? (((estimateResponseData as { files?: EstimateDriveFile[] }).files ?? []) as EstimateDriveFile[])
      : []
    const latest = ((estimateResponseData as { latest?: EstimateDriveFile | null } | null)?.latest ??
      null) as EstimateDriveFile | null
    if (files.length > 0) {
      estimateFiles = files
      if (latest?.id && files.some((file) => file.id === latest.id)) {
        selectedEstimateFileIds = [latest.id]
      } else {
        selectedEstimateFileIds = [files[0].id]
      }
    } else if (estimateFileResponse.ok && estimateResponseData && 'file' in estimateResponseData) {
      const file = (estimateResponseData as { file?: EstimateDriveFile }).file as EstimateDriveFile
      estimateFiles = [file]
      selectedEstimateFileIds = [file.id]
    } else {
      estimateFileError =
        typeof estimateResponsePayload?.error === 'string'
          ? estimateResponsePayload.error
          : 'No matching estimate file found in Drive.'
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
    blockingIssues.push(estimateFileError ?? 'No matching estimate file found in Drive.')
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
  const response = await mutateData<{
    status?: EmailSendStatus
    replayed?: boolean
    job?: Partial<JobDetail> | null
    warning?: string | null
  }>(`/api/jobs/${jobId}/send-stage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      stage: payload.stage,
      subject: payload.subject,
      body: payload.body,
      idempotency_key: payload.idempotencyKey ?? makeIdempotencyKey(payload.stage, jobId),
      estimate_file_ids: payload.estimateFileIds,
    }),
  })

  return {
    stage: payload.stage,
    status: response.data?.status ?? 'sent',
    replayed: Boolean(response.data?.replayed),
    job: (response.data?.job ?? null) as Partial<JobDetail> | null,
    warning:
      response.data?.warning ??
      (response.data?.replayed
        ? 'This send request was already processed. No duplicate email was sent.'
        : null),
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
    mutateData<PaintLogRow[]>(`/api/jobs/${jobId}/paint-logs`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: payload.rows }),
    }),
    requestApi<ApiMutationEnvelope<Partial<JobDetail>>>(`/api/jobs/${jobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ closeout_notes: payload.closeout_notes }),
    }),
  ])

  return {
    job: (notesPayload.data ?? null) as Partial<JobDetail> | null,
    paintLogs: (paintPayload.data ?? []).map((row) => mapPaintLogRow(row)),
  } satisfies SaveCloseoutResult
}
