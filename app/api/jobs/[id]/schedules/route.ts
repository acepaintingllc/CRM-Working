import { NextResponse } from 'next/server'
import { supabaseAdmin, getSessionUserOrg } from '@/lib/server/org'
import { readJsonBody } from '@/lib/server/apiRoute'

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isMissingJobsColumnError(message: string, column: string) {
  return (
    message.includes(`Could not find the '${column}' column of 'jobs' in the schema cache`) ||
    message.includes(`column "${column}" of relation "jobs" does not exist`)
  )
}

async function updateJobScheduleRangeCompat(
  orgId: string,
  jobId: string,
  payload: { status: string; scheduled_date: string | null; scheduled_end_date: string | null }
) {
  const first = await supabaseAdmin
    .from('jobs')
    .update(payload)
    .eq('org_id', orgId)
    .eq('id', jobId)

  if (!first.error) return first
  if (!isMissingJobsColumnError(first.error.message ?? '', 'scheduled_end_date')) return first

  const retryPayload = {
    status: payload.status,
    scheduled_date: payload.scheduled_date,
  }

  return supabaseAdmin
    .from('jobs')
    .update(retryPayload)
    .eq('org_id', orgId)
    .eq('id', jobId)
}

export async function GET(
  _request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const { orgId } = session
  const params = await Promise.resolve(context.params)
  const jobId = (params as { id?: string } | null | undefined)?.id
  if (!jobId || typeof jobId !== 'string' || !uuid.test(jobId)) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('job_schedules')
    .select('id, start_at, end_at, notes, calendar_event_id, calendar_added_at')
    .eq('org_id', orgId)
    .eq('job_id', jobId)
    .order('start_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ schedules: data ?? [] })
}

export async function POST(
  request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const { orgId } = session
  const params = await Promise.resolve(context.params)
  const jobId = (params as { id?: string } | null | undefined)?.id
  if (!jobId || typeof jobId !== 'string' || !uuid.test(jobId)) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })
  }

  const parsed = await readJsonBody<Record<string, unknown>>(request, { maxBytes: 64 * 1024 })
  if (!parsed.ok) return parsed.response
  const body = parsed.value
  const startAt = typeof body.start_at === 'string' ? body.start_at : ''
  const endAt = typeof body.end_at === 'string' ? body.end_at : ''
  if (!startAt || !endAt) {
    return NextResponse.json({ error: 'Missing start_at or end_at' }, { status: 400 })
  }

  const { data: jobRow, error: jobErr } = await supabaseAdmin
    .from('jobs')
    .select('id, org_id')
    .eq('org_id', orgId)
    .eq('id', jobId)
    .maybeSingle()

  if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 })
  if (!jobRow) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  const { data, error } = await supabaseAdmin
    .from('job_schedules')
    .insert({
      org_id: orgId,
      job_id: jobId,
      start_at: startAt,
      end_at: endAt,
      notes: typeof body.notes === 'string' ? body.notes : null,
    })
    .select('id, start_at, end_at, notes, calendar_event_id, calendar_added_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: allRows, error: allRowsErr } = await supabaseAdmin
    .from('job_schedules')
    .select('start_at, end_at')
    .eq('org_id', orgId)
    .eq('job_id', jobId)

  if (allRowsErr) return NextResponse.json({ error: allRowsErr.message }, { status: 500 })

  const starts = (allRows ?? [])
    .map((r) => r.start_at)
    .filter((v): v is string => typeof v === 'string')
    .sort()
  const ends = (allRows ?? [])
    .map((r) => r.end_at)
    .filter((v): v is string => typeof v === 'string')
    .sort()

  const scheduledDate = starts[0] ?? startAt
  const scheduledEndDate = ends[ends.length - 1] ?? endAt

  const { error: updateErr } = await updateJobScheduleRangeCompat(orgId, jobId, {
    status: 'scheduled',
    scheduled_date: scheduledDate,
    scheduled_end_date: scheduledEndDate,
  })

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, schedule: data })
}
