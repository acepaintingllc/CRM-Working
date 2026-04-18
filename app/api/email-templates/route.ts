import { NextResponse } from 'next/server'
import { supabaseAdmin, getSessionUserOrg } from '@/lib/server/org'
import { readJsonBody } from '@/lib/server/apiRoute'

export async function GET() {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const { orgId } = session
  const { data, error } = await supabaseAdmin
    .from('email_templates')
    .select('stage, subject, body')
    .eq('org_id', orgId)

  if (error) {
    const msg = error.message ?? ''
    if (msg.includes("Could not find the 'stage' column of 'email_templates'")) {
      return NextResponse.json(
        { error: 'Email templates table is missing. Run supabase/sql/004_email_templates.sql and reload the schema cache.' },
        { status: 500 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ templates: data ?? [] })
}

export async function PUT(request: Request) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const { orgId } = session
  const parsed = await readJsonBody<Record<string, unknown>>(request, { maxBytes: 64 * 1024 })
  if (!parsed.ok) return parsed.response
  const body = parsed.value
  const stage = typeof body.stage === 'string' ? body.stage.trim() : ''
  if (!stage) {
    return NextResponse.json({ error: 'Missing stage' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('email_templates')
    .upsert(
      {
        org_id: orgId,
        stage,
        name: stage,
        subject: typeof body.subject === 'string' ? body.subject : String(body.subject ?? ''),
        body: typeof body.body === 'string' ? body.body : String(body.body ?? ''),
      },
      { onConflict: 'org_id,stage' }
    )

  if (error) {
    const msg = error.message ?? ''
    if (msg.includes("Could not find the 'stage' column of 'email_templates'")) {
      return NextResponse.json(
        { error: 'Email templates table is missing. Run supabase/sql/004_email_templates.sql and reload the schema cache.' },
        { status: 500 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
