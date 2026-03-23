import { NextResponse } from 'next/server'
import { supabaseAdmin, getSessionUserOrg } from '@/lib/server/org'
import { findLatestEstimateFile } from '@/lib/server/googleDrive'

type JobRecord = { customer_id: string | null }

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
  const id = (params as { id?: string } | null | undefined)?.id
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

  const jobRow = job as JobRecord
  const { data: customer } = await supabaseAdmin
    .from('customers')
    .select('address')
    .eq('org_id', orgId)
    .eq('id', jobRow.customer_id)
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
    console.warn('[estimate-file] no-match', { jobId: id, reason: result.error })
    return NextResponse.json({ error: result.error }, { status: 404 })
  }
  console.info('[estimate-file] selected', {
    jobId: id,
    fileId: result.file.id,
    fileName: result.file.name,
    version: result.file.version ?? null,
    matchMode: result.file.matchMode ?? null,
  })

  const url = new URL(request.url)
  const shouldRedirect = url.searchParams.get('redirect') === '1'
  if (shouldRedirect && result.file.webViewLink) {
    return NextResponse.redirect(result.file.webViewLink)
  }

  return NextResponse.json({ file: result.file })
}
