import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// This handles accidental GET requests (prevents 405 empty response)
export function GET() {
  return NextResponse.json(
    { error: 'Use POST' },
    { status: 405 }
  )
}

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization') || ''
  const match = authHeader.match(/^Bearer (.+)$/i)
  if (!match?.[1]) {
    return NextResponse.json({ error: 'Missing bearer token' }, { status: 401 })
  }

  const token = match[1]
  const body = await req.json().catch(() => null)

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
  if (userErr || !userData?.user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const user_id = userData.user.id
  const claimedUserId = body?.user_id
  if (claimedUserId && claimedUserId !== user_id) {
    return NextResponse.json({ error: 'user_id does not match token' }, { status: 403 })
  }

  // Check if membership already exists.
  const { data: existing, error: existingErr } = await supabaseAdmin
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user_id)
    .limit(1)
    .maybeSingle()


  if (existingErr) {
    return NextResponse.json(
      { error: existingErr.message },
      { status: 500 }
    )
  }

  if (existing) {
    return NextResponse.json({
      ok: true,
      membership: existing,
    })
  }

  // Create org
  const { data: org, error: orgErr } = await supabaseAdmin
    .from('orgs')
    .insert({
      name: 'ACE Painting',
      timezone: 'America/Chicago',
    })
    .select('id')
    .single()

  if (orgErr) {
    return NextResponse.json(
      { error: orgErr.message },
      { status: 500 }
    )
  }

  // Create org member (owner)
  const { error: memberErr } = await supabaseAdmin
    .from('org_members')
    .insert({
      org_id: org.id,
      user_id,
      role: 'owner',
    })

  if (memberErr) {
    return NextResponse.json(
      { error: memberErr.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    org_id: org.id,
    role: 'owner',
  })
}
