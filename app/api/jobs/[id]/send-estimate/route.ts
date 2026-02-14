import { NextResponse } from 'next/server'
import { supabaseAdmin, getSessionUserOrg } from '@/lib/server/org'
import { downloadDriveFile, findLatestEstimateFile } from '@/lib/server/googleDrive'
import { sendGmailMessage } from '@/lib/server/googleMail'

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
type ErrorLike = { message?: unknown; stack?: unknown }

export async function POST(
  request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
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
      .eq('stage', 'estimate_sent')
      .maybeSingle()

    if (!template) {
      return NextResponse.json({ error: 'Missing email template for estimate sent' }, { status: 400 })
    }

    const origin = new URL(request.url).origin
    const contentType = request.headers.get('content-type') ?? ''
    let attachment: { filename: string; data: Buffer; link?: string | null } | null = null
    let subjectOverride: string | null = null
    let bodyOverride: string | null = null

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      const file = form.get('file')
      const subjectField = form.get('subject')
      const bodyField = form.get('body')
      if (typeof subjectField === 'string') subjectOverride = subjectField
      if (typeof bodyField === 'string') bodyOverride = bodyField
      if (file && file instanceof File) {
        const buffer = Buffer.from(await file.arrayBuffer())
        attachment = { filename: file.name, data: buffer, link: null }
      }
    }

    if (!attachment) {
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
        data: download.buffer,
        link: fileResult.file.webViewLink ?? null,
      }
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
      estimateFileName: attachment.filename ?? '',
      estimateFileLink: attachment.link ?? '',
      reviewLink: process.env.REVIEW_LINK ?? 'https://g.page/r/CXTTS4mREhqcEBM/review',
    })

    const subject = subjectOverride ?? applyTemplate(template.subject ?? '', vars)
    const bodyText = bodyOverride ?? applyTemplate(template.body ?? '', vars)

    const send = await sendGmailMessage({
      origin,
      orgId,
      userId,
      to: customer.email,
      subject: subject || 'Estimate',
      bodyText,
      attachment: {
        filename: attachment.filename,
        contentType: 'application/pdf',
        data: attachment.data,
      },
    })

    if ('error' in send) {
      return NextResponse.json({ error: send.error }, { status: 400 })
    }

    await supabaseAdmin
      .from('jobs')
      .update({ estimate_sent_at: new Date().toISOString(), status: 'estimate_sent' })
      .eq('org_id', orgId)
      .eq('id', id)

    return NextResponse.json({
      ok: true,
      messageId: send.messageId,
      estimateFile: {
        id: attachment.filename,
        name: attachment.filename,
        webViewLink: attachment.link ?? null,
      },
    })
  } catch (e: unknown) {
    const err = e as ErrorLike
    console.error('send-estimate failed', e)
    return NextResponse.json(
      {
        error: typeof err.message === 'string' ? err.message : 'Unhandled error sending estimate',
        details: typeof err.stack === 'string' ? err.stack : null,
      },
      { status: 500 }
    )
  }
}
