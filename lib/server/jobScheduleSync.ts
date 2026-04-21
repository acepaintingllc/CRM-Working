import { supabaseAdmin } from '@/lib/server/org'
import {
  buildJobSelect,
  filterOptionalJobColumnPayload,
  getAvailableOptionalJobColumns,
  withOptionalJobColumns,
} from '@/lib/server/jobSchema'
import { JOB_EMAIL_STAGE_RULES, type StageEmailStage } from '@/lib/jobs/types'

type ScheduleRow = {
  start_at: string | null
  end_at: string | null
}

function isMissingJobsColumnError(message: string, column: string) {
  return (
    message.includes(`Could not find the '${column}' column of 'jobs' in the schema cache`) ||
    message.includes(`column "${column}" of relation "jobs" does not exist`)
  )
}

export function deriveJobScheduleRange(rows: ScheduleRow[]) {
  const starts = rows
    .map((row) => row.start_at)
    .filter((value): value is string => typeof value === 'string')
    .sort()
  const ends = rows
    .map((row) => row.end_at)
    .filter((value): value is string => typeof value === 'string')
    .sort()

  return {
    hasSchedules: starts.length > 0 || ends.length > 0,
    scheduled_date: starts[0] ?? null,
    scheduled_end_date: ends[ends.length - 1] ?? null,
  }
}

export async function updateJobScheduleRangeCompat(
  orgId: string,
  jobId: string,
  payload: { scheduled_date: string | null; scheduled_end_date: string | null; status?: string }
) {
  const firstPayload: Record<string, string | null> = {
    scheduled_date: payload.scheduled_date,
    scheduled_end_date: payload.scheduled_end_date,
  }
  if (payload.status !== undefined) {
    firstPayload.status = payload.status
  }

  const first = await supabaseAdmin
    .from('jobs')
    .update(firstPayload)
    .eq('org_id', orgId)
    .eq('id', jobId)

  if (!first.error) return first
  if (!isMissingJobsColumnError(first.error.message ?? '', 'scheduled_end_date')) return first

  const retryPayload: Record<string, string | null> = {
    scheduled_date: payload.scheduled_date,
  }
  if (payload.status !== undefined) {
    retryPayload.status = payload.status
  }

  return supabaseAdmin
    .from('jobs')
    .update(retryPayload)
    .eq('org_id', orgId)
    .eq('id', jobId)
}

async function updateJobFieldsCompat(orgId: string, jobId: string, payload: Record<string, unknown>) {
  if (Object.keys(payload).length === 0) {
    return { error: null }
  }

  const optionalJobColumns = await getAvailableOptionalJobColumns()
  const filteredPayload = filterOptionalJobColumnPayload(payload, optionalJobColumns)
  const first = await supabaseAdmin
    .from('jobs')
    .update(filteredPayload)
    .eq('org_id', orgId)
    .eq('id', jobId)

  if (!first.error) return { error: null }
  if (!('scheduled_end_date' in filteredPayload)) {
    return { error: first.error }
  }
  if (!isMissingJobsColumnError(first.error.message ?? '', 'scheduled_end_date')) {
    return { error: first.error }
  }

  const retryPayload = { ...filteredPayload }
  delete retryPayload.scheduled_end_date

  const retry = await supabaseAdmin
    .from('jobs')
    .update(retryPayload)
    .eq('org_id', orgId)
    .eq('id', jobId)

  return { error: retry.error ?? null }
}

async function getJobStageSyncSnapshot(orgId: string, jobId: string) {
  const optionalJobColumns = await getAvailableOptionalJobColumns()
  const jobSelect = buildJobSelect(
    [
      'id',
      'customer_id',
      'title',
      'status',
      'completed_at',
      'estimate_date',
      'estimate_sent_at',
      'scheduled_date',
      'scheduled_end_date',
      'created_at',
      'updated_at',
    ],
    optionalJobColumns
  )

  const { data, error } = await supabaseAdmin
    .from('jobs')
    .select(jobSelect)
    .eq('org_id', orgId)
    .eq('id', jobId)
    .maybeSingle()

  if (error) {
    return { error, job: null }
  }

  return {
    error: null,
    job: withOptionalJobColumns((data ?? null) as Record<string, unknown> | null, optionalJobColumns),
  }
}

export async function syncJobScheduleRange(
  orgId: string,
  jobId: string,
  options?: {
    statusWhenSchedulesExist?: string
    statusWhenEmpty?: string
    extraPayload?: Record<string, unknown>
  }
) {
  const { data: scheduleRows, error: scheduleErr } = await supabaseAdmin
    .from('job_schedules')
    .select('start_at, end_at')
    .eq('org_id', orgId)
    .eq('job_id', jobId)

  if (scheduleErr) {
    return { error: scheduleErr }
  }

  const range = deriveJobScheduleRange((scheduleRows ?? []) as ScheduleRow[])
  const status =
    range.hasSchedules ? options?.statusWhenSchedulesExist : options?.statusWhenEmpty

  const payload: Record<string, unknown> = {
    scheduled_date: range.scheduled_date,
    scheduled_end_date: range.scheduled_end_date,
    ...(options?.extraPayload ?? {}),
  }
  if (status !== undefined) {
    payload.status = status
  }

  const update = await updateJobFieldsCompat(orgId, jobId, payload)

  if (update.error) {
    return { error: update.error }
  }

  return { error: null, range }
}

export async function applyJobStageSideEffect(
  orgId: string,
  jobId: string,
  options: {
    stage: Extract<StageEmailStage, 'estimate_sent' | 'scheduled' | 'completed'>
    sentAt: string
    statusWhenEmpty?: string
  }
) {
  const rule = JOB_EMAIL_STAGE_RULES[options.stage]
  const extraPayload =
    rule.timestampField
      ? {
          [rule.timestampField]: options.sentAt,
        }
      : {}

  if (rule.syncScheduleSummary) {
    const sync = await syncJobScheduleRange(orgId, jobId, {
      statusWhenSchedulesExist: rule.status,
      statusWhenEmpty: options.statusWhenEmpty,
      extraPayload,
    })
    if (sync.error) {
      return { error: sync.error, job: null, range: null }
    }

    const snapshot = await getJobStageSyncSnapshot(orgId, jobId)
    return {
      error: snapshot.error,
      job: snapshot.job,
      range: sync.range,
    }
  }

  const payload: Record<string, unknown> = { ...extraPayload }
  if (rule.status) {
    payload.status = rule.status
  }

  const update = await updateJobFieldsCompat(orgId, jobId, payload)
  if (update.error) {
    return { error: update.error, job: null, range: null }
  }

  const snapshot = await getJobStageSyncSnapshot(orgId, jobId)
  return {
    error: snapshot.error,
    job: snapshot.job,
    range: null,
  }
}
