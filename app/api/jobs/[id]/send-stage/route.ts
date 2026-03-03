import { NextResponse } from 'next/server'
import { supabaseAdmin, getSessionUserOrg } from '@/lib/server/org'
import { sendGmailMessage } from '@/lib/server/googleMail'
import { downloadDriveFile, findLatestEstimateFile } from '@/lib/server/googleDrive'

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function applyTemplate(template: string, vars: Record<string, string | null | undefined>) {
  let output = template
  for (const [key, value] of Object.entries(vars)) {
    const safe = value ?? ''
    output = output.replaceAll(`{{${key}}}`, safe)
  }
  return output
}

function withAliases(vars: Record<string, string | null | undefined>) {
  return {
    ...vars,
    customer_name: vars.customerName,
    customer_email: vars.customerEmail,
    customer_phone: vars.customerPhone,
    customer_address: vars.customerAddress,
    job_title: vars.jobTitle,
    estimate_date: vars.estimateDate,
    scheduled_date: vars.scheduledDate,
    scheduled_blocks: vars.scheduledBlocks,
    estimate_file_name: vars.estimateFileName,
    estimate_file_link: vars.estimateFileLink,
    review_link: vars.reviewLink,
  }
}

type JobRecord = {
  customer_id: string | null
  title: string | null
  estimate_date: string | null
  scheduled_date: string | null
}

type ScheduleRow = { start_at: string | null; end_at: string | null }

function missingJobsColumnFromError(message: string) {
  const byCache = message.match(/Could not find the '([a-zA-Z0-9_]+)' column of 'jobs' in the schema cache/i)
  if (byCache?.[1]) return byCache[1]
  const byRelation = message.match(/column "([a-zA-Z0-9_]+)" of relation "jobs" does not exist/i)
  if (byRelation?.[1]) return byRelation[1]
  return null
}

async function updateJobCompat(
  orgId: string,
  jobId: string,
  payload: Record<string, unknown>
) {
  const patch = { ...payload }
  for (let i = 0; i < 6; i++) {
    const attempt = await supabaseAdmin
      .from('jobs')
      .update(patch)
      .eq('org_id', orgId)
      .eq('id', jobId)
      .select('*')
      .single()
    if (!attempt.error) return attempt

    const missingColumn = missingJobsColumnFromError(attempt.error.message ?? '')
    if (!missingColumn || !(missingColumn in patch)) return attempt
    delete patch[missingColumn]
  }

  return supabaseAdmin
    .from('jobs')
    .update(payload)
    .eq('org_id', orgId)
    .eq('id', jobId)
    .select('*')
    .single()
}

export async function POST(
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
  if (!id || typeof id !== 'string' || !uuid.test(id)) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const stage = body?.stage as string | undefined
  const subjectOverride = body?.subject as string | undefined
  const bodyOverride = body?.body as string | undefined
  if (!stage) {
    return NextResponse.json({ error: 'Missing stage' }, { status: 400 })
  }

  const { data: job, error: jobErr } = await supabaseAdmin
    .from('jobs')
    .select('*')
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle()

  if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 })
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  const jobRow = job as JobRecord
  const { data: customer } = await supabaseAdmin
    .from('customers')
    .select('id, name, email, phone, address')
    .eq('org_id', orgId)
    .eq('id', jobRow.customer_id)
    .maybeSingle()

  if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  if (!customer.email) return NextResponse.json({ error: 'Customer email missing' }, { status: 400 })

  const { data: template } = await supabaseAdmin
    .from('email_templates')
    .select('subject, body')
    .eq('org_id', orgId)
    .eq('stage', stage)
    .maybeSingle()

  if (!template) {
    return NextResponse.json({ error: `Missing email template for ${stage}` }, { status: 400 })
  }

  const { data: scheduleRows } = await supabaseAdmin
    .from('job_schedules')
    .select('start_at, end_at')
    .eq('org_id', orgId)
    .eq('job_id', id)
    .order('start_at', { ascending: true })

  const scheduledBlocks = (scheduleRows ?? [])
    .map((row) => {
      const r = row as ScheduleRow
      if (!r.start_at || !r.end_at) return null
      return `${new Date(r.start_at).toLocaleString()} - ${new Date(r.end_at).toLocaleString()}`
    })
    .filter(Boolean)
    .join('\n')

  const vars = withAliases({
    customerName: customer.name ?? '',
    customerEmail: customer.email ?? '',
    customerPhone: customer.phone ?? '',
    customerAddress: customer.address ?? '',
    jobTitle: jobRow.title ?? '',
    estimateDate: jobRow.estimate_date
      ? new Date(jobRow.estimate_date).toLocaleString()
      : '',
    scheduledDate: jobRow.scheduled_date
      ? new Date(jobRow.scheduled_date).toLocaleString()
      : '',
    scheduledBlocks,
    estimateFileName: '',
    estimateFileLink: '',
    reviewLink: process.env.REVIEW_LINK ?? 'https://g.page/r/CXTTS4mREhqcEBM/review',
  })

  const subject = subjectOverride ?? applyTemplate(template.subject ?? '', vars)
  const bodyText = bodyOverride ?? applyTemplate(template.body ?? '', vars)

  let attachment: { filename: string; contentType: string; data: Buffer } | null = null
  if (stage === 'follow_up') {
    const origin = new URL(request.url).origin
    const fileResult = await findLatestEstimateFile({
      origin,
      orgId,
      userId,
      address: customer.address,
    })
    if ('error' in fileResult) {
      return NextResponse.json({ error: fileResult.error }, { status: 400 })
    }
    const download = await downloadDriveFile({
      origin,
      orgId,
      userId,
      fileId: fileResult.file.id,
    })
    if ('error' in download) {
      return NextResponse.json({ error: download.error }, { status: 400 })
    }
    attachment = {
      filename: fileResult.file.name,
      contentType: 'application/pdf',
      data: download.buffer,
    }
  }

  const send = await sendGmailMessage({
    origin: new URL(request.url).origin,
    orgId,
    userId,
    to: customer.email,
    subject: subject || 'Update',
    bodyText,
    attachment,
  })

  if ('error' in send) {
    return NextResponse.json({ error: send.error }, { status: 400 })
  }

  if (stage === 'scheduled') {
    const starts = (scheduleRows ?? [])
      .map((row) => (row as ScheduleRow).start_at)
      .filter((v): v is string => typeof v === 'string')
      .sort()
    const ends = (scheduleRows ?? [])
      .map((row) => (row as ScheduleRow).end_at)
      .filter((v): v is string => typeof v === 'string')
      .sort()

    const { data: updatedJob, error: updateErr } = await updateJobCompat(orgId, id, {
      status: 'scheduled',
      scheduled_date: starts[0] ?? jobRow.scheduled_date ?? null,
      scheduled_end_date: ends[ends.length - 1] ?? null,
      scheduled_email_sent_at: new Date().toISOString(),
    })

    if (updateErr) {
      return NextResponse.json({
        ok: true,
        warning: `Email sent, but failed to sync scheduled status: ${updateErr.message}`,
      })
    }
    return NextResponse.json({ ok: true, job: updatedJob })
  }

  return NextResponse.json({ ok: true })
}
