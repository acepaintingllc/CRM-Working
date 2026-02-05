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
  const id = (params as any)?.id
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
  const id = (params as any)?.id
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

  if (error) {
    return NextResponse.json(
      {
        error: error.message,
        details: (error as any).details ?? null,
        hint: (error as any).hint ?? null,
        code: (error as any).code ?? null,
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
