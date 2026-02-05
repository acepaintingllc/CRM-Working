import { NextResponse } from 'next/server'
import { supabaseAdmin, getSessionUserOrg } from '@/lib/server/org'

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function nextStatusForPatch(current: string, patch: any) {
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
  const id = (params as any)?.id
  if (!id || typeof id !== 'string' || !uuid.test(id)) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Missing body' }, { status: 400 })
  }

  const allowed: Record<string, any> = {}
  for (const key of [
    'title',
    'description',
    'status',
    'estimate_date',
    'estimate_sent_at',
    'scheduled_date',
    'scheduled_end_date',
    'completed_at',
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
    allowed.status = nextStatusForPatch(existing.status, allowed)
  }

  const { data, error } = await supabaseAdmin
    .from('jobs')
    .update(allowed)
    .eq('org_id', orgId)
    .eq('id', id)
    // Use "*" to avoid schema-cache failures when columns are still being added/migrated.
    .select('*')
    .single()

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
  const id = (params as any)?.id
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

  if (!(job as any).scheduled_date || !(job as any).scheduled_end_date) {
    const { data: schedules } = await supabaseAdmin
      .from('job_schedules')
      .select('start_at, end_at')
      .eq('org_id', orgId)
      .eq('job_id', id)
      .order('start_at', { ascending: true })

    if (schedules && schedules.length > 0) {
      const starts = schedules.map((s: any) => s.start_at).filter(Boolean).sort()
      const ends = schedules.map((s: any) => s.end_at).filter(Boolean).sort()
      const scheduled_date = starts.length > 0 ? starts[0] : null
      const scheduled_end_date = ends.length > 0 ? ends[ends.length - 1] : null

      const { data: updated } = await supabaseAdmin
        .from('jobs')
        .update({ scheduled_date, scheduled_end_date })
        .eq('org_id', orgId)
        .eq('id', id)
        .select('*')
        .maybeSingle()

      if (updated) {
        ;(job as any).scheduled_date = (updated as any).scheduled_date
        ;(job as any).scheduled_end_date = (updated as any).scheduled_end_date
      } else {
        ;(job as any).scheduled_date = scheduled_date
        ;(job as any).scheduled_end_date = scheduled_end_date
      }
    }
  }

  let customer: { name: string | null; address: string | null; email?: string | null; phone?: string | null } | null = null
  if ((job as any).customer_id) {
    const { data: customerRow } = await supabaseAdmin
      .from('customers')
      .select('id, name, address, email, phone')
      .eq('org_id', orgId)
      .eq('id', (job as any).customer_id)
      .maybeSingle()
    if (customerRow) {
      customer = {
        name: (customerRow as any).name ?? null,
        address: (customerRow as any).address ?? null,
        email: (customerRow as any).email ?? null,
        phone: (customerRow as any).phone ?? null,
      }
    }
  }

  return NextResponse.json({
    job: {
      ...job,
      customer_name: customer?.name ?? null,
      customer_address: customer?.address ?? null,
      customer_email: customer?.email ?? null,
      customer_phone: customer?.phone ?? null,
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
  const id = (params as any)?.id
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
