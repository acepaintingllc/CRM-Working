import { NextResponse } from 'next/server'
import { supabaseAdmin, getSessionUserOrg } from '@/lib/customers/api'


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

  // Basic UUID v4-ish validation to avoid sending "undefined" etc to Postgres.
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (!uuid.test(id)) {
    return NextResponse.json(
      { error: `Invalid customer id: ${id}` },
      { status: 400 }
    )
  }

  const { data, error } = await supabaseAdmin
    .from('customers')
    .select('id, name, email, phone, address, created_at')
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  return NextResponse.json({ customer: data })
}

export async function DELETE(
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

  // Basic UUID v4-ish validation to avoid sending "undefined" etc to Postgres.
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (!uuid.test(id)) {
    return NextResponse.json(
      { error: `Invalid customer id: ${id}` },
      { status: 400 }
    )
  }

  const { error } = await supabaseAdmin
    .from('customers')
    .delete()
    .eq('org_id', orgId)
    .eq('id', id)

  if (error) return NextResponse.json({ error: 'Unable to delete customer' }, { status: 500 })

  return NextResponse.json({ ok: true })
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
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Missing customer id' }, { status: 400 })
  }

  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (!uuid.test(id)) {
    return NextResponse.json(
      { error: `Invalid customer id: ${id}` },
      { status: 400 }
    )
  }

  const body = await request.json().catch(() => null)
  if (!body?.name || typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ error: 'Missing name' }, { status: 400 })
  }

  const payload: Record<string, unknown> = {
    name: body.name.trim(),
    email: body.email?.trim() || null,
    phone: body.phone?.trim() || null,
    address: body.address?.trim() || null,
  }

  const optionalColumns = ['street', 'city', 'state', 'zip', 'notes']
  for (const key of optionalColumns) {
    if (body[key] !== undefined && body[key] !== null) {
      payload[key] = typeof body[key] === 'string' ? body[key].trim() || null : body[key]
    }
  }
  if (!payload.address) {
    const parts = [
      payload.street,
      payload.city,
      [payload.state, payload.zip].filter(Boolean).join(' ').trim(),
    ].filter(Boolean)
    if (parts.length) payload.address = parts.join(', ')
  }

  const { data: existing, error: existingErr } = await supabaseAdmin
    .from('customers')
    .select('id, name, email, phone')
    .eq('org_id', orgId)
    .neq('id', id)

  if (existingErr) {
    return NextResponse.json({ error: existingErr.message }, { status: 500 })
  }

  const normalizedName = String(payload.name ?? '').trim().toLowerCase()
  const normalizedEmail = payload.email ? String(payload.email).trim().toLowerCase() : null
  const normalizedPhone = payload.phone ? String(payload.phone).trim() : null

  const duplicate = (existing ?? []).find((row) => {
    const rowName = row.name?.trim().toLowerCase() ?? ''
    const rowEmail = row.email?.trim().toLowerCase()
    const rowPhone = row.phone?.trim()
    return (
      rowName === normalizedName ||
      (normalizedEmail && rowEmail === normalizedEmail) ||
      (normalizedPhone && rowPhone === normalizedPhone)
    )
  })

  if (duplicate) {
    return NextResponse.json(
      { error: 'A customer with the same name, email, or phone already exists.' },
      { status: 409 }
    )
  }

  const updateOnce = async (p: Record<string, unknown>) =>
    supabaseAdmin
      .from('customers')
      .update(p)
      .eq('org_id', orgId)
      .eq('id', id)
      .select('*')
      .maybeSingle()

  let { data, error } = await updateOnce(payload)

  for (let i = 0; error && i < 6; i++) {
    const msg = error.message ?? ''
    const m =
      msg.match(/column \"([a-zA-Z0-9_]+)\" of relation \"customers\" does not exist/i) ||
      msg.match(/Could not find the '([a-zA-Z0-9_]+)' column of 'customers'/i)
    if (!m?.[1] || !(m[1] in payload)) break
    delete payload[m[1]]
    const retry = await updateOnce(payload)
    data = retry.data
    error = retry.error
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, customer: data })
}
