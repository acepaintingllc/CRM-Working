'use client'

import {
  loadData,
  mutateData,
  requestApi,
  type ApiDataEnvelope,
  type ApiMutationEnvelope,
} from '@/lib/client/api'
import { mapPaintLogRow, type PaintLogRow } from '@/lib/jobs/paintLog'
import type {
  JobCloseoutNotesPatchPayload,
  JobCompletionPatchPayload,
  JobEstimateDatePatchPayload,
  JobScheduleDatePatchPayload,
  JobStatus,
  JobStatusPatchPayload,
} from '@/lib/jobs/types'

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

export type CreateJobPayload = {
  customer_id: string
  title: string
  description: string | null
  status: JobStatus
  estimate_date: string | null
  scheduled_date: string | null
}

export type JobCalendarEventPayload = {
  summary: string
  location?: string | null
  description?: string | null
  startIso: string
  endIso: string
}

export type CalendarAddResult = {
  scheduleId: string
  eventId?: string | null
  skipped?: boolean
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
  return loadData<JobSummary[]>('/api/jobs', { cache: 'no-store' })
}

export async function loadJobRecord(jobId: string) {
  const payload = await requestApi<ApiDataEnvelope<JobDetail>>(`/api/jobs/${jobId}`, {
    cache: 'no-store',
  })
  return (payload.data ?? null) as JobDetail | null
}

export async function patchJobStatus(jobId: string, status: JobStatusPatchPayload['status']) {
  const payload = await requestApi<ApiMutationEnvelope<Partial<JobDetail>>>(`/api/jobs/${jobId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
  return (payload.data ?? null) as Partial<JobDetail> | null
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
  const payload = await requestApi<ApiMutationEnvelope<Partial<JobDetail>>>(`/api/jobs/${jobId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  })
  return (payload.data ?? null) as Partial<JobDetail> | null
}

export async function fetchJobSchedules(jobId: string) {
  return loadData<ScheduleRow[]>(`/api/jobs/${jobId}/schedules`, { cache: 'no-store' })
}

export async function addScheduleRow(
  jobId: string,
  payload: { start_at: string; end_at: string; notes?: string | null }
) {
  const result = await mutateData<ScheduleRow>(`/api/jobs/${jobId}/schedules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return result.data ?? null
}

export async function deleteScheduleRow(jobId: string, scheduleId: string) {
  await mutateData<boolean>(`/api/jobs/${jobId}/schedules/${scheduleId}`, { method: 'DELETE' })
}

export async function listPhotos(jobId: string) {
  const photos = await loadData<JobPhoto[]>(`/api/jobs/${jobId}/site-photos`, {
    cache: 'no-store',
  })
  return normalizePhotoBundle(photos)
}

export async function uploadPhoto(jobId: string, payload: UploadPhotoPayload) {
  const form = new FormData()
  form.append('file', payload.file)
  form.append('client_local_id', payload.clientLocalId)
  form.append('captured_at', payload.capturedAt ?? new Date().toISOString())
  if (payload.caption) {
    form.append('caption', payload.caption)
  }

  const result = await mutateData<{ photo?: JobPhoto | null; duplicate?: boolean }>(
    `/api/jobs/${jobId}/site-photos`,
    {
      method: 'POST',
      body: form,
    }
  )

  return {
    duplicate: Boolean(result.data?.duplicate),
    photo: (result.data?.photo ?? null) as JobPhoto | null,
  }
}

export async function listPaintLogs(jobId: string) {
  const payload = await loadData<PaintLogRow[]>(`/api/jobs/${jobId}/paint-logs`, {
    cache: 'no-store',
  })
  return payload.map((row) => mapPaintLogRow(row))
}

export async function createJob(payload: CreateJobPayload) {
  const result = await requestApi<ApiMutationEnvelope<JobSummary>>('/api/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  return (result.data ?? null) as JobSummary | null
}

export async function deleteJob(jobId: string) {
  return requestApi<ApiMutationEnvelope<{ ok: true }>>(`/api/jobs/${jobId}`, {
    method: 'DELETE',
  })
}

export async function loadJobEstimateDate(jobId: string) {
  const payload = await requestApi<ApiDataEnvelope<{ estimate_date?: string | null }>>(
    `/api/jobs/${jobId}`,
    { cache: 'no-store' }
  )
  return payload.data?.estimate_date ?? null
}

export async function saveJobEstimateDate(jobId: string, estimateDate: string) {
  const payload = await requestApi<ApiMutationEnvelope<Partial<JobDetail>>>(`/api/jobs/${jobId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estimate_date: estimateDate, status: 'estimate_scheduled' }),
  })
  return (payload.data ?? null) as Partial<JobDetail> | null
}

export async function createGoogleCalendarEvent(payload: JobCalendarEventPayload) {
  const result = await mutateData<{ event?: unknown }>('/api/google-calendar/create-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      calendar_name: "Austin's work",
      summary: payload.summary,
      location: payload.location ?? undefined,
      description: payload.description ?? undefined,
      start: payload.startIso,
      end: payload.endIso,
    }),
  })

  return result.data?.event ?? null
}

export async function addSchedulesToCalendar(jobId: string) {
  const payload = await mutateData<CalendarAddResult[]>(
    `/api/jobs/${jobId}/schedules/add-to-calendar`,
    {
      method: 'POST',
    }
  )
  return payload.data ?? []
}
