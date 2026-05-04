'use client'

import {
  loadData,
  mutateData,
  requestApi,
  type ApiDataEnvelope,
  type ApiMutationEnvelope,
} from '@/lib/client/api'
import type {
  CalendarAddResult,
  CreateJobPayload,
  JobCloseoutNotesPatchPayload,
  JobCompletionPatchPayload,
  JobEstimateDatePatchPayload,
  JobScheduleDatePatchPayload,
  JobStatusPatchPayload,
  JobCalendarEventPayload,
  JobDetail,
  JobSummary,
  ListJobSitePhotosResponse,
  ScheduleRow,
  UploadJobSitePhotosResponse,
} from '@/types/jobs/api'
import type {
  AcceptedEstimateSnapshotRepairResult,
  JobActualsDraftPayload,
  JobActualsRecord,
  JobReviewPayload,
  JobReviewReadModel,
} from '@/types/jobs/feedback'
import { mapPaintLogRow, type PaintLogRow } from '@/lib/jobs/paintLog'

function jobActualsPath(jobId: string, suffix = '') {
  return `/api/jobs/${encodeURIComponent(jobId)}/actuals${suffix}`
}

function jobReviewPath(jobId: string, suffix = '') {
  return `/api/jobs/${encodeURIComponent(jobId)}/review${suffix}`
}

function acceptedEstimateSnapshotPath(jobId: string) {
  return `/api/jobs/${encodeURIComponent(jobId)}/accepted-estimate/snapshot`
}

function snapshotBody(estimateSnapshotId: string) {
  return { estimate_snapshot_id: estimateSnapshotId }
}

export async function fetchJobList() {
  return loadData<JobSummary[]>('/api/jobs', { cache: 'no-store' })
}

export function getJobPhotosFolderUrl(folderId: string | null | undefined) {
  if (!folderId) return null
  return `https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}`
}

export async function listJobSitePhotos(jobId: string) {
  const payload = await requestApi<ApiDataEnvelope<ListJobSitePhotosResponse>>(
    `/api/jobs/${jobId}/site-photos`,
    { cache: 'no-store' }
  )
  return payload.data ?? null
}

export async function uploadJobSitePhotos(jobId: string, form: FormData) {
  return requestApi<ApiMutationEnvelope<UploadJobSitePhotosResponse>>(
    `/api/jobs/${jobId}/site-photos`,
    {
      method: 'POST',
      body: form,
    }
  )
}
export async function loadJobRecord(jobId: string) {
  const payload = await requestApi<ApiDataEnvelope<JobDetail>>(`/api/jobs/${jobId}`, {
    cache: 'no-store',
  })
  return (payload.data ?? null) as JobDetail | null
}

export async function loadJobActuals(jobId: string, estimateSnapshotId: string) {
  const search = new URLSearchParams({ estimateSnapshotId })
  return loadData<JobActualsRecord | null>(`${jobActualsPath(jobId)}?${search}`, {
    cache: 'no-store',
  })
}

export async function saveDraftJobActuals(jobId: string, payload: JobActualsDraftPayload) {
  return mutateData<JobActualsRecord>(jobActualsPath(jobId), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function submitJobActuals(jobId: string, estimateSnapshotId: string) {
  return requestApi<ApiMutationEnvelope<JobActualsRecord>>(jobActualsPath(jobId, '/submit'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(snapshotBody(estimateSnapshotId)),
  })
}

export async function lockJobActuals(jobId: string, estimateSnapshotId: string) {
  return requestApi<ApiMutationEnvelope<JobActualsRecord>>(jobActualsPath(jobId, '/lock'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(snapshotBody(estimateSnapshotId)),
  })
}

export async function loadJobReview(jobId: string, estimateSnapshotId: string) {
  const search = new URLSearchParams({ estimateSnapshotId })
  return loadData<JobReviewReadModel>(`${jobReviewPath(jobId)}?${search}`, {
    cache: 'no-store',
  })
}

export async function saveJobReview(jobId: string, payload: JobReviewPayload) {
  return mutateData<JobReviewReadModel>(jobReviewPath(jobId), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function lockJobReview(jobId: string, estimateSnapshotId: string) {
  return requestApi<ApiMutationEnvelope<JobReviewReadModel>>(jobReviewPath(jobId, '/lock'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(snapshotBody(estimateSnapshotId)),
  })
}

export async function repairAcceptedEstimateSnapshot(jobId: string) {
  return requestApi<ApiMutationEnvelope<AcceptedEstimateSnapshotRepairResult>>(
    acceptedEstimateSnapshotPath(jobId),
    {
      method: 'POST',
    }
  )
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
