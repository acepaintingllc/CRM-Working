import { NextResponse } from 'next/server'
import { supabaseAdmin, getSessionUserOrg } from '@/lib/server/org'
import { getValidAccessToken, resolveCalendarId } from '@/lib/server/googleCalendar'

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(
  request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const { orgId, userId } = session
  const params = await Promise.resolve(context.params)
  const jobId = (params as { id?: string } | null | undefined)?.id
  if (!jobId || typeof jobId !== 'string' || !uuid.test(jobId)) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })
  }

  const origin = new URL(request.url).origin
  const access = await getValidAccessToken({ origin, orgId, userId })
  if ('error' in access) {
    return NextResponse.json({ error: access.error }, { status: 400 })
  }

  const { data: job } = await supabaseAdmin
    .from('jobs')
    .select('id, title, customer_id')
    .eq('org_id', orgId)
    .eq('id', jobId)
    .maybeSingle()

  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  const { data: customer } = await supabaseAdmin
    .from('customers')
    .select('name, address')
    .eq('org_id', orgId)
    .eq('id', (job as Unsafe).customer_id)
    .maybeSingle()

  const { data: schedules, error: schedErr } = await supabaseAdmin
    .from('job_schedules')
    .select('id, start_at, end_at, notes, calendar_event_id')
    .eq('org_id', orgId)
    .eq('job_id', jobId)
    .order('start_at', { ascending: true })

  if (schedErr) return NextResponse.json({ error: schedErr.message }, { status: 500 })
  if (!schedules || schedules.length === 0) {
    return NextResponse.json({ error: 'No scheduled blocks found.' }, { status: 400 })
  }

  const calendarId = await resolveCalendarId({
    accessToken: access.accessToken,
    calendarName: "Austin's work",
  })

  const results: Unsafe[] = []
  const starts: string[] = []
  const ends: string[] = []
  for (const block of schedules) {
    if (block.start_at) starts.push(block.start_at)
    if (block.end_at) ends.push(block.end_at)
    if (block.calendar_event_id) {
      results.push({ scheduleId: block.id, eventId: block.calendar_event_id, skipped: true })
      continue
    }
    const summary = `Job - ${customer?.name ?? 'Customer'}`
    const description = [block.notes, customer?.address].filter(Boolean).join('\n') || undefined

    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary,
        description,
        location: customer?.address ?? undefined,
        start: { dateTime: block.start_at },
        end: { dateTime: block.end_at },
      }),
    })

    const json: Unsafe = await res.json().catch(() => null)
    if (!res.ok) {
      return NextResponse.json({ error: json?.error?.message ?? 'Failed to add calendar event' }, { status: 400 })
    }

    await supabaseAdmin
      .from('job_schedules')
      .update({ calendar_event_id: json?.id ?? null, calendar_added_at: new Date().toISOString() })
      .eq('org_id', orgId)
      .eq('job_id', jobId)
      .eq('id', block.id)

    results.push({ scheduleId: block.id, eventId: json?.id, skipped: false })
  }

  await supabaseAdmin
    .from('jobs')
    .update({
      status: 'scheduled',
      scheduled_date: starts.length > 0 ? starts.sort()[0] : null,
      scheduled_end_date: ends.length > 0 ? ends.sort()[ends.length - 1] : null,
    })
    .eq('org_id', orgId)
    .eq('id', jobId)

  return NextResponse.json({ ok: true, events: results })
}
