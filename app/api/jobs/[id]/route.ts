import { NextResponse } from 'next/server'
import { supabaseAdmin, getSessionUserOrg } from '@/lib/server/org'

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type JobPatch = {
  completed_at?: string | null
  scheduled_date?: string | null
  estimate_sent_at?: string | null
  estimate_date?: string | null
}

type JobRecord = {
  id: string
  status: string
  scheduled_date?: string | null
  scheduled_end_date?: string | null
  customer_id?: string | null
  [key: string]: unknown
}

type ScheduleRecord = { start_at: string | null; end_at: string | null }
type CustomerRecord = { name: string | null; address: string | null; email?: string | null; phone?: string | null }
type LinkedEstimateRecord = {
  id: string
  status: string | null
  sheet_file_path: string | null
  updated_at: string | null
  created_at: string | null
}

async function updateJobCompat(orgId: string, id: string, patch: Record<string, unknown>) {
  const nextPatch = { ...patch }
  for (let i = 0; i < 8; i++) {
    const attempt = await supabaseAdmin
      .from('jobs')
      .update(nextPatch)
      .eq('org_id', orgId)
      .eq('id', id)
      .select('*')
      .single()
    if (!attempt.error) return attempt

    const missingByCache = attempt.error.message.match(
      /Could not find the '([a-zA-Z0-9_]+)' column of 'jobs' in the schema cache/i
    )
    const missingByRelation = attempt.error.message.match(
      /column "([a-zA-Z0-9_]+)" of relation "jobs" does not exist/i
    )
    const missing = missingByCache?.[1] ?? missingByRelation?.[1] ?? null
    if (!missing || !(missing in nextPatch)) {
      return attempt
    }
    delete nextPatch[missing]
  }

  return supabaseAdmin
    .from('jobs')
    .update(patch)
    .eq('org_id', orgId)
    .eq('id', id)
    .select('*')
    .single()
}

function nextStatusForPatch(current: string, patch: JobPatch) {
  if (patch?.completed_at) return 'completed'
  if (patch?.scheduled_date) return 'scheduled'
  if (patch?.estimate_sent_at) return 'estimate_sent'
  if (patch?.estimate_date) return 'estimate_scheduled'
  return current
}

export async function PATCH(
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
  if (!id || typeof id !== 'string' || !uuid.test(id)) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Missing body' }, { status: 400 })
  }

  const allowed: Record<string, unknown> = {}
  for (const key of [
    'title',
    'description',
    'status',
    'estimate_date',
    'estimate_sent_at',
    'scheduled_date',
    'scheduled_end_date',
    'completed_at',
    'closeout_notes',
  ]) {
    if (key in body) allowed[key] = body[key]
  }

  const { data: existing, error: existingErr } = await supabaseAdmin
    .from('jobs')
    .select('id, status')
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle()

  if (existingErr) return NextResponse.json({ error: existingErr.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  // Auto-move if dates/flags are set, unless caller explicitly sets status.
  if (!('status' in allowed)) {
    allowed.status = nextStatusForPatch(existing.status, allowed as JobPatch)
  }

  const { data, error } = await updateJobCompat(orgId, id, allowed)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, job: data })
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
  const id = (params as { id?: string } | null | undefined)?.id
  if (!id || typeof id !== 'string' || !uuid.test(id)) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })
  }

  const { data: job, error } = await supabaseAdmin
    .from('jobs')
    .select('*')
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  const mutableJob = job as JobRecord
  if (!mutableJob.scheduled_date || !mutableJob.scheduled_end_date) {
    const { data: schedules } = await supabaseAdmin
      .from('job_schedules')
      .select('start_at, end_at')
      .eq('org_id', orgId)
      .eq('job_id', id)
      .order('start_at', { ascending: true })

    if (schedules && schedules.length > 0) {
      const starts = (schedules as ScheduleRecord[]).map((s) => s.start_at).filter(Boolean).sort()
      const ends = (schedules as ScheduleRecord[]).map((s) => s.end_at).filter(Boolean).sort()
      const scheduled_date = starts.length > 0 ? starts[0] : null
      const scheduled_end_date = ends.length > 0 ? ends[ends.length - 1] : null

      const { data: updated } = await updateJobCompat(orgId, id, {
        scheduled_date,
        scheduled_end_date,
      })

      if (updated) {
        mutableJob.scheduled_date = (updated as JobRecord).scheduled_date ?? null
        mutableJob.scheduled_end_date = (updated as JobRecord).scheduled_end_date ?? null
      } else {
        mutableJob.scheduled_date = scheduled_date
        mutableJob.scheduled_end_date = scheduled_end_date
      }
    }
  }

  let customer: { name: string | null; address: string | null; email?: string | null; phone?: string | null } | null = null
  if (mutableJob.customer_id) {
    const { data: customerRow } = await supabaseAdmin
      .from('customers')
      .select('id, name, address, email, phone')
      .eq('org_id', orgId)
      .eq('id', mutableJob.customer_id)
      .maybeSingle()
    if (customerRow) {
      customer = {
        name: (customerRow as CustomerRecord).name ?? null,
        address: (customerRow as CustomerRecord).address ?? null,
        email: (customerRow as CustomerRecord).email ?? null,
        phone: (customerRow as CustomerRecord).phone ?? null,
      }
    }
  }

  const { data: linkedEstimateRows, error: linkedEstimatesErr } = await supabaseAdmin
    .from('estimates')
    .select('id, status, sheet_file_path, updated_at, created_at')
    .eq('org_id', orgId)
    .eq('job_id', id)
    .order('updated_at', { ascending: false })
  if (linkedEstimatesErr) {
    return NextResponse.json({ error: linkedEstimatesErr.message }, { status: 500 })
  }

  const linkedEstimates = (linkedEstimateRows ?? []) as LinkedEstimateRecord[]

  return NextResponse.json({
    job: {
      ...job,
      customer_name: customer?.name ?? null,
      customer_address: customer?.address ?? null,
      customer_email: customer?.email ?? null,
      customer_phone: customer?.phone ?? null,
      linked_estimates: linkedEstimates,
      linked_estimate_id: linkedEstimates[0]?.id ?? null,
    },
  })
}

export async function DELETE(
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
  const id = (params as { id?: string } | null | undefined)?.id
  if (!id || typeof id !== 'string' || !uuid.test(id)) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('jobs')
    .delete()
    .eq('org_id', orgId)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
