import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization') || ''
  const match = authHeader.match(/^Bearer (.+)$/i)

  if (!match?.[1]) {
    return NextResponse.json({ error: 'Missing bearer token' }, { status: 401 })
  }

  const token = match[1]

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
  if (userErr || !userData?.user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const userId = userData.user.id

  const { data: membership, error: memErr } = await supabaseAdmin
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (memErr) {
    return NextResponse.json({ error: memErr.message }, { status: 500 })
  }

  if (!membership) {
    return NextResponse.json({ org_id: null, role: null }, { status: 200 })
  }

  return NextResponse.json(
    { org_id: membership.org_id, role: membership.role },
    { status: 200 }
  )
}
