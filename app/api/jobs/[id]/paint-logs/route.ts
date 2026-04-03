import { NextResponse } from 'next/server'
import { getSessionUserOrg, supabaseAdmin } from '@/lib/server/org'

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type PaintLogInput = {
  where_used?: unknown
  paint_product?: unknown
  sheen?: unknown
  color?: unknown
  notes?: unknown
}

function asNullableText(value: unknown, maxLength = 500) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, maxLength)
}

async function ensureJobExists(orgId: string, jobId: string) {
  const { data, error } = await supabaseAdmin
    .from('jobs')
    .select('id')
    .eq('org_id', orgId)
    .eq('id', jobId)
    .maybeSingle()
  if (error) return { error: error.message } as const
  if (!data) return { error: 'Job not found' } as const
  return { ok: true } as const
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

  const params = await Promise.resolve(context.params)
  const jobId = params?.id
  if (!jobId || !uuid.test(jobId)) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })
  }

  const exists = await ensureJobExists(session.orgId, jobId)
  if ('error' in exists) {
    const status = exists.error === 'Job not found' ? 404 : 500
    return NextResponse.json({ error: exists.error }, { status })
  }

  const { data, error } = await supabaseAdmin
    .from('job_paint_logs')
    .select('id, sort_order, where_used, paint_product, sheen, color, notes, created_at, updated_at')
    .eq('org_id', session.orgId)
    .eq('job_id', jobId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rows: data ?? [] })
}

export async function PUT(
  request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const params = await Promise.resolve(context.params)
  const jobId = params?.id
  if (!jobId || !uuid.test(jobId)) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })
  }

  const exists = await ensureJobExists(session.orgId, jobId)
  if ('error' in exists) {
    const status = exists.error === 'Job not found' ? 404 : 500
    return NextResponse.json({ error: exists.error }, { status })
  }

  const body = await request.json().catch(() => null)
  const rowsInput = Array.isArray(body?.rows) ? (body.rows as PaintLogInput[]) : null
  if (!rowsInput) {
    return NextResponse.json({ error: 'rows must be an array' }, { status: 400 })
  }
  if (rowsInput.length > 100) {
    return NextResponse.json({ error: 'Too many rows' }, { status: 400 })
  }

  const normalized = rowsInput.map((row) => ({
    where_used: asNullableText(row?.where_used, 200),
    paint_product: asNullableText(row?.paint_product, 200),
    sheen: asNullableText(row?.sheen, 120),
    color: asNullableText(row?.color, 200),
    notes: asNullableText(row?.notes, 600),
  }))

  const { error: replaceError } = await supabaseAdmin.rpc('replace_job_paint_logs', {
    p_org_id: session.orgId,
    p_job_id: jobId,
    p_rows: normalized,
  })
  if (replaceError) {
    return NextResponse.json({ error: replaceError.message }, { status: 500 })
  }

  const { data, error } = await supabaseAdmin
    .from('job_paint_logs')
    .select('id, sort_order, where_used, paint_product, sheen, color, notes, created_at, updated_at')
    .eq('org_id', session.orgId)
    .eq('job_id', jobId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, rows: data ?? [] })
}
