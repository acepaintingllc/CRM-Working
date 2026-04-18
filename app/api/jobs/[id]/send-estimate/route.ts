import { NextResponse } from 'next/server'
import { supabaseAdmin, getSessionUserOrg } from '@/lib/server/org'
import { downloadDriveFile, findLatestEstimateFile } from '@/lib/server/googleDrive'
import { sendGmailMessage } from '@/lib/server/googleMail'
import { checkLocalRateLimit } from '@/lib/server/rateLimit'
import { applyTemplate, withTemplateAliases } from '@/lib/server/emailTemplate'
import { serverLog } from '@/lib/server/log'
import { enforceContentLength, requireMultipartFormData } from '@/lib/server/apiRoute'

type JobRecord = {
  customer_id: string | null
  title: string | null
  estimate_date: string | null
  scheduled_date: string | null
}

type ScheduleRow = { start_at: string | null; end_at: string | null }
const maxEstimateUploadBytes = 20 * 1024 * 1024

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

    const rate = checkLocalRateLimit({
      key: `send-estimate:${orgId}:${userId}:${id}`,
      max: 5,
      windowMs: 10 * 60 * 1000,
    })
    if (!rate.ok) {
      return NextResponse.json({ error: 'Too many send attempts. Please wait and retry.' }, { status: 429 })
    }

    const { data: job, error: jobErr } = await supabaseAdmin
      .from('jobs')
      .select('*')
      .eq('org_id', orgId)
      .eq('id', id)
      .maybeSingle()

    if (jobErr) return NextResponse.json({ error: 'Unable to load job.' }, { status: 500 })
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
    let attachment: { id?: string | null; filename: string; data: Buffer; link?: string | null; version?: number | null; matchMode?: string | null } | null = null
    let subjectOverride: string | null = null
    let bodyOverride: string | null = null

    if (contentType.includes('multipart/form-data')) {
      const typeCheck = requireMultipartFormData(request)
      if (!typeCheck.ok) return typeCheck.response
      const sizeCheck = enforceContentLength(request, maxEstimateUploadBytes)
      if (!sizeCheck.ok) return sizeCheck.response

      const form = await request.formData()
      const file = form.get('file')
      const subjectField = form.get('subject')
      const bodyField = form.get('body')
      if (typeof subjectField === 'string') subjectOverride = subjectField
      if (typeof bodyField === 'string') bodyOverride = bodyField
      if (file && file instanceof File) {
        if (file.size > maxEstimateUploadBytes) {
          return NextResponse.json({ error: 'Uploaded file is too large.' }, { status: 413 })
        }
        const buffer = Buffer.from(await file.arrayBuffer())
        attachment = {
          id: null,
          filename: file.name,
          data: buffer,
          link: null,
          version: null,
          matchMode: 'manual',
        }
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
        serverLog.warn('[send-estimate] no-match', { jobId: id, reason: fileResult.error })
        return NextResponse.json({ error: 'No matching estimate in Drive folder.' }, { status: 400 })
      }
      serverLog.info('[send-estimate] selected', {
        jobId: id,
        fileId: fileResult.file.id,
        fileName: fileResult.file.name,
        version: fileResult.file.version ?? null,
        matchMode: fileResult.file.matchMode ?? null,
      })

      const download = await downloadDriveFile({
        origin,
        orgId,
        userId,
        fileId: fileResult.file.id,
      })

      if ('error' in download) {
        return NextResponse.json({ error: 'Unable to read estimate file from Drive.' }, { status: 400 })
      }

      attachment = {
        id: fileResult.file.id,
        filename: fileResult.file.name,
        data: download.buffer,
        link: fileResult.file.webViewLink ?? null,
        version: fileResult.file.version ?? null,
        matchMode: fileResult.file.matchMode ?? null,
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

    const vars = withTemplateAliases({
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
      return NextResponse.json({ error: 'Unable to send email.' }, { status: 400 })
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
        id: attachment.id ?? attachment.filename,
        name: attachment.filename,
        webViewLink: attachment.link ?? null,
        version: attachment.version ?? null,
        matchMode: attachment.matchMode ?? null,
      },
    })
  } catch (e: unknown) {
    console.error('send-estimate failed', e)
    return NextResponse.json({ error: 'Unable to send estimate email.' }, { status: 500 })
  }
}
