import { NextResponse } from 'next/server'
import { supabaseAdmin, getSessionUserOrg } from '@/lib/server/org'
import { getValidAccessToken, resolveCalendarId } from '@/lib/server/googleCalendar'
import { syncJobScheduleRange } from '@/lib/server/jobScheduleSync'
import { mutationResponse } from '@/lib/server/routeResult'
import { isUuid } from '@/lib/validation/uuid'

export async function DELETE(
  _request: Request,
  context: { params: { id: string; scheduleId: string } | Promise<{ id: string; scheduleId: string }> }
) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const { orgId, userId } = session
  const params = await Promise.resolve(context.params)
  const jobId = (params as { id?: string } | null | undefined)?.id
  const scheduleId = (params as { scheduleId?: string } | null | undefined)?.scheduleId

  if (!isUuid(jobId)) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })
  }
  if (!isUuid(scheduleId)) {
    return NextResponse.json({ error: 'Invalid schedule id' }, { status: 400 })
  }

  const { data: jobRow, error: jobErr } = await supabaseAdmin
    .from('jobs')
    .select('id, status')
    .eq('org_id', orgId)
    .eq('id', jobId)
    .maybeSingle()

  if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 })
  if (!jobRow) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  const { data: schedule, error: fetchErr } = await supabaseAdmin
    .from('job_schedules')
    .select('id, calendar_event_id')
    .eq('org_id', orgId)
    .eq('job_id', jobId)
    .eq('id', scheduleId)
    .maybeSingle()

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

  if (schedule?.calendar_event_id) {
    const origin = new URL(_request.url).origin
    const access = await getValidAccessToken({ origin, orgId, userId })
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: 400 })
    }

    const calendarId = await resolveCalendarId({
      accessToken: access.accessToken,
      calendarName: process.env.GOOGLE_WORK_CALENDAR_NAME ?? "Austin's work",
    })
    const deleteUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId
    )}/events/${encodeURIComponent(schedule.calendar_event_id)}`

    const res = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${access.accessToken}` },
    })

    if (!res.ok && res.status !== 404) {
      const json: Unsafe = await res.json().catch(() => null)
      return NextResponse.json({ error: json?.error?.message ?? 'Failed to delete calendar event' }, { status: 400 })
    }
  }

  const { error } = await supabaseAdmin
    .from('job_schedules')
    .delete()
    .eq('org_id', orgId)
    .eq('job_id', jobId)
    .eq('id', scheduleId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { error: syncErr } = await syncJobScheduleRange(orgId, jobId, {
    statusWhenSchedulesExist: 'scheduled',
    statusWhenEmpty: typeof jobRow.status === 'string' ? jobRow.status : undefined,
  })

  if (syncErr) return NextResponse.json({ error: syncErr.message }, { status: 500 })

  return mutationResponse(true, 'Schedule deleted.')
}
