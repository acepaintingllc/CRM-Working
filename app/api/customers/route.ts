import { NextResponse } from 'next/server'
import { supabaseAdmin, getSessionUserOrg } from '@/lib/customers/api'

export async function GET() {
  const session = await getSessionUserOrg()

  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const { orgId } = session

  const { data, error } = await supabaseAdmin
    .from('customers')
    .select('id, name, email, phone, address')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ customers: data ?? [] })
}

export async function POST(request: Request) {
  const session = await getSessionUserOrg()

  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const { orgId } = session
  const body = await request.json().catch(() => null)
  if (!body?.name) {
    return NextResponse.json({ error: 'Missing name' }, { status: 400 })
  }

  // Build payload based on columns that exist in your schema (avoid cache errors).
  const payload: Record<string, any> = {
    org_id: orgId,
    name: body.name,
    email: body.email ?? null,
    phone: body.phone ?? null,
  }

  const optionalColumns = ['address', 'street', 'city', 'state', 'zip', 'notes']
  for (const key of optionalColumns) {
    if (body[key] !== undefined && body[key] !== null) {
      payload[key] = body[key]
    }
  }
  if (!payload.address) {
    const parts = [
      payload.street,
      payload.city,
      [payload.state, payload.zip].filter(Boolean).join(' ').trim(),
    ].filter(Boolean)
    if (parts.length) {
      payload.address = parts.join(', ')
    }
  }

  const { data: existing, error: existingErr } = await supabaseAdmin
    .from('customers')
    .select('id, name, email, phone')
    .eq('org_id', orgId)

  if (existingErr) {
    return NextResponse.json(
      { error: existingErr.message },
      { status: 500 }
    )
  }

  const normalizedName = body.name.trim().toLowerCase()
  const normalizedEmail = body.email?.trim().toLowerCase()
  const normalizedPhone = body.phone?.trim()

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

  const insertOnce = async (p: Record<string, any>) =>
    supabaseAdmin.from('customers').insert(p).select('*').single()

  let { data, error } = await insertOnce(payload)

  // Strip unknown columns iteratively until insert succeeds or a non-schema error occurs.
  for (let i = 0; error && i < 6; i++) {
    const msg = error.message ?? ''
    const m =
      msg.match(/column \"([a-zA-Z0-9_]+)\" of relation \"customers\" does not exist/i) ||
      msg.match(/Could not find the '([a-zA-Z0-9_]+)' column of 'customers'/i)

    if (!m?.[1] || !(m[1] in payload)) break
    delete payload[m[1]]

    const retry = await insertOnce(payload)
    data = retry.data as any
    error = retry.error as any
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, customer: data })
}
