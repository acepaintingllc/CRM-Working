import { NextResponse } from 'next/server'
import { getSessionUserOrg, supabaseAdmin } from '@/lib/server/org'

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(
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

  const estimateRes = await supabaseAdmin
    .from('estimates')
    .select('id, job_id')
    .eq('org_id', session.orgId)
    .eq('id', id)
    .maybeSingle()
  if (estimateRes.error) return NextResponse.json({ error: estimateRes.error.message }, { status: 500 })
  if (!estimateRes.data) return NextResponse.json({ error: 'Estimate not found' }, { status: 404 })

  const jobId = estimateRes.data.job_id
  const orgId = session.orgId

  await supabaseAdmin.from('estimate_jobsettings').upsert(
    {
      org_id: orgId,
      estimate_id: id,
      job_id: jobId,
      walls_paint_id: 'A',
      ceiling_paint_id: 'A',
      trim_paint_id: 'A',
      primer_id: 'A',
      dayhours: 8,
      rounding_increment_hours: 4,
    },
    { onConflict: 'org_id,estimate_id' }
  )

  await supabaseAdmin.from('estimate_rooms').delete().eq('org_id', orgId).eq('estimate_id', id)
  const roomsInsert = await supabaseAdmin.from('estimate_rooms').insert([
    {
      org_id: orgId,
      estimate_id: id,
      job_id: jobId,
      position: 0,
      room_id: 'R1',
      room_name: 'Living Room',
      mode: 'RECT',
      length_in: 180,
      width_in: 144,
      wallheight_in: 96,
      ceilingheight_in: 96,
      walls_include: 'Y',
      walls_primer: 'Spot',
      walls_topcoats: 2,
      ceiling_include: 'Y',
      ceiling_primer: 'None',
      ceiling_topcoats: 1,
      trim_include: 'N',
      wall_color_id: 'A',
    },
  ])
  if (roomsInsert.error) {
    return NextResponse.json({ error: roomsInsert.error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
