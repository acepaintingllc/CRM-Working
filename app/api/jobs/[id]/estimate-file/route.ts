import { NextResponse } from 'next/server'
import { supabaseAdmin, getSessionUserOrg } from '@/lib/server/org'
import { findLatestEstimateFile } from '@/lib/server/googleDrive'

export async function GET(
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
  const id = (params as any)?.id
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })
  }

  const { data: job, error: jobErr } = await supabaseAdmin
    .from('jobs')
    .select('id, customer_id')
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle()

  if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 })
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  const { data: customer } = await supabaseAdmin
    .from('customers')
    .select('address')
    .eq('org_id', orgId)
    .eq('id', (job as any).customer_id)
    .maybeSingle()

  if (!customer?.address) {
    return NextResponse.json({ error: 'Customer address missing' }, { status: 400 })
  }

  const origin = new URL(request.url).origin
  const result = await findLatestEstimateFile({
    origin,
    orgId,
    userId,
    address: customer.address,
  })

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ file: result.file })
}
