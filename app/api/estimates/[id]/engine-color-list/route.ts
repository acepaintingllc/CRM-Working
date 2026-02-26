import { NextResponse } from 'next/server'
import { getSessionUserOrg, supabaseAdmin } from '@/lib/server/org'

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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
  const id = (params as { id?: Unsafe } | null | undefined)?.id
  if (!id || typeof id !== 'string' || !uuid.test(id)) {
    return NextResponse.json({ error: 'Invalid estimate id' }, { status: 400 })
  }

  const res = await supabaseAdmin
    .from('estimates')
    .select('id, latest_output_json')
    .eq('org_id', session.orgId)
    .eq('id', id)
    .maybeSingle()
  if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 })
  if (!res.data) return NextResponse.json({ error: 'Estimate not found' }, { status: 404 })

  return NextResponse.json({
    engine_color_list: res.data.latest_output_json?.engine_color_list ?? null,
    updated_at: res.data.latest_output_json?.updated_at ?? null,
  })
}

