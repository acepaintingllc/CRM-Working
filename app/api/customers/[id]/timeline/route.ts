import { NextResponse } from 'next/server'
import { supabaseAdmin, getSessionUserOrg } from '@/lib/customers/api'

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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

  return NextResponse.json({ events: data ?? [] })
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
