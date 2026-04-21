'use client'

import { authedFetch } from '@/lib/auth/authedFetch'
import type { EmailSendStatus } from '@/lib/email/types'
import { makeIdempotencyKey } from '@/lib/jobs/idempotency'
import { mapPaintLogRow, type PaintLogRow } from '@/lib/jobs/paintLog'
import type {
  JobCloseoutNotesPatchPayload,
  JobCompletionPatchPayload,
  JobEstimateDatePatchPayload,
  JobScheduleDatePatchPayload,
  JobStatus,
  JobStatusPatchPayload,
  StageEmailStage,
} from '@/lib/jobs/types'

type JsonRecord = Record<string, unknown>
type ParsedResponse<T> = {
  json: T | null
  text: string
}

export type JobSummary = {
  id: string
  customer_id: string | null
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
  linked_estimate_id?: string | null
  site_photo_count?: number
  has_site_photos?: boolean
}

export type JobDetail = {
  id: string
  customer_id: string | null
  customer_name: string | null
  customer_address: string | null
  customer_email: string | null
  customer_phone: string | null
  title: string
  description: string | null
  status: JobStatus
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
    version_name: string | null
    version_state: string | null
    version_kind: string | null
    version_sort_order: number | null
    updated_at: string | null
    created_at: string | null
  }>
}

export type EstimateDriveFile = {
  id: string
  name: string
  version?: number | null
  matchMode?: 'exact' | 'normalized' | 'manual' | string
  webViewLink?: string | null
}

export type JobPhoto = {
  id: string
  url: string
  caption: string | null
  captured_at: string | null
  uploaded_at: string | null
  created_at: string | null
}

export type SitePhoto = {
  id: string
  url: string
  caption: string | null
  captured_at: string | null
}

export type ScheduleRow = {
  id: string
  start_at: string
  end_at: string
  notes: string | null
  calendar_event_id: string | null
  calendar_added_at: string | null
}

export type JobScheduleMeta = {
  scheduled_email_sent_at?: string | null
}

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
  afterPhotos: JobPhoto[]
  sitePhotos: SitePhoto[]
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

export type UploadPhotoPayload = {
  file: File
  clientLocalId: string
  capturedAt?: string
  caption?: string | null
}

export type JobPhotoBundle = {
  afterPhotos: JobPhoto[]
  sitePhotos: SitePhoto[]
}

type EstimateFilePayload = {
  file?: EstimateDriveFile | null
  latest?: EstimateDriveFile | null
  files?: EstimateDriveFile[]
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

export async function parseResponseBody(response: Response) {
  const text = await response.text()
  if (!text) {
    return { json: null, text: '' } as ParsedResponse<unknown>
  }
  try {
    return { json: JSON.parse(text) as unknown, text } as ParsedResponse<unknown>
  } catch {
    return { json: null, text }
  }
}

function getPayloadError(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null
  const error = (payload as { error?: unknown }).error
  return typeof error === 'string' && error.trim() ? error : null
}

export function getResponseErrorMessage(
  response: Response,
  parsed: ParsedResponse<unknown>,
  fallback?: string
) {
  return (
    getPayloadError(parsed.json) ??
    (parsed.text.trim() ? parsed.text.trim() : null) ??
    fallback ??
    response.statusText
  )
}

async function requestJson<T>(input: string, init?: RequestInit) {
  const response = await authedFetch(input, init)
  const payload = await parseResponseBody(response)
  if (!response.ok) {
    throw new Error(getResponseErrorMessage(response, payload))
  }
  return payload.json as T
}

function normalizePhotos(rows: JobPhoto[]) {
  return rows.map((row) => ({
    id: row.id,
    url: row.url,
    caption: row.caption ?? null,
    captured_at: row.captured_at ?? null,
    uploaded_at: row.uploaded_at ?? null,
    created_at: row.created_at ?? null,
  }))
}

function toSitePhotos(rows: JobPhoto[]): SitePhoto[] {
  return rows.map((row) => ({
    id: row.id,
    url: row.url,
    caption: row.caption,
    captured_at: row.captured_at,
  }))
}

function normalizePhotoBundle(rows: JobPhoto[]): JobPhotoBundle {
  const afterPhotos = normalizePhotos(rows)
  return {
    afterPhotos,
    sitePhotos: toSitePhotos(afterPhotos),
  }
}

export async function fetchJobList() {
  const payload = await requestJson<{ jobs?: JobSummary[] }>('/api/jobs', { cache: 'no-store' })
  return (payload.jobs ?? []) as JobSummary[]
}

export async function fetchJobDetail(jobId: string) {
  const [jobPayload, estimateResponse, paintLogsPayload, photosPayload] = await Promise.all([
    requestJson<{ job?: JobDetail }>(`/api/jobs/${jobId}`, { cache: 'no-store' }),
    authedFetch(`/api/jobs/${jobId}/estimate-file`, { cache: 'no-store' }),
    requestJson<{ rows?: PaintLogRow[] }>(`/api/jobs/${jobId}/paint-logs`, { cache: 'no-store' }),
    requestJson<{ photos?: JobPhoto[] }>(`/api/jobs/${jobId}/site-photos`, { cache: 'no-store' }),
  ])

  const estimatePayload = await parseResponseBody(estimateResponse)
  const estimateFilePayload = estimatePayload.json as EstimateFilePayload | null
  const photoBundle = normalizePhotoBundle((photosPayload.photos ?? []) as JobPhoto[])

  return {
    job: (jobPayload.job ?? null) as JobDetail | null,
    estimateFile: (estimateFilePayload?.file ?? null) as EstimateDriveFile | null,
    estimateFileError:
      estimateFilePayload?.file == null
        ? estimateFilePayload?.error ?? 'No matching estimate in Drive folder'
        : null,
    paintLogs: ((paintLogsPayload.rows ?? []) as PaintLogRow[]).map((row) => mapPaintLogRow(row)),
    afterPhotos: photoBundle.afterPhotos,
    sitePhotos: photoBundle.sitePhotos,
  }
}

export async function patchJobStatus(jobId: string, status: JobStatusPatchPayload['status']) {
  const payload = await requestJson<{ job?: Partial<JobDetail> }>(`/api/jobs/${jobId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
  return (payload.job ?? null) as Partial<JobDetail> | null
}

export async function patchJobDateFields(
  jobId: string,
  fields:
    | JobEstimateDatePatchPayload
    | JobScheduleDatePatchPayload
    | JobCompletionPatchPayload
    | JobCloseoutNotesPatchPayload
    | Record<string, unknown>
) {
  const payload = await requestJson<{ job?: Partial<JobDetail> }>(`/api/jobs/${jobId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  })
  return (payload.job ?? null) as Partial<JobDetail> | null
}

export async function fetchJobSchedules(jobId: string) {
  const payload = await requestJson<{ schedules?: ScheduleRow[] }>(`/api/jobs/${jobId}/schedules`, {
    cache: 'no-store',
  })
  return (payload.schedules ?? []) as ScheduleRow[]
}

export async function addScheduleRow(
  jobId: string,
  payload: { start_at: string; end_at: string; notes?: string | null }
) {
  const result = await requestJson<{ schedule?: ScheduleRow }>(`/api/jobs/${jobId}/schedules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return (result.schedule ?? null) as ScheduleRow | null
}

export async function deleteScheduleRow(jobId: string, scheduleId: string) {
  await requestJson(`/api/jobs/${jobId}/schedules/${scheduleId}`, { method: 'DELETE' })
}

export async function listPhotos(jobId: string) {
  const payload = await requestJson<{ photos?: JobPhoto[] }>(`/api/jobs/${jobId}/site-photos`, {
    cache: 'no-store',
  })
  return normalizePhotoBundle((payload.photos ?? []) as JobPhoto[])
}

export async function uploadPhoto(jobId: string, payload: UploadPhotoPayload) {
  const form = new FormData()
  form.append('file', payload.file)
  form.append('client_local_id', payload.clientLocalId)
  form.append('captured_at', payload.capturedAt ?? new Date().toISOString())
  if (payload.caption) {
    form.append('caption', payload.caption)
  }

  const result = await requestJson<{ photo?: JobPhoto; duplicate?: boolean }>(
    `/api/jobs/${jobId}/site-photos`,
    {
      method: 'POST',
      body: form,
    }
  )

  return {
    duplicate: Boolean(result.duplicate),
    photo: (result.photo ?? null) as JobPhoto | null,
  }
}

export async function listPaintLogs(jobId: string) {
  const payload = await requestJson<{ rows?: PaintLogRow[] }>(`/api/jobs/${jobId}/paint-logs`, {
    cache: 'no-store',
  })
  return ((payload.rows ?? []) as PaintLogRow[]).map((row) => mapPaintLogRow(row))
}

export async function fetchStageEmailComposerData(jobId: string, stage: StageEmailStage) {
  const needsEstimateAttachment = stage === 'estimate_sent' || stage === 'follow_up'
  const requests: Array<Promise<Response>> = [
    authedFetch('/api/email-templates', { cache: 'no-store' }),
    authedFetch(`/api/jobs/${jobId}`, { cache: 'no-store' }),
  ]

  if (stage === 'scheduled') {
    requests.push(authedFetch(`/api/jobs/${jobId}/schedules`, { cache: 'no-store' }))
  }
  if (needsEstimateAttachment) {
    requests.push(authedFetch(`/api/jobs/${jobId}/estimate-file?all=1`, { cache: 'no-store' }))
  }

  const responses = await Promise.all(requests)
  const templatesRes = responses[0]
  const jobRes = responses[1]
  const scheduledRes = stage === 'scheduled' ? responses[2] : null
  const estimateRes = needsEstimateAttachment ? responses[responses.length - 1] : null

  const jobBody = await parseResponseBody(jobRes)
  const jobPayload = jobBody.json as { job?: JobDetail; error?: string } | null
  if (!jobRes.ok) {
    throw new Error(getResponseErrorMessage(jobRes, jobBody))
  }
  const job = (jobPayload?.job ?? null) as JobDetail | null
  if (!job) {
    throw new Error('Job not found.')
  }

  const templatesBody = await parseResponseBody(templatesRes)
  const templatesPayload = templatesBody.json as
    | { templates?: StageEmailTemplate[]; error?: string }
    | null
  const templates = (templatesPayload?.templates ?? []) as StageEmailTemplate[]
  const template = templates.find((row) => row.stage === stage) ?? null

  let scheduledBlocks = ''
  if (scheduledRes) {
    const scheduledPayload = (await parseResponseBody(scheduledRes)).json as
      | { schedules?: Array<{ start_at?: string | null; end_at?: string | null }> }
      | null
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

  let estimateFiles: EstimateDriveFile[] = []
  let selectedEstimateFileIds: string[] = []
  let estimateFileError: string | null = null
  if (estimateRes) {
    const estimatePayload = (await parseResponseBody(estimateRes)).json as EstimateFilePayload | null
    const files = Array.isArray(estimatePayload?.files)
      ? (estimatePayload.files as EstimateDriveFile[])
      : []
    const latest = (estimatePayload?.latest ?? null) as EstimateDriveFile | null
    if (estimateRes.ok && files.length > 0) {
      estimateFiles = files
      if (latest?.id && files.some((file) => file.id === latest.id)) {
        selectedEstimateFileIds = [latest.id]
      } else {
        selectedEstimateFileIds = [files[0].id]
      }
    } else if (estimateRes.ok && estimatePayload?.file) {
      const file = estimatePayload.file as EstimateDriveFile
      estimateFiles = [file]
      selectedEstimateFileIds = [file.id]
    } else {
      estimateFileError =
        typeof estimatePayload?.error === 'string'
          ? estimatePayload.error
          : 'No matching estimate file found in Drive.'
    }
  }

  const blockingIssues: string[] = []
  if (!templatesRes.ok) {
    blockingIssues.push(getResponseErrorMessage(templatesRes, templatesBody))
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
  const response = await requestJson<JsonRecord>(`/api/jobs/${jobId}/send-stage`, {
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
    status:
      (typeof response.status === 'string' ? (response.status as EmailSendStatus) : 'sent'),
    replayed: Boolean(response.replayed),
    job: (response.job ?? null) as Partial<JobDetail> | null,
    warning:
      (response.warning as string | null | undefined) ??
      (response.replayed
        ? 'This send request was already processed. No duplicate email was sent.'
        : null),
  } satisfies StageEmailSendResult
}

export async function fetchCloseoutData(jobId: string) {
  const [templatesRes, jobPayload, paintLogs, photos] = await Promise.all([
    authedFetch('/api/email-templates', { cache: 'no-store' }),
    requestJson<{ job?: JobDetail }>(`/api/jobs/${jobId}`, { cache: 'no-store' }),
    listPaintLogs(jobId),
    listPhotos(jobId),
  ])
  const templatesPayload = (await parseResponseBody(templatesRes)).json as
    | { templates?: StageEmailTemplate[] }
    | null

  const template =
    ((templatesPayload?.templates ?? []) as StageEmailTemplate[]).find(
      (row) => row.stage === 'completed'
    ) ?? null

  const job = (jobPayload.job ?? null) as JobDetail | null
  if (!job) {
    throw new Error('Job not found.')
  }

  return {
    job,
    template,
    paintLogs,
    afterPhotos: photos.afterPhotos,
    sitePhotos: photos.sitePhotos,
  } satisfies CloseoutData
}

export async function saveCloseout(jobId: string, payload: SaveCloseoutPayload) {
  const [paintPayload, notesPayload] = await Promise.all([
    requestJson<{ rows?: PaintLogRow[] }>(`/api/jobs/${jobId}/paint-logs`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: payload.rows }),
    }),
    requestJson<{ job?: Partial<JobDetail> }>(`/api/jobs/${jobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ closeout_notes: payload.closeout_notes }),
    }),
  ])

  return {
    job: (notesPayload.job ?? null) as Partial<JobDetail> | null,
    paintLogs: ((paintPayload.rows ?? []) as PaintLogRow[]).map((row) => mapPaintLogRow(row)),
  } satisfies SaveCloseoutResult
}
