import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/server/org'
import { sendGmailMessage } from '@/lib/server/googleMail'
import {
  buildDailySummaryEmail,
  buildReminderIdempotencyKey,
  buildTaskReminderEmail,
  partitionTasksForDashboard,
  reminderTypeForTask,
  shouldSendTaskReminder,
} from '@/lib/notes/reminders'
import { getOrgNotesDefaults, resolveOrgSenderUserId } from '@/lib/notes/server'
import { localDateKey, localTimeKey, parseHHMM, resolveTimeZone } from '@/lib/notes/time'
import type { NotesSettingsRow, NotesTaskRow } from '@/lib/notes/types'

type ReminderLogStatus = 'pending' | 'sent' | 'failed' | 'skipped'

function isUniqueConflict(error: { code?: string | null } | null | undefined) {
  return error?.code === '23505'
}

async function insertReminderLog(params: {
  orgId: string
  taskId: string | null
  reminderType: 'daily_summary' | 'single_task_reminder' | 'recurring_task_reminder'
  emailTo: string
  scheduledFor: string
  status: ReminderLogStatus
  idempotencyKey: string
  errorMessage?: string | null
}) {
  const res = await supabaseAdmin
    .from('notes_reminder_logs')
    .insert({
      org_id: params.orgId,
      task_id: params.taskId,
      reminder_type: params.reminderType,
      email_to: params.emailTo,
      scheduled_for: params.scheduledFor,
      status: params.status,
      idempotency_key: params.idempotencyKey,
      error_message: params.errorMessage ?? null,
    })
    .select('id')
    .single()
  return res
}

async function updateReminderLog(params: {
  id: string
  orgId: string
  status: ReminderLogStatus
  sentAt?: string | null
  errorMessage?: string | null
}) {
  await supabaseAdmin
    .from('notes_reminder_logs')
    .update({
      status: params.status,
      sent_at: params.sentAt ?? null,
      error_message: params.errorMessage ?? null,
    })
    .eq('org_id', params.orgId)
    .eq('id', params.id)
}

async function processTaskReminders(params: {
  origin: string
  orgId: string
  senderUserId: string | null
  emailTo: string | null
  crmName: string
  timezone: string
  tasks: NotesTaskRow[]
}) {
  let sent = 0
  let failed = 0
  let skipped = 0

  const now = new Date()
  for (const task of params.tasks) {
    if (!shouldSendTaskReminder(task, now)) continue

    const reminderType = reminderTypeForTask(task)
    const marker = task.reminder_at ?? now.toISOString()
    const idempotencyKey = buildReminderIdempotencyKey({
      type: reminderType,
      orgId: params.orgId,
      taskId: task.id,
      marker,
    })
    const scheduledFor = task.reminder_at ?? now.toISOString()
    const targetEmail = params.emailTo

    if (!targetEmail || !params.senderUserId) {
      const missingReason = !targetEmail
        ? 'Daily summary email address is not configured.'
        : 'Sender account is not configured for reminder email.'
      const failedLog = await insertReminderLog({
        orgId: params.orgId,
        taskId: task.id,
        reminderType,
        emailTo: targetEmail ?? '',
        scheduledFor,
        status: 'failed',
        idempotencyKey,
        errorMessage: missingReason,
      })
      if (failedLog.error && !isUniqueConflict(failedLog.error)) {
        failed += 1
      } else if (!failedLog.error) {
        failed += 1
      } else {
        skipped += 1
      }
      continue
    }

    const pendingLog = await insertReminderLog({
      orgId: params.orgId,
      taskId: task.id,
      reminderType,
      emailTo: targetEmail,
      scheduledFor,
      status: 'pending',
      idempotencyKey,
    })

    if (pendingLog.error) {
      if (isUniqueConflict(pendingLog.error)) {
        skipped += 1
        continue
      }
      failed += 1
      continue
    }

    const reminderEmail = buildTaskReminderEmail({
      crmName: params.crmName,
      task,
      timeZone: params.timezone,
    })
    const sendRes = await sendGmailMessage({
      origin: params.origin,
      orgId: params.orgId,
      userId: params.senderUserId,
      to: targetEmail,
      subject: reminderEmail.subject,
      bodyText: reminderEmail.body,
    })

    if ('error' in sendRes) {
      await updateReminderLog({
        id: pendingLog.data.id,
        orgId: params.orgId,
        status: 'failed',
        errorMessage: sendRes.error,
      })
      failed += 1
      continue
    }

    const sentAt = new Date().toISOString()
    await updateReminderLog({
      id: pendingLog.data.id,
      orgId: params.orgId,
      status: 'sent',
      sentAt,
    })
    await supabaseAdmin
      .from('notes_tasks')
      .update({ reminder_sent_at: sentAt })
      .eq('org_id', params.orgId)
      .eq('id', task.id)
    sent += 1
  }

  return { sent, failed, skipped }
}

async function processDailySummary(params: {
  origin: string
  orgId: string
  senderUserId: string | null
  emailTo: string | null
  crmName: string
  timezone: string
  dailyTimeLocal: string
  now: Date
  tasks: NotesTaskRow[]
  settings: NotesSettingsRow
}) {
  const nowDateKey = localDateKey(params.now, params.timezone)
  const nowTimeKey = localTimeKey(params.now, params.timezone)
  const configuredTime = parseHHMM(params.dailyTimeLocal)
  const configured = configuredTime
    ? `${String(configuredTime.hour).padStart(2, '0')}:${String(configuredTime.minute).padStart(2, '0')}`
    : '07:00'

  if (nowTimeKey < configured) {
    return { sent: 0, failed: 0, skipped: 1, reason: 'before_send_window' }
  }
  if (params.settings.last_daily_summary_attempted_on === nowDateKey) {
    return { sent: 0, failed: 0, skipped: 1, reason: 'already_attempted' }
  }

  const grouped = partitionTasksForDashboard({
    tasks: params.tasks,
    now: params.now,
    timeZone: params.timezone,
    upcomingDays: 0,
  })
  const hasPending = grouped.overdue.length > 0 || grouped.dueToday.length > 0

  await supabaseAdmin
    .from('notes_settings')
    .update({ last_daily_summary_attempted_on: nowDateKey })
    .eq('org_id', params.orgId)

  const idempotencyKey = buildReminderIdempotencyKey({
    type: 'daily_summary',
    orgId: params.orgId,
    marker: nowDateKey,
  })

  if (!hasPending) {
    if (params.emailTo) {
      await insertReminderLog({
        orgId: params.orgId,
        taskId: null,
        reminderType: 'daily_summary',
        emailTo: params.emailTo,
        scheduledFor: params.now.toISOString(),
        status: 'skipped',
        idempotencyKey,
        errorMessage: 'No overdue or due-today tasks. Daily summary skipped.',
      })
    }
    return { sent: 0, failed: 0, skipped: 1, reason: 'no_pending_items' }
  }

  if (!params.senderUserId || !params.emailTo) {
    if (params.emailTo) {
      await insertReminderLog({
        orgId: params.orgId,
        taskId: null,
        reminderType: 'daily_summary',
        emailTo: params.emailTo,
        scheduledFor: params.now.toISOString(),
        status: 'failed',
        idempotencyKey,
        errorMessage: 'Missing sender account for daily summary.',
      })
    }
    return { sent: 0, failed: 1, skipped: 0, reason: 'missing_sender_or_email' }
  }

  const pendingLog = await insertReminderLog({
    orgId: params.orgId,
    taskId: null,
    reminderType: 'daily_summary',
    emailTo: params.emailTo,
    scheduledFor: params.now.toISOString(),
    status: 'pending',
    idempotencyKey,
  })
  if (pendingLog.error) {
    if (isUniqueConflict(pendingLog.error)) {
      return { sent: 0, failed: 0, skipped: 1, reason: 'duplicate_idempotency' }
    }
    return { sent: 0, failed: 1, skipped: 0, reason: 'log_insert_failed' }
  }

  const summaryEmail = buildDailySummaryEmail({
    crmName: params.crmName,
    timeZone: params.timezone,
    now: params.now,
    overdue: grouped.overdue,
    dueToday: grouped.dueToday,
    untimedToday: grouped.untimedToday,
  })

  const sendRes = await sendGmailMessage({
    origin: params.origin,
    orgId: params.orgId,
    userId: params.senderUserId,
    to: params.emailTo,
    subject: summaryEmail.subject,
    bodyText: summaryEmail.body,
  })

  if ('error' in sendRes) {
    await updateReminderLog({
      id: pendingLog.data.id,
      orgId: params.orgId,
      status: 'failed',
      errorMessage: sendRes.error,
    })
    return { sent: 0, failed: 1, skipped: 0, reason: 'send_failed' }
  }

  const sentAt = new Date().toISOString()
  await updateReminderLog({
    id: pendingLog.data.id,
    orgId: params.orgId,
    status: 'sent',
    sentAt,
  })
  await supabaseAdmin
    .from('notes_settings')
    .update({ last_daily_summary_sent_on: nowDateKey })
    .eq('org_id', params.orgId)
  return { sent: 1, failed: 0, skipped: 0, reason: 'sent' }
}

async function runReminderJob(request: Request) {
  const secret = process.env.NOTES_CRON_SECRET ?? process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: 'NOTES_CRON_SECRET or CRON_SECRET is not configured.' },
      { status: 500 }
    )
  }

  const auth = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  if (auth !== expected) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const [settingsRes, orgTaskRes] = await Promise.all([
    supabaseAdmin.from('notes_settings').select('*'),
    supabaseAdmin.from('notes_tasks').select('org_id').eq('status', 'active'),
  ])
  if (settingsRes.error) {
    return NextResponse.json({ error: 'Unable to load notes settings.' }, { status: 500 })
  }
  if (orgTaskRes.error) {
    return NextResponse.json({ error: 'Unable to load notes task organizations.' }, { status: 500 })
  }

  const settingsRows = (settingsRes.data ?? []) as NotesSettingsRow[]
  const settingsByOrg = new Map(settingsRows.map((row) => [row.org_id, row]))
  const orgIds = new Set(settingsRows.map((row) => row.org_id))
  for (const row of orgTaskRes.data ?? []) {
    if (typeof row.org_id === 'string' && row.org_id) orgIds.add(row.org_id)
  }

  const now = new Date()
  const origin = new URL(request.url).origin

  let organizationsProcessed = 0
  let remindersSent = 0
  let remindersFailed = 0
  let remindersSkipped = 0
  let dailySummariesSent = 0
  let dailySummariesFailed = 0
  let dailySummariesSkipped = 0

  for (const orgId of orgIds) {
    const settings = settingsByOrg.get(orgId)
    organizationsProcessed += 1

    const orgDefaults = await getOrgNotesDefaults(orgId).catch(() => ({
      name: 'ACE Painting CRM',
      timezone: 'America/Chicago',
      businessEmail: null as string | null,
    }))
    const timezone = resolveTimeZone(settings?.timezone || orgDefaults.timezone)
    const senderUserId = settings?.sender_user_id ?? (await resolveOrgSenderUserId(orgId).catch(() => null))
    const emailTo = settings?.daily_summary_email_to ?? orgDefaults.businessEmail

    const tasksRes = await supabaseAdmin
      .from('notes_tasks')
      .select('*')
      .eq('org_id', orgId)
      .eq('status', 'active')
      .limit(1000)
    if (tasksRes.error) {
      remindersFailed += 1
      dailySummariesFailed += 1
      continue
    }
    const tasks = (tasksRes.data ?? []) as NotesTaskRow[]

    const taskReminderResult = await processTaskReminders({
      origin,
      orgId,
      senderUserId,
      emailTo,
      crmName: orgDefaults.name,
      timezone,
      tasks,
    })
    remindersSent += taskReminderResult.sent
    remindersFailed += taskReminderResult.failed
    remindersSkipped += taskReminderResult.skipped

    const dailySummaryResult = await processDailySummary({
      origin,
      orgId,
      senderUserId,
      emailTo,
      crmName: orgDefaults.name,
      timezone,
      dailyTimeLocal: settings?.daily_summary_time_local || '07:00',
      now,
      tasks,
      settings: settings ?? {
        org_id: orgId,
        sender_user_id: senderUserId,
        daily_summary_email_to: emailTo,
        daily_summary_time_local: '07:00',
        timezone,
        show_upcoming_days: 3,
        last_daily_summary_attempted_on: null,
        last_daily_summary_sent_on: null,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
    })
    dailySummariesSent += dailySummaryResult.sent
    dailySummariesFailed += dailySummaryResult.failed
    dailySummariesSkipped += dailySummaryResult.skipped
  }

  return NextResponse.json({
    ok: true,
    organizations_processed: organizationsProcessed,
    reminders: {
      sent: remindersSent,
      failed: remindersFailed,
      skipped: remindersSkipped,
    },
    daily_summaries: {
      sent: dailySummariesSent,
      failed: dailySummariesFailed,
      skipped: dailySummariesSkipped,
    },
  })
}

export async function GET(request: Request) {
  return runReminderJob(request)
}

export async function POST(request: Request) {
  return runReminderJob(request)
}
