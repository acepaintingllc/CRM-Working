import { NextResponse } from 'next/server'
import { supabaseAdmin, getSessionUserOrg } from '@/lib/server/org'
import { sendGmailMessage } from '@/lib/server/googleMail'
import {
  downloadDriveFile,
  findLatestEstimateFile,
  findMatchingEstimateFiles,
} from '@/lib/server/googleDrive'
import { checkLocalRateLimit } from '@/lib/server/rateLimit'
import type { EmailSendStatus } from '@/lib/email/types'

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const stageValues = [
  'estimate_scheduled',
  'estimate_sent',
  'follow_up',
  'scheduled',
  'completed',
] as const

type Stage = (typeof stageValues)[number]

const stageSet = new Set<string>(stageValues)
const throttleWindowMs = 10 * 60 * 1000
const throttleMaxAttempts = 6
const replayPollTries = 8
const replayPollDelayMs = 150
const throttleStatuses: Array<'pending' | 'sent' | 'failed'> = ['pending', 'sent', 'failed']

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
    estimate_file_names: vars.estimateFileNames,
    estimate_file_links: vars.estimateFileLinks,
    review_link: vars.reviewLink,
  }
}

type JobRecord = {
  customer_id: string | null
  title: string | null
  status?: string | null
  completed_at?: string | null
  estimate_date: string | null
  estimate_sent_at?: string | null
  scheduled_date: string | null
  scheduled_end_date?: string | null
  scheduled_email_sent_at?: string | null
  completed_email_sent_at?: string | null
}

type CustomerRow = {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  address: string | null
}

type OrgRow = Record<string, unknown>

type ScheduleRow = { start_at: string | null; end_at: string | null }

type EmailLogStatusPersistent = Extract<EmailSendStatus, 'pending' | 'sent' | 'failed' | 'blocked'>

type EmailLogRow = {
  id: string
  org_id: string
  job_id: string | null
  stage: string
  status: string | null
  error_message: string | null
  gmail_message_id: string | null
}

type EstimateAttachment = {
  id: string
  filename: string
  contentType: string
  data: Buffer
  webViewLink?: string | null
  version?: number | null
  matchMode?: string | null
}

type SupabaseLikeError = {
  code?: string | null
  message?: string | null
}

function missingJobsColumnFromError(message: string) {
  const byCache = message.match(/Could not find the '([a-zA-Z0-9_]+)' column of 'jobs' in the schema cache/i)
  if (byCache?.[1]) return byCache[1]
  const byRelation = message.match(/column "([a-zA-Z0-9_]+)" of relation "jobs" does not exist/i)
  if (byRelation?.[1]) return byRelation[1]
  return null
}

function emailLogSchemaIssueFromError(message: string) {
  const byCache = message.match(
    /Could not find the '([a-zA-Z0-9_]+)' column of 'email_log' in the schema cache/i
  )
  if (byCache?.[1]) return `missing column ${byCache[1]}`

  const byRelationColumn = message.match(
    /column "([a-zA-Z0-9_]+)" of relation "email_log" does not exist/i
  )
  if (byRelationColumn?.[1]) return `missing column ${byRelationColumn[1]}`

  if (
    /relation "email_log" does not exist/i.test(message) ||
    /Could not find the table 'email_log' in the schema cache/i.test(message)
  ) {
    return 'missing table'
  }

  return null
}

function isEmailLogSchemaIssue(error: SupabaseLikeError | null | undefined) {
  if (!error) return false
  return Boolean(emailLogSchemaIssueFromError(error.message ?? ''))
}

function logEmailLogFallback(step: string, error: SupabaseLikeError | null | undefined) {
  const reason = emailLogSchemaIssueFromError(error?.message ?? '') ?? error?.message ?? 'unknown error'
  console.warn(`[send-stage] email_log unavailable during ${step}; falling back`, {
    reason,
    code: error?.code ?? null,
  })
}

function pickOrgText(row: OrgRow, candidates: string[]) {
  for (const key of candidates) {
    const raw = row[key]
    if (typeof raw === 'string' && raw.trim()) return raw.trim()
  }
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

function normalizeErrorMessage(error: unknown, fallback: string) {
  if (!error) return fallback
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message || fallback
  if (typeof error === 'object' && error && 'message' in error) {
    const value = (error as { message?: unknown }).message
    if (typeof value === 'string' && value.trim()) return value
  }
  return fallback
}

function isIdempotencyConflict(
  error: { code?: string | null; message?: string | null } | null | undefined
) {
  if (!error) return false
  if (error.code === '23505') return true
  const message = (error.message ?? '').toLowerCase()
  return message.includes('duplicate key') && message.includes('idempotency')
}

function isRateLimitMessage(message: string | null | undefined) {
  return (message ?? '').toLowerCase().includes('too many send attempts')
}

function asPersistentStatus(value: string | null | undefined): EmailLogStatusPersistent {
  if (value === 'pending' || value === 'sent' || value === 'failed' || value === 'blocked') {
    return value
  }
  return 'failed'
}

function responseStatusForPersistent(status: EmailLogStatusPersistent, errorMessage?: string | null) {
  if (status === 'sent') return 200
  if (status === 'pending') return 202
  if (status === 'blocked') return isRateLimitMessage(errorMessage ?? null) ? 429 : 400
  return 400
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function getEmailLogByKey(orgId: string, idempotencyKey: string) {
  const { data, error } = await supabaseAdmin
    .from('email_log')
    .select('id, org_id, job_id, stage, status, error_message, gmail_message_id')
    .eq('org_id', orgId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()

  if (error) return null
  return (data ?? null) as EmailLogRow | null
}

async function getReplayRow(orgId: string, idempotencyKey: string) {
  let row = await getEmailLogByKey(orgId, idempotencyKey)
  if (!row) return null

  for (let i = 0; i < replayPollTries; i++) {
    if (asPersistentStatus(row.status) !== 'pending') return row
    await delay(replayPollDelayMs)
    row = await getEmailLogByKey(orgId, idempotencyKey)
    if (!row) return null
  }

  return row
}

async function getJobSnapshot(orgId: string, jobId: string | null) {
  if (!jobId) return null
  const { data } = await supabaseAdmin
    .from('jobs')
    .select('*')
    .eq('org_id', orgId)
    .eq('id', jobId)
    .maybeSingle()
  return data ?? null
}

async function replayResponse(orgId: string, idempotencyKey: string) {
  const existing = await getReplayRow(orgId, idempotencyKey)
  if (!existing) {
    return NextResponse.json(
      {
        ok: false,
        status: 'replayed' as EmailSendStatus,
        replayed: true,
        error: 'This send request key was already used.',
      },
      { status: 409 }
    )
  }

  const resultStatus = asPersistentStatus(existing.status)
  const existingJob = resultStatus === 'sent' ? await getJobSnapshot(orgId, existing.job_id) : null
  const defaultMessage =
    resultStatus === 'sent'
      ? 'This email request was already processed. No duplicate email was sent.'
      : resultStatus === 'pending'
      ? 'This email request is already in progress. No duplicate email was sent.'
      : 'This email request was already processed and was not sent.'

  return NextResponse.json(
    {
      ok: resultStatus === 'sent' || resultStatus === 'pending',
      status: 'replayed' as EmailSendStatus,
      replayed: true,
      result_status: resultStatus,
      warning: defaultMessage,
      error:
        resultStatus === 'failed' || resultStatus === 'blocked'
          ? existing.error_message ?? 'Previous send attempt failed.'
          : undefined,
      job: existingJob,
    },
    { status: responseStatusForPersistent(resultStatus, existing.error_message) }
  )
}

async function logBlockedResponse(args: {
  orgId: string
  userId: string
  jobId: string
  stage: Stage
  fromEmail: string
  idempotencyKey: string
  toEmail: string | null
  subject: string | null
  bodyText: string | null
  errorMessage: string
  statusCode: number
}) {
  const blockedInsert = await supabaseAdmin
    .from('email_log')
    .insert({
      org_id: args.orgId,
      job_id: args.jobId,
      stage: args.stage,
      from_email: args.fromEmail,
      to_email: args.toEmail,
      subject: args.subject,
      body: args.bodyText,
      idempotency_key: args.idempotencyKey,
      status: 'blocked',
      error_message: args.errorMessage,
      created_by: args.userId,
    })
    .select('id')
    .maybeSingle()

  if (isIdempotencyConflict(blockedInsert.error)) {
    return replayResponse(args.orgId, args.idempotencyKey)
  }
  if (blockedInsert.error) {
    if (isEmailLogSchemaIssue(blockedInsert.error)) {
      logEmailLogFallback('blocked_insert', blockedInsert.error)
      return NextResponse.json(
        {
          ok: false,
          status: 'blocked' as EmailSendStatus,
          replayed: false,
          error: args.errorMessage,
        },
        { status: args.statusCode }
      )
    }
    console.error('[send-stage] blocked email_log insert failed', blockedInsert.error)
    return NextResponse.json({ error: 'Unable to create email delivery log.' }, { status: 500 })
  }

  return NextResponse.json(
    {
      ok: false,
      status: 'blocked' as EmailSendStatus,
      replayed: false,
      error: args.errorMessage,
    },
    { status: args.statusCode }
  )
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
  const stageRaw = body?.stage
  const stage = typeof stageRaw === 'string' ? stageRaw : ''
  const subjectOverride = typeof body?.subject === 'string' ? body.subject : undefined
  const bodyOverride = typeof body?.body === 'string' ? body.body : undefined
  const estimateFileIdsRaw = Array.isArray(body?.estimate_file_ids)
    ? body.estimate_file_ids
    : []
  const estimateFileIds = Array.isArray(estimateFileIdsRaw)
    ? Array.from(
        new Set(
          estimateFileIdsRaw
            .filter((value: unknown): value is string => typeof value === 'string')
            .map((value) => value.trim())
            .filter(Boolean)
        )
      )
    : []
  const idempotencyKeyRaw = body?.idempotency_key ?? body?.idempotencyKey
  const idempotencyKey =
    typeof idempotencyKeyRaw === 'string' ? idempotencyKeyRaw.trim() : ''

  if (!stage || !stageSet.has(stage)) {
    return NextResponse.json({ error: 'Invalid stage' }, { status: 400 })
  }
  if (!idempotencyKey || idempotencyKey.length > 200) {
    return NextResponse.json({ error: 'Missing idempotency_key' }, { status: 400 })
  }

  const orgRes = await supabaseAdmin
    .from('orgs')
    .select('*')
    .eq('id', orgId)
    .maybeSingle()
  if (orgRes.error) {
    return NextResponse.json({ error: 'Unable to load organization profile.' }, { status: 500 })
  }
  const orgRow = (orgRes.data ?? {}) as OrgRow
  const fromEmail =
    pickOrgText(orgRow, ['business_email', 'email', 'company_email', 'from_email']) ??
    'no-reply@local.invalid'

  const replay = await getEmailLogByKey(orgId, idempotencyKey)
  if (replay) {
    return replayResponse(orgId, idempotencyKey)
  }

  const typedStage = stage as Stage
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

  const { data: template } = await supabaseAdmin
    .from('email_templates')
    .select('subject, body')
    .eq('org_id', orgId)
    .eq('stage', typedStage)
    .maybeSingle()

  const { data: scheduleRows } = await supabaseAdmin
    .from('job_schedules')
    .select('start_at, end_at')
    .eq('org_id', orgId)
    .eq('job_id', id)
    .order('start_at', { ascending: true })

  const scheduleBlocks = (scheduleRows ?? [])
    .map((row) => row as ScheduleRow)
    .filter((row) => Boolean(row.start_at && row.end_at))

  const customerRow = (customer ?? null) as CustomerRow | null
  const varsBase = withAliases({
    customerName: customerRow?.name ?? '',
    customerEmail: customerRow?.email ?? '',
    customerPhone: customerRow?.phone ?? '',
    customerAddress: customerRow?.address ?? '',
    jobTitle: jobRow.title ?? '',
    estimateDate: jobRow.estimate_date
      ? new Date(jobRow.estimate_date).toLocaleString()
      : '',
    scheduledDate: jobRow.scheduled_date
      ? new Date(jobRow.scheduled_date).toLocaleString()
      : '',
    scheduledBlocks: scheduleBlocks
      .map((row) => `${new Date(row.start_at as string).toLocaleString()} - ${new Date(row.end_at as string).toLocaleString()}`)
      .join('\n'),
    estimateFileName: '',
    estimateFileLink: '',
    reviewLink: process.env.REVIEW_LINK ?? 'https://g.page/r/CXTTS4mREhqcEBM/review',
  })

  const subjectDraft =
    subjectOverride ??
    (template ? applyTemplate(template.subject ?? '', varsBase) : null)
  const bodyDraft =
    bodyOverride ??
    (template ? applyTemplate(template.body ?? '', varsBase) : null)

  if (!customerRow) {
    return logBlockedResponse({
      orgId,
      userId,
      jobId: id,
      stage: typedStage,
      fromEmail,
      idempotencyKey,
      toEmail: null,
      subject: subjectDraft ?? null,
      bodyText: bodyDraft ?? null,
      errorMessage: 'Customer not found',
      statusCode: 404,
    })
  }

  if (!customerRow.email) {
    return logBlockedResponse({
      orgId,
      userId,
      jobId: id,
      stage: typedStage,
      fromEmail,
      idempotencyKey,
      toEmail: null,
      subject: subjectDraft ?? null,
      bodyText: bodyDraft ?? null,
      errorMessage: 'Customer email missing',
      statusCode: 400,
    })
  }

  if (!template) {
    return logBlockedResponse({
      orgId,
      userId,
      jobId: id,
      stage: typedStage,
      fromEmail,
      idempotencyKey,
      toEmail: customerRow.email,
      subject: subjectDraft ?? null,
      bodyText: bodyDraft ?? null,
      errorMessage: `Missing email template for ${typedStage}`,
      statusCode: 400,
    })
  }

  if (typedStage === 'completed' && jobRow.status !== 'completed' && !jobRow.completed_at) {
    return logBlockedResponse({
      orgId,
      userId,
      jobId: id,
      stage: typedStage,
      fromEmail,
      idempotencyKey,
      toEmail: customerRow.email,
      subject: subjectDraft ?? null,
      bodyText: bodyDraft ?? null,
      errorMessage: 'Job must be completed before sending the review email.',
      statusCode: 400,
    })
  }

  if (typedStage === 'scheduled' && scheduleBlocks.length === 0) {
    return logBlockedResponse({
      orgId,
      userId,
      jobId: id,
      stage: typedStage,
      fromEmail,
      idempotencyKey,
      toEmail: customerRow.email,
      subject: subjectDraft ?? null,
      bodyText: bodyDraft ?? null,
      errorMessage: 'Add at least one scheduled block before sending the scheduled email.',
      statusCode: 400,
    })
  }

  if (typedStage === 'estimate_scheduled' && !jobRow.estimate_date) {
    return logBlockedResponse({
      orgId,
      userId,
      jobId: id,
      stage: typedStage,
      fromEmail,
      idempotencyKey,
      toEmail: customerRow.email,
      subject: subjectDraft ?? null,
      bodyText: bodyDraft ?? null,
      errorMessage: 'Estimate date is required before sending the estimate scheduled email.',
      statusCode: 400,
    })
  }

  const throttleWindowStart = new Date(Date.now() - throttleWindowMs).toISOString()
  const { count: attemptCount, error: throttleError } = await supabaseAdmin
    .from('email_log')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('created_by', userId)
    .eq('job_id', id)
    .eq('stage', typedStage)
    .gte('created_at', throttleWindowStart)
    .in('status', throttleStatuses)

  if (throttleError) {
    if (isEmailLogSchemaIssue(throttleError)) {
      logEmailLogFallback('throttle_check', throttleError)
      const localRate = checkLocalRateLimit({
        key: `send-stage:${orgId}:${userId}:${id}:${typedStage}`,
        max: throttleMaxAttempts,
        windowMs: throttleWindowMs,
      })
      if (!localRate.ok) {
        return NextResponse.json(
          {
            ok: false,
            status: 'blocked' as EmailSendStatus,
            replayed: false,
            error: 'Too many send attempts. Please wait and retry.',
          },
          { status: 429 }
        )
      }
    } else {
      console.error('[send-stage] email_log throttle check failed', throttleError)
      return NextResponse.json({ error: 'Unable to validate send limits.' }, { status: 500 })
    }
  }
  if ((attemptCount ?? 0) >= throttleMaxAttempts) {
    return logBlockedResponse({
      orgId,
      userId,
      jobId: id,
      stage: typedStage,
      fromEmail,
      idempotencyKey,
      toEmail: customerRow.email,
      subject: subjectDraft ?? null,
      bodyText: bodyDraft ?? null,
      errorMessage: 'Too many send attempts. Please wait and retry.',
      statusCode: 429,
    })
  }

  const attachments: EstimateAttachment[] = []
  if (typedStage === 'follow_up' || typedStage === 'estimate_sent') {
    const origin = new URL(request.url).origin
    const selectedFiles: Array<{
      id: string
      name: string
      webViewLink?: string | null
      version?: number | null
      matchMode?: string | null
    }> = []

    if (estimateFileIds.length > 0) {
      const matching = await findMatchingEstimateFiles({
        origin,
        orgId,
        userId,
        address: customerRow.address,
      })
      if ('error' in matching) {
        console.warn('[send-stage] no-match', {
          jobId: id,
          stage: typedStage,
          reason: matching.error,
        })
        return logBlockedResponse({
          orgId,
          userId,
          jobId: id,
          stage: typedStage,
          fromEmail,
          idempotencyKey,
          toEmail: customerRow.email,
          subject: subjectDraft ?? null,
          bodyText: bodyDraft ?? null,
          errorMessage: 'No matching estimate in Drive folder.',
          statusCode: 400,
        })
      }

      const byId = new Map(matching.files.map((file) => [file.id, file]))
      for (const fileId of estimateFileIds) {
        const selected = byId.get(fileId)
        if (selected) selectedFiles.push(selected)
      }
      if (selectedFiles.length !== estimateFileIds.length) {
        return logBlockedResponse({
          orgId,
          userId,
          jobId: id,
          stage: typedStage,
          fromEmail,
          idempotencyKey,
          toEmail: customerRow.email,
          subject: subjectDraft ?? null,
          bodyText: bodyDraft ?? null,
          errorMessage: 'One or more selected estimate attachments are no longer available.',
          statusCode: 400,
        })
      }
      if (selectedFiles.length === 0) {
        return logBlockedResponse({
          orgId,
          userId,
          jobId: id,
          stage: typedStage,
          fromEmail,
          idempotencyKey,
          toEmail: customerRow.email,
          subject: subjectDraft ?? null,
          bodyText: bodyDraft ?? null,
          errorMessage: 'Select at least one matching estimate attachment.',
          statusCode: 400,
        })
      }
    } else {
      const fileResult = await findLatestEstimateFile({
        origin,
        orgId,
        userId,
        address: customerRow.address,
      })
      if ('error' in fileResult) {
        console.warn('[send-stage] no-match', {
          jobId: id,
          stage: typedStage,
          reason: fileResult.error,
        })
        return logBlockedResponse({
          orgId,
          userId,
          jobId: id,
          stage: typedStage,
          fromEmail,
          idempotencyKey,
          toEmail: customerRow.email,
          subject: subjectDraft ?? null,
          bodyText: bodyDraft ?? null,
          errorMessage: 'No matching estimate in Drive folder.',
          statusCode: 400,
        })
      }
      selectedFiles.push(fileResult.file)
    }

    for (const selected of selectedFiles) {
      const download = await downloadDriveFile({
        origin,
        orgId,
        userId,
        fileId: selected.id,
      })
      if ('error' in download) {
        return logBlockedResponse({
          orgId,
          userId,
          jobId: id,
          stage: typedStage,
          fromEmail,
          idempotencyKey,
          toEmail: customerRow.email,
          subject: subjectDraft ?? null,
          bodyText: bodyDraft ?? null,
          errorMessage: 'Unable to read estimate file from Drive.',
          statusCode: 400,
        })
      }
      attachments.push({
        id: selected.id,
        filename: selected.name,
        contentType: 'application/pdf',
        data: download.buffer,
        webViewLink: selected.webViewLink ?? null,
        version: selected.version ?? null,
        matchMode: selected.matchMode ?? null,
      })
    }
  }

  const firstAttachment = attachments[0] ?? null
  const estimateFileNames = attachments.map((row) => row.filename).join(', ')
  const estimateFileLinks = attachments
    .map((row) => row.webViewLink ?? '')
    .filter(Boolean)
    .join('\n')

  const vars = withAliases({
    customerName: customerRow.name ?? '',
    customerEmail: customerRow.email ?? '',
    customerPhone: customerRow.phone ?? '',
    customerAddress: customerRow.address ?? '',
    jobTitle: jobRow.title ?? '',
    estimateDate: jobRow.estimate_date ? new Date(jobRow.estimate_date).toLocaleString() : '',
    scheduledDate: jobRow.scheduled_date ? new Date(jobRow.scheduled_date).toLocaleString() : '',
    scheduledBlocks: scheduleBlocks
      .map((row) => `${new Date(row.start_at as string).toLocaleString()} - ${new Date(row.end_at as string).toLocaleString()}`)
      .join('\n'),
    estimateFileName: firstAttachment?.filename ?? '',
    estimateFileLink: firstAttachment?.webViewLink ?? '',
    estimateFileNames,
    estimateFileLinks,
    reviewLink: process.env.REVIEW_LINK ?? 'https://g.page/r/CXTTS4mREhqcEBM/review',
  })

  const subject = subjectOverride ?? applyTemplate(template.subject ?? '', vars)
  const bodyText = bodyOverride ?? applyTemplate(template.body ?? '', vars)

  let deliveryLogUnavailable = false
  const pendingInsert = await supabaseAdmin
    .from('email_log')
    .insert({
      org_id: orgId,
      job_id: id,
      stage: typedStage,
      from_email: fromEmail,
      to_email: customerRow.email,
      subject,
      body: bodyText,
      idempotency_key: idempotencyKey,
      status: 'pending',
      created_by: userId,
    })
    .select('id, org_id, job_id, stage, status, error_message, gmail_message_id')
    .single()

  if (isIdempotencyConflict(pendingInsert.error)) {
    return replayResponse(orgId, idempotencyKey)
  }
  if (pendingInsert.error || !pendingInsert.data) {
    if (isEmailLogSchemaIssue(pendingInsert.error)) {
      logEmailLogFallback('pending_insert', pendingInsert.error)
      deliveryLogUnavailable = true
    } else if (typedStage === 'estimate_sent') {
      console.warn('[send-stage] estimate_sent proceeding without delivery log', {
        code: pendingInsert.error?.code ?? null,
        message: pendingInsert.error?.message ?? 'unknown error',
      })
      deliveryLogUnavailable = true
    } else {
      console.error('[send-stage] email_log insert failed', pendingInsert.error)
      return NextResponse.json({ error: 'Unable to create email delivery log.' }, { status: 500 })
    }
  }

  const logRow = pendingInsert.data ? (pendingInsert.data as EmailLogRow) : null
  const send = await sendGmailMessage({
    origin: new URL(request.url).origin,
    orgId,
    userId,
    to: customerRow.email,
    subject: subject || 'Update',
    bodyText,
    attachments,
  })

  if ('error' in send) {
    const normalized = normalizeErrorMessage(send.error, 'Unable to send email.')
    if (logRow) {
      await supabaseAdmin
        .from('email_log')
        .update({
          status: 'failed',
          error_message: normalized,
        })
        .eq('org_id', orgId)
        .eq('id', logRow.id)
    }

    return NextResponse.json(
      {
        ok: false,
        status: 'failed' as EmailSendStatus,
        replayed: false,
        error: 'Unable to send email.',
      },
      { status: 400 }
    )
  }

  const sentAtIso = new Date().toISOString()
  const warnings: string[] = []
  if (logRow) {
    const logUpdate = await supabaseAdmin
      .from('email_log')
      .update({
        status: 'sent',
        gmail_message_id: send.messageId ?? null,
        error_message: null,
        sent_at: sentAtIso,
      })
      .eq('org_id', orgId)
      .eq('id', logRow.id)
    if (logUpdate.error) {
      warnings.push('Email sent, but failed to update delivery log.')
    }
  } else if (deliveryLogUnavailable) {
    warnings.push('Email sent, but delivery logging is unavailable.')
  }

  let updatedJob: Record<string, unknown> | null = null

  if (typedStage === 'estimate_sent') {
    const { data: stageJob, error: updateErr } = await updateJobCompat(orgId, id, {
      status: 'estimate_sent',
      estimate_sent_at: sentAtIso,
    })
    if (updateErr) {
      warnings.push(`Email sent, but failed to sync estimate status: ${updateErr.message}`)
    } else {
      updatedJob = (stageJob ?? null) as Record<string, unknown> | null
    }
  }

  if (typedStage === 'scheduled') {
    const starts = scheduleBlocks
      .map((row) => row.start_at)
      .filter((value): value is string => typeof value === 'string')
      .sort()
    const ends = scheduleBlocks
      .map((row) => row.end_at)
      .filter((value): value is string => typeof value === 'string')
      .sort()

    const { data: stageJob, error: updateErr } = await updateJobCompat(orgId, id, {
      status: 'scheduled',
      scheduled_date: starts[0] ?? jobRow.scheduled_date ?? null,
      scheduled_end_date: ends[ends.length - 1] ?? null,
      scheduled_email_sent_at: sentAtIso,
    })
    if (updateErr) {
      warnings.push(`Email sent, but failed to sync scheduled status: ${updateErr.message}`)
    } else {
      updatedJob = (stageJob ?? null) as Record<string, unknown> | null
    }
  }

  if (typedStage === 'completed') {
    const { data: stageJob, error: updateErr } = await updateJobCompat(orgId, id, {
      completed_email_sent_at: sentAtIso,
    })
    if (updateErr) {
      warnings.push(`Email sent, but failed to sync review email status: ${updateErr.message}`)
    } else {
      updatedJob = (stageJob ?? null) as Record<string, unknown> | null
    }
  }

  return NextResponse.json({
    ok: true,
    status: 'sent' as EmailSendStatus,
    replayed: false,
    warning: warnings.length > 0 ? warnings.join(' ') : undefined,
    job: updatedJob,
    estimateFile: firstAttachment
      ? {
          id: firstAttachment.id,
          name: firstAttachment.filename,
          webViewLink: firstAttachment.webViewLink ?? null,
          version: firstAttachment.version ?? null,
          matchMode: firstAttachment.matchMode ?? null,
        }
      : null,
    estimateFiles: attachments.map((row) => ({
      id: row.id,
      name: row.filename,
      webViewLink: row.webViewLink ?? null,
      version: row.version ?? null,
      matchMode: row.matchMode ?? null,
    })),
  })
}
