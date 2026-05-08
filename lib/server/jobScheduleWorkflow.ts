import { supabaseAdmin } from '@/lib/server/org'
import { getValidAccessToken, resolveCalendarId } from '@/lib/server/googleCalendar'
import {
  EMPTY_SCHEDULE_FALLBACK_STATUS,
  syncJobScheduleRange,
} from '@/lib/server/jobScheduleSync'
import {
  normalizeScheduleDateTime,
  normalizeScheduleDateTimeBlock,
} from '@/lib/server/jobScheduleDateTime'
import { isJobStatus } from '@/lib/jobs/types'
import {
  errorResult,
  okResult,
  type ServiceResult,
} from '@/lib/server/serviceResult'
import type { CalendarAddResult, ScheduleRow } from '@/types/jobs/api'

export type CreateJobScheduleInput = {
  start_at: string
  end_at: string
  notes: string | null
}

type JobScheduleRecord = ScheduleRow

type JobScheduleCalendarRow = {
  id: string
  start_at: string | null
  end_at: string | null
  notes: string | null
  calendar_event_id: string | null
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : null
}

function getCalendarName() {
  return process.env.GOOGLE_WORK_CALENDAR_NAME ?? "Austin's work"
}

async function ensureJobExists(orgId: string, jobId: string) {
  const { data, error } = await supabaseAdmin
    .from('jobs')
    .select('id, status')
    .eq('org_id', orgId)
    .eq('id', jobId)
    .maybeSingle()

  if (error) return errorResult('server_error', error.message)
  if (!data) return errorResult('not_found', 'Job not found')
  return okResult(data as { id: string; status?: string | null })
}

function resolveEmptyScheduleStatus(currentStatus: string | null | undefined) {
  if (!isJobStatus(currentStatus)) return EMPTY_SCHEDULE_FALLBACK_STATUS
  if (currentStatus === 'scheduled') return EMPTY_SCHEDULE_FALLBACK_STATUS
  return currentStatus
}

export function normalizeCreateJobScheduleInput(
  input: unknown
): ServiceResult<CreateJobScheduleInput> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return errorResult('invalid_input', 'Invalid schedule payload')
  }

  const body = input as Record<string, unknown>
  const startRaw = typeof body.start_at === 'string' ? body.start_at.trim() : ''
  const endRaw = typeof body.end_at === 'string' ? body.end_at.trim() : ''
  if (!startRaw || !endRaw) {
    return errorResult('invalid_input', 'Missing start_at or end_at')
  }

  const startAt = normalizeScheduleDateTime(startRaw)
  const endAt = normalizeScheduleDateTime(endRaw)
  if (!startAt || !endAt) {
    return errorResult('invalid_input', 'Invalid start_at or end_at')
  }

  if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
    return errorResult('invalid_input', 'end_at must be after start_at')
  }

  const notes = typeof body.notes === 'string' ? body.notes.trim() : ''

  return okResult({
    start_at: startAt,
    end_at: endAt,
    notes: notes || null,
  })
}

export async function listJobSchedules(
  orgId: string,
  jobId: string
): Promise<ServiceResult<JobScheduleRecord[]>> {
  const job = await ensureJobExists(orgId, jobId)
  if (!job.ok) return job

  const { data, error } = await supabaseAdmin
    .from('job_schedules')
    .select('id, start_at, end_at, notes, calendar_event_id, calendar_added_at')
    .eq('org_id', orgId)
    .eq('job_id', jobId)
    .order('start_at', { ascending: false })

  if (error) return errorResult('server_error', error.message)
  return okResult((data ?? []) as JobScheduleRecord[])
}

export async function createJobSchedule(
  orgId: string,
  jobId: string,
  input: CreateJobScheduleInput
): Promise<ServiceResult<JobScheduleRecord>> {
  const job = await ensureJobExists(orgId, jobId)
  if (!job.ok) return job

  const { data, error } = await supabaseAdmin
    .from('job_schedules')
    .insert({
      org_id: orgId,
      job_id: jobId,
      start_at: input.start_at,
      end_at: input.end_at,
      notes: input.notes,
    })
    .select('id, start_at, end_at, notes, calendar_event_id, calendar_added_at')
    .single()

  if (error) return errorResult('server_error', error.message)

  const sync = await syncJobScheduleRange(orgId, jobId, {
    statusWhenSchedulesExist: 'scheduled',
  })
  if (sync.error) return errorResult('server_error', sync.error.message)

  return okResult(data as JobScheduleRecord)
}

export async function deleteJobSchedule(params: {
  orgId: string
  userId: string
  origin: string
  jobId: string
  scheduleId: string
}): Promise<ServiceResult<{ ok: true }>> {
  const job = await ensureJobExists(params.orgId, params.jobId)
  if (!job.ok) return job

  const { data: schedule, error: fetchError } = await supabaseAdmin
    .from('job_schedules')
    .select('id, calendar_event_id')
    .eq('org_id', params.orgId)
    .eq('job_id', params.jobId)
    .eq('id', params.scheduleId)
    .maybeSingle()

  if (fetchError) return errorResult('server_error', fetchError.message)
  if (!schedule) return errorResult('not_found', 'Schedule not found')

  const calendarEventId = asString((schedule as { calendar_event_id?: unknown } | null)?.calendar_event_id)
  if (calendarEventId) {
    const access = await getValidAccessToken({
      origin: params.origin,
      orgId: params.orgId,
      userId: params.userId,
    })
    if ('error' in access) return errorResult('invalid_input', access.error ?? 'Not connected')
    const accessToken = asString(access.accessToken)
    if (!accessToken) return errorResult('invalid_input', 'Not connected')

    const calendarId = await resolveCalendarId({
      accessToken,
      calendarName: getCalendarName(),
    })
    if (!calendarId) return errorResult('invalid_input', 'No calendars available')
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        calendarId
      )}/events/${encodeURIComponent(calendarEventId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )

    if (!response.ok && response.status !== 404) {
      const json = await response.json().catch(() => null) as { error?: { message?: string } } | null
      return errorResult('invalid_input', json?.error?.message ?? 'Failed to delete calendar event')
    }
  }

  const { error } = await supabaseAdmin
    .from('job_schedules')
    .delete()
    .eq('org_id', params.orgId)
    .eq('job_id', params.jobId)
    .eq('id', params.scheduleId)

  if (error) return errorResult('server_error', error.message)

  const sync = await syncJobScheduleRange(params.orgId, params.jobId, {
    statusWhenSchedulesExist: 'scheduled',
    statusWhenEmpty: resolveEmptyScheduleStatus(job.data.status),
  })
  if (sync.error) return errorResult('server_error', sync.error.message)

  return okResult({ ok: true })
}

export async function addJobSchedulesToCalendar(params: {
  orgId: string
  userId: string
  origin: string
  jobId: string
}): Promise<ServiceResult<CalendarAddResult[]>> {
  const access = await getValidAccessToken({
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
  })
  if ('error' in access) return errorResult('invalid_input', access.error ?? 'Not connected')
  const accessToken = asString(access.accessToken)
  if (!accessToken) return errorResult('invalid_input', 'Not connected')

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, title, customer_id')
    .eq('org_id', params.orgId)
    .eq('id', params.jobId)
    .maybeSingle()

  if (jobError) return errorResult('server_error', jobError.message)
  if (!job) return errorResult('not_found', 'Job not found')

  const customerId = asString((job as { customer_id?: unknown }).customer_id)
  const { data: customer, error: customerError } = customerId
    ? await supabaseAdmin
        .from('customers')
        .select('name, address')
        .eq('org_id', params.orgId)
        .eq('id', customerId)
        .maybeSingle()
    : { data: null, error: null }

  if (customerError) return errorResult('server_error', customerError.message)

  const { data: schedules, error: schedulesError } = await supabaseAdmin
    .from('job_schedules')
    .select('id, start_at, end_at, notes, calendar_event_id')
    .eq('org_id', params.orgId)
    .eq('job_id', params.jobId)
    .order('start_at', { ascending: true })

  if (schedulesError) return errorResult('server_error', schedulesError.message)
  if (!schedules || schedules.length === 0) {
    return errorResult('invalid_input', 'No scheduled blocks found.')
  }

  const calendarId = await resolveCalendarId({
    accessToken,
    calendarName: getCalendarName(),
  })
  if (!calendarId) return errorResult('invalid_input', 'No calendars available')
  const customerName = asString((customer as { name?: unknown } | null)?.name) ?? 'Customer'
  const customerAddress = asString((customer as { address?: unknown } | null)?.address)
  const results: CalendarAddResult[] = []

  for (const block of schedules as JobScheduleCalendarRow[]) {
    if (block.calendar_event_id) {
      results.push({ scheduleId: block.id, eventId: block.calendar_event_id, skipped: true })
      continue
    }

    const normalizedBlock = normalizeScheduleDateTimeBlock(block)
    if (!normalizedBlock) {
      return errorResult('invalid_input', 'Invalid persisted schedule start_at or end_at')
    }

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: `Job - ${customerName}`,
          description: [block.notes, customerAddress].filter(Boolean).join('\n') || undefined,
          location: customerAddress ?? undefined,
          start: { dateTime: normalizedBlock.startAt },
          end: { dateTime: normalizedBlock.endAt },
        }),
      }
    )

    const json = await response.json().catch(() => null) as { id?: string; error?: { message?: string } } | null
    if (!response.ok) {
      return errorResult('invalid_input', json?.error?.message ?? 'Failed to add calendar event')
    }

    const eventId = json?.id ?? null
    const update = await supabaseAdmin
      .from('job_schedules')
      .update({ calendar_event_id: eventId, calendar_added_at: new Date().toISOString() })
      .eq('org_id', params.orgId)
      .eq('job_id', params.jobId)
      .eq('id', block.id)

    if (update.error) return errorResult('server_error', update.error.message)
    results.push({ scheduleId: block.id, eventId, skipped: false })
  }

  const sync = await syncJobScheduleRange(params.orgId, params.jobId, {
    statusWhenSchedulesExist: 'scheduled',
  })
  if (sync.error) return errorResult('server_error', sync.error.message)

  return okResult(results)
}
