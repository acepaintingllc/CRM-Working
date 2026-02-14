import { NextResponse } from 'next/server'
import { supabaseAdmin, getSessionUserOrg } from '@/lib/customers/api'

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type TimelineEvent = {
  id: string
  type: string
  title: string | null
  body: string
  created_at: string | null
  created_by: string | null
  link_path: string | null
  link_label: string | null
}

type JobRow = {
  id: string
  title: string | null
  status: string | null
  created_at: string | null
  estimate_date: string | null
  scheduled_date: string | null
  completed_at: string | null
}

type JobScheduleRow = {
  job_id: string
  start_at: string | null
  end_at: string | null
}

function fmt(iso: string | null | undefined) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

function addEvent(
  out: TimelineEvent[],
  job: JobRow,
  type: string,
  createdAt: string | null | undefined,
  title: string,
  body: string,
  linkPath: string | null = null,
  linkLabel: string | null = null
) {
  if (!createdAt) return
  out.push({
    id: `job-${job.id}-${type}-${createdAt}`,
    type,
    title,
    body,
    created_at: createdAt,
    created_by: null,
    link_path: linkPath,
    link_label: linkLabel,
  })
}

export async function GET(
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
  const id = (params as { id?: string } | null | undefined)?.id
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Missing customer id' }, { status: 400 })
  }
  if (!uuid.test(id)) {
    return NextResponse.json({ error: `Invalid customer id: ${id}` }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('customer_timeline')
    .select('id, type, title, body, created_at, created_by')
    .eq('org_id', orgId)
    .eq('customer_id', id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: jobData, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, title, status, created_at, estimate_date, scheduled_date, completed_at')
    .eq('org_id', orgId)
    .eq('customer_id', id)

  if (jobError) {
    return NextResponse.json({ error: jobError.message }, { status: 500 })
  }

  const jobIds = ((jobData ?? []) as JobRow[]).map((j) => j.id)
  const scheduleByJob = new Map<
    string,
    { minStart: string | null; maxEnd: string | null }
  >()

  if (jobIds.length > 0) {
    const { data: scheduleRows, error: scheduleError } = await supabaseAdmin
      .from('job_schedules')
      .select('job_id, start_at, end_at')
      .eq('org_id', orgId)
      .in('job_id', jobIds)

    if (scheduleError) {
      return NextResponse.json({ error: scheduleError.message }, { status: 500 })
    }

    for (const row of (scheduleRows ?? []) as JobScheduleRow[]) {
      const current = scheduleByJob.get(row.job_id) ?? { minStart: null, maxEnd: null }
      if (row.start_at && (!current.minStart || row.start_at < current.minStart)) {
        current.minStart = row.start_at
      }
      if (row.end_at && (!current.maxEnd || row.end_at > current.maxEnd)) {
        current.maxEnd = row.end_at
      }
      scheduleByJob.set(row.job_id, current)
    }
  }

  const jobEvents: TimelineEvent[] = []
  for (const row of (jobData ?? []) as JobRow[]) {
    const jobLabel = row.title?.trim() || 'Job'
    const scheduleRange = scheduleByJob.get(row.id)
    const scheduledStart = scheduleRange?.minStart ?? row.scheduled_date
    const scheduledEnd = scheduleRange?.maxEnd ?? null
    addEvent(
      jobEvents,
      row,
      'job_created',
      row.created_at,
      'Job created',
      `${jobLabel}\nStatus: ${(row.status ?? 'unknown').replaceAll('_', ' ')}`,
      `/crm/jobs/${row.id}`,
      'Open job'
    )
    addEvent(
      jobEvents,
      row,
      'estimate_scheduled',
      row.estimate_date,
      'Estimate scheduled',
      `${jobLabel}\nEstimate date: ${fmt(row.estimate_date) ?? row.estimate_date ?? ''}`,
      `/api/jobs/${row.id}/estimate-file?redirect=1`,
      'View estimate'
    )
    addEvent(
      jobEvents,
      row,
      'job_scheduled',
      scheduledStart,
      'Job scheduled',
      `${jobLabel}\nScheduled: ${fmt(scheduledStart) ?? scheduledStart ?? ''}${
        scheduledEnd ? ` - ${fmt(scheduledEnd) ?? scheduledEnd}` : ''
      }`,
      `/crm/jobs/${row.id}`,
      'Open job'
    )
    addEvent(
      jobEvents,
      row,
      'job_completed',
      row.completed_at,
      'Job completed',
      `${jobLabel}\nCompleted: ${fmt(row.completed_at) ?? row.completed_at ?? ''}`,
      `/crm/jobs/${row.id}`,
      'Open job'
    )
  }

  const noteEvents = ((data ?? []) as TimelineEvent[]).map((event) => ({
    ...event,
    link_path: null,
    link_label: null,
  }))

  const merged = [...noteEvents, ...jobEvents].sort((a, b) =>
    (b.created_at ?? '').localeCompare(a.created_at ?? '')
  )

  return NextResponse.json({ events: merged })
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

  const { orgId, userId } = session

  const params = await Promise.resolve(context.params)
  const id = (params as { id?: string } | null | undefined)?.id
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Missing customer id' }, { status: 400 })
  }
  if (!uuid.test(id)) {
    return NextResponse.json({ error: `Invalid customer id: ${id}` }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const text = body?.body?.toString()?.trim()
  if (!text) {
    return NextResponse.json({ error: 'Missing note body' }, { status: 400 })
  }

  const payload = {
    org_id: orgId,
    customer_id: id,
    created_by: userId,
    type: body?.type?.toString()?.trim() || 'note',
    title: body?.title?.toString()?.trim() || null,
    body: text,
  }

  const { data, error } = await supabaseAdmin
    .from('customer_timeline')
    .insert(payload)
    .select('id, type, title, body, created_at, created_by')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, event: data })
}
