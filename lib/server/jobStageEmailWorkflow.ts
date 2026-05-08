import { supabaseAdmin } from '@/lib/server/org'
import { sendGmailMessage } from '@/lib/server/googleMail'
import { downloadDriveFile } from '@/lib/server/googleDrive'
import type { EmailSendStatus } from '@/lib/email/types'
import {
  applyTemplate,
  buildEstimateFileTemplateVars,
  buildJobEmailTemplateVars,
  formatJobTemplateDate,
} from '@/lib/jobs/emailTemplate'
import { serverLog } from '@/lib/server/log'
import { assertSchema, isMissingSchemaErrorMessage } from '@/lib/server/schema'
import {
  buildJobSelect,
  getAvailableOptionalJobColumns,
  withOptionalJobColumns,
} from '@/lib/server/jobSchema'
import {
  isJobStatus,
  isStageEmailStage,
  JOB_EMAIL_STAGE_RULES,
  STAGE_EMAIL_STAGES,
  type StageEmailStage,
} from '@/lib/jobs/types'
import { resolveJobEstimateFiles } from '@/lib/jobs/estimateFiles'
import { applyJobStageSideEffect } from '@/lib/server/jobScheduleSync'
import { normalizeScheduleDateTimeBlock } from '@/lib/server/jobScheduleDateTime'
import type { ServiceError, ServiceResult } from '@/lib/server/serviceResult'

const stageSet = new Set<string>(STAGE_EMAIL_STAGES)
const throttleWindowMs = 10 * 60 * 1000
const throttleMaxAttempts = 6
const replayPollTries = 8
const replayPollDelayMs = 150
const throttleStatuses: Array<'pending' | 'sent' | 'failed'> = ['pending', 'sent', 'failed']

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

export type SendJobStageEmailInput = {
  stage: StageEmailStage
  subject?: string
  body?: string
  estimateFileIds: string[]
  idempotencyKey: string
}

export type SendJobStageEmailResult = {
  status: EmailSendStatus
  replayed: boolean
  result_status?: EmailLogStatusPersistent
  notice?: string | null
  warning?: string | null
  job?: Record<string, unknown> | null
  estimateFile: {
    id: string
    name: string
    webViewLink?: string | null
    version?: number | null
    matchMode?: string | null
  } | null
  estimateFiles: Array<{
    id: string
    name: string
    webViewLink?: string | null
    version?: number | null
    matchMode?: string | null
  }>
}

export type SendJobStageEmailWorkflowResult =
  | { ok: true; data: SendJobStageEmailResult; status?: number }
  | (ServiceError & { status?: number })

function workflowError(
  kind: ServiceError['kind'],
  message: string,
  status?: number
): SendJobStageEmailWorkflowResult {
  return { ok: false, kind, message, status }
}

function workflowSuccess(
  data: SendJobStageEmailResult,
  status?: number
): SendJobStageEmailWorkflowResult {
  return { ok: true, data, status }
}

function getStageEmailSuccessNotice(stage: StageEmailStage) {
  switch (stage) {
    case 'estimate_sent':
      return 'Quote email sent.'
    case 'follow_up':
      return 'Follow-up email sent.'
    case 'scheduled':
      return 'Scheduled email sent.'
    case 'completed':
      return 'Review email sent.'
    default:
      return 'Email sent.'
  }
}

export function normalizeSendJobStageEmailInput(
  body: Record<string, unknown> | null | undefined
): ServiceResult<SendJobStageEmailInput> {
  const stageRaw = body?.stage
  const stage = typeof stageRaw === 'string' ? stageRaw : ''
  if (!stage || !stageSet.has(stage) || !isStageEmailStage(stage)) {
    return { ok: false, kind: 'invalid_input', message: 'Invalid stage' }
  }

  const idempotencyKeyRaw = body?.idempotency_key ?? body?.idempotencyKey
  const idempotencyKey =
    typeof idempotencyKeyRaw === 'string' ? idempotencyKeyRaw.trim() : ''
  if (!idempotencyKey || idempotencyKey.length > 200) {
    return { ok: false, kind: 'invalid_input', message: 'Missing idempotency_key' }
  }

  const estimateFileIdsRaw = Array.isArray(body?.estimate_file_ids)
    ? body.estimate_file_ids
    : []
  const estimateFileIds = Array.from(
    new Set(
      estimateFileIdsRaw
        .filter((value: unknown): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean)
    )
  )

  return {
    ok: true,
    data: {
      stage,
      subject: typeof body?.subject === 'string' ? body.subject : undefined,
      body: typeof body?.body === 'string' ? body.body : undefined,
      estimateFileIds,
      idempotencyKey,
    },
  }
}

function pickOrgText(row: OrgRow, candidates: string[]) {
  for (const key of candidates) {
    const raw = row[key]
    if (typeof raw === 'string' && raw.trim()) return raw.trim()
  }
  return null
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
  const optionalJobColumns = await getAvailableOptionalJobColumns()
  const jobSelect = buildJobSelect(
    [
      'id',
      'customer_id',
      'title',
      'status',
      'completed_at',
      'estimate_date',
      'estimate_sent_at',
      'scheduled_date',
      'scheduled_end_date',
      'created_at',
      'updated_at',
    ],
    optionalJobColumns
  )
  const { data } = await supabaseAdmin
    .from('jobs')
    .select(jobSelect)
    .eq('org_id', orgId)
    .eq('id', jobId)
    .maybeSingle()
  return withOptionalJobColumns((data ?? null) as Record<string, unknown> | null, optionalJobColumns)
}

async function replayResponse(orgId: string, idempotencyKey: string) {
  const existing = await getReplayRow(orgId, idempotencyKey)
  if (!existing) {
    return workflowError('conflict', 'This send request key was already used.', 409)
  }

  const resultStatus = asPersistentStatus(existing.status)
  const existingJob = resultStatus === 'sent' ? await getJobSnapshot(orgId, existing.job_id) : null
  const defaultMessage =
    resultStatus === 'sent'
      ? 'This email request was already processed. No duplicate email was sent.'
      : resultStatus === 'pending'
      ? 'This email request is already in progress. No duplicate email was sent.'
      : 'This email request was already processed and was not sent.'

  if (resultStatus === 'failed' || resultStatus === 'blocked') {
    return workflowError(
      'invalid_input',
      existing.error_message ?? 'Previous send attempt failed.',
      responseStatusForPersistent(resultStatus, existing.error_message)
    )
  }

  return workflowSuccess(
    {
      status: 'replayed' as EmailSendStatus,
      replayed: true,
      result_status: resultStatus,
      notice: defaultMessage,
      job: existingJob,
      estimateFile: null,
      estimateFiles: [],
    },
    responseStatusForPersistent(resultStatus, existing.error_message)
  )
}

async function logBlockedResponse(args: {
  orgId: string
  userId: string
  jobId: string
  stage: StageEmailStage
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
    console.error('[send-stage] blocked email_log insert failed', blockedInsert.error)
    return workflowError('server_error', 'Unable to create email delivery log.', 500)
  }

  return workflowError('invalid_input', args.errorMessage, args.statusCode)
}

export async function sendJobStageEmail(args: {
  orgId: string
  userId: string
  origin: string
  jobId: string
  input: SendJobStageEmailInput
}): Promise<SendJobStageEmailWorkflowResult> {
  const { orgId, userId } = args
  const id = args.jobId
  const {
    stage: typedStage,
    subject: subjectOverride,
    body: bodyOverride,
    estimateFileIds,
    idempotencyKey,
  } = args.input

  const schema = await assertSchema([
    {
      table: 'jobs',
      columns: [
        'id',
        'org_id',
        'customer_id',
        'title',
        'status',
        'completed_at',
        'estimate_date',
        'estimate_sent_at',
        'scheduled_date',
        'scheduled_end_date',
      ],
    },
    { table: 'customers', columns: ['id', 'org_id', 'name', 'email', 'phone', 'address'] },
    { table: 'orgs', columns: ['id'] },
    { table: 'email_templates', columns: ['org_id', 'stage', 'subject', 'body'] },
    { table: 'job_schedules', columns: ['org_id', 'job_id', 'start_at', 'end_at'] },
    {
      table: 'email_log',
      columns: [
        'id',
        'org_id',
        'job_id',
        'stage',
        'from_email',
        'to_email',
        'subject',
        'body',
        'idempotency_key',
        'status',
        'error_message',
        'created_by',
        'gmail_message_id',
        'sent_at',
        'created_at',
      ],
    },
  ])
  if (!schema.ok) {
    const message = isMissingSchemaErrorMessage(schema.error)
      ? `Missing required schema for ${schema.table}. Run latest SQL migrations.`
      : schema.error
    return workflowError('server_error', message, 500)
  }

  const optionalJobColumns = await getAvailableOptionalJobColumns()
  const jobSelect = buildJobSelect(
    [
      'id',
      'customer_id',
      'title',
      'status',
      'completed_at',
      'estimate_date',
      'estimate_sent_at',
      'scheduled_date',
      'scheduled_end_date',
    ],
    optionalJobColumns
  )

  const orgRes = await supabaseAdmin
    .from('orgs')
    .select('*')
    .eq('id', orgId)
    .maybeSingle()
  if (orgRes.error) {
    return workflowError('server_error', 'Unable to load organization profile.', 500)
  }
  const orgRow = (orgRes.data ?? {}) as OrgRow
  const fromEmail =
    pickOrgText(orgRow, ['business_email', 'email', 'company_email', 'from_email']) ??
    'no-reply@local.invalid'

  const replay = await getEmailLogByKey(orgId, idempotencyKey)
  if (replay) {
    return replayResponse(orgId, idempotencyKey)
  }

  const { data: job, error: jobErr } = await supabaseAdmin
    .from('jobs')
    .select(jobSelect)
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle()

  if (jobErr) return workflowError('server_error', 'Unable to load job.', 500)
  if (!job) return workflowError('not_found', 'Job not found', 404)

  const jobRow = withOptionalJobColumns(
    (job ?? null) as unknown as Record<string, unknown> | null,
    optionalJobColumns
  ) as JobRecord
  const stageRule = JOB_EMAIL_STAGE_RULES[typedStage]
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
    .map((row) => normalizeScheduleDateTimeBlock(row as ScheduleRow))
    .filter((row): row is NonNullable<typeof row> => row !== null)

  const customerRow = (customer ?? null) as CustomerRow | null
  const serverTemplateDefaults = {
    reviewLink: process.env.REVIEW_LINK,
  }
  const varsBase = buildJobEmailTemplateVars(
    {
      customerName: customerRow?.name ?? '',
      customerEmail: customerRow?.email ?? '',
      customerPhone: customerRow?.phone ?? '',
      customerAddress: customerRow?.address ?? '',
      jobTitle: jobRow.title ?? '',
      estimateDate: formatJobTemplateDate(jobRow.estimate_date),
      scheduledDate: formatJobTemplateDate(jobRow.scheduled_date),
      scheduledBlocks: scheduleBlocks
        .map(
          (row) =>
            `${formatJobTemplateDate(row.startAt)} - ${formatJobTemplateDate(row.endAt)}`
        )
        .join('\n'),
      estimateFileName: '',
      estimateFileLink: '',
    },
    serverTemplateDefaults
  )

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

  if (stageRule.requiresCompleted && jobRow.status !== 'completed' && !jobRow.completed_at) {
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

  if (stageRule.requiresScheduleBlocks && scheduleBlocks.length === 0) {
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

  if (stageRule.requiresEstimateDate && !jobRow.estimate_date) {
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
    console.error('[send-stage] email_log throttle check failed', throttleError)
    return workflowError('server_error', 'Unable to validate send limits.', 500)
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
    const selection = await resolveJobEstimateFiles({
      origin: args.origin,
      orgId,
      userId,
      jobId: id,
      estimateFileIds,
    })
    if (!selection.ok) {
      if (selection.kind === 'not_found') {
        serverLog.warn('[send-stage] no-match', {
          jobId: id,
          stage: typedStage,
          reason: selection.message,
        })
      }
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
        errorMessage: selection.message,
        statusCode: selection.kind === 'not_found' ? 400 : 400,
      })
    }

    for (const selected of selection.data.files) {
      const download = await downloadDriveFile({
        origin: args.origin,
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
  const vars = buildJobEmailTemplateVars(
    {
      customerName: customerRow.name ?? '',
      customerEmail: customerRow.email ?? '',
      customerPhone: customerRow.phone ?? '',
      customerAddress: customerRow.address ?? '',
      jobTitle: jobRow.title ?? '',
      estimateDate: formatJobTemplateDate(jobRow.estimate_date),
      scheduledDate: formatJobTemplateDate(jobRow.scheduled_date),
      scheduledBlocks: scheduleBlocks
        .map(
          (row) =>
            `${formatJobTemplateDate(row.startAt)} - ${formatJobTemplateDate(row.endAt)}`
        )
        .join('\n'),
      ...buildEstimateFileTemplateVars({
        estimateFiles: attachments,
      }),
    },
    serverTemplateDefaults
  )

  const subject = subjectOverride ?? applyTemplate(template.subject ?? '', vars)
  const bodyText = bodyOverride ?? applyTemplate(template.body ?? '', vars)

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
    console.error('[send-stage] email_log insert failed', pendingInsert.error)
    return workflowError('server_error', 'Unable to create email delivery log.', 500)
  }

  const logRow = pendingInsert.data ? (pendingInsert.data as EmailLogRow) : null
  const send = await sendGmailMessage({
    origin: args.origin,
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

    return workflowError('invalid_input', 'Unable to send email.', 400)
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
  }

  let updatedJob: Record<string, unknown> | null = null

  if (
    typedStage === 'estimate_sent' ||
    typedStage === 'scheduled' ||
    typedStage === 'completed'
  ) {
    const currentStatus = isJobStatus(jobRow.status) ? jobRow.status : null
    if (!currentStatus || stageRule.allowedFrom.includes(currentStatus)) {
      const sync = await applyJobStageSideEffect(orgId, id, {
        stage: typedStage,
        sentAt: sentAtIso,
      })
      if (sync.error) {
        const warningLabel =
          typedStage === 'estimate_sent'
            ? 'estimate status'
            : typedStage === 'scheduled'
            ? 'scheduled status'
            : 'review email status'
        warnings.push(`Email sent, but failed to sync ${warningLabel}: ${sync.error.message}`)
      } else {
        updatedJob = (sync.job ?? null) as Record<string, unknown> | null
      }
    }
  }

  return workflowSuccess({
    status: 'sent' as EmailSendStatus,
    replayed: false,
    notice: getStageEmailSuccessNotice(typedStage),
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
