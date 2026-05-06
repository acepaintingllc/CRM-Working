import { invalidateSwrKey } from '@/app/crm/_hooks/swrCache'
import {
  fetchJobSchedules,
  loadJobRecord,
  type JobScheduleMutationResult,
} from '@/lib/jobs/client'
import type { JobDetail, JobScheduleMeta, ScheduleRow } from '@/types/jobs/api'

export type JobSchedulePageResource = {
  jobMeta: (JobDetail & JobScheduleMeta) | null
  rows: ScheduleRow[]
}

export type JobScheduleListItem = ScheduleRow & {
  rangeLabel: string
  calendarStatusLabel: string | null
}

export const emptyJobSchedulePageResource: JobSchedulePageResource = {
  jobMeta: null,
  rows: [],
}

export function getJobSchedulePageErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Failed to load schedule.'
}

export async function loadJobSchedulePageResource(jobId: string | null | undefined) {
  if (!jobId || typeof jobId !== 'string') {
    throw new Error('Missing job id in URL.')
  }

  const [rows, jobMeta] = await Promise.all([fetchJobSchedules(jobId), loadJobRecord(jobId)])

  return {
    rows,
    jobMeta: (jobMeta ?? null) as (JobDetail & JobScheduleMeta) | null,
  } satisfies JobSchedulePageResource
}

export function formatScheduleRange(row: ScheduleRow) {
  return `${new Date(row.start_at).toLocaleString()} - ${new Date(row.end_at).toLocaleString()}`
}

export function buildJobScheduleListItems(rows: ScheduleRow[]): JobScheduleListItem[] {
  return [...rows]
    .sort((a, b) => a.start_at.localeCompare(b.start_at))
    .map((row) => ({
      ...row,
      rangeLabel: formatScheduleRange(row),
      calendarStatusLabel: row.calendar_event_id ? 'Added to calendar' : null,
    }))
}

export async function invalidateJobScheduleResources(jobId: string) {
  await Promise.all([invalidateSwrKey(`/api/jobs/${jobId}`), invalidateSwrKey('/api/jobs')])
}

export function mutationNotice<T>(result: JobScheduleMutationResult<T> | null, fallback: string) {
  return result?.notice ?? fallback
}
