import { NextResponse } from 'next/server'
import { getSessionUserOrg, supabaseAdmin } from '@/lib/server/org'
import { deriveReminderAt, isUuid } from '@/lib/notes/server'
import { getNotesSettingsWithDefaults } from '@/lib/notes/settings'
import {
  getDatePartsInTimeZone,
  getTodayBoundsInTimeZone,
  localDateKey,
  makeUtcDateForTimeZone,
} from '@/lib/notes/time'
import type { NotesTaskRow } from '@/lib/notes/types'

type Params = { id: string } | Promise<{ id: string }>

type SnoozeAction = 'later_today' | 'tomorrow' | 'next_week'

function dueTimeForTask(task: NotesTaskRow, timeZone: string) {
  if (!task.due_at || task.is_all_day || !task.has_due_time) {
    return { hour: 9, minute: 0 }
  }
  const parts = getDatePartsInTimeZone(new Date(task.due_at), timeZone)
  return { hour: parts.hour, minute: parts.minute }
}

function computeSnoozeDueAt(params: {
  action: SnoozeAction
  now: Date
  task: NotesTaskRow
  timeZone: string
}) {
  const time = dueTimeForTask(params.task, params.timeZone)
  const today = getTodayBoundsInTimeZone(params.now, params.timeZone)
  const todayParts = getDatePartsInTimeZone(today.start, params.timeZone)

  if (params.action === 'later_today') {
    const nowParts = getDatePartsInTimeZone(params.now, params.timeZone)
    let hour = Math.min(23, nowParts.hour + 2)
    if (hour === nowParts.hour) hour = Math.min(23, nowParts.hour + 1)
    const due = makeUtcDateForTimeZone({
      year: todayParts.year,
      month: todayParts.month,
      day: todayParts.day,
      hour,
      minute: nowParts.minute,
      timeZone: params.timeZone,
    })
    if (due.getTime() <= params.now.getTime()) {
      return new Date(params.now.getTime() + 60 * 60 * 1000)
    }
    return due
  }

  const dayOffset = params.action === 'tomorrow' ? 1 : 7
  const nextDayStart = new Date(today.start.getTime())
  nextDayStart.setUTCDate(nextDayStart.getUTCDate() + dayOffset)
  const nextParts = getDatePartsInTimeZone(nextDayStart, params.timeZone)
  return makeUtcDateForTimeZone({
    year: nextParts.year,
    month: nextParts.month,
    day: nextParts.day,
    hour: time.hour,
    minute: time.minute,
    timeZone: params.timeZone,
  })
}

export async function POST(request: Request, context: { params: Params }) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const params = await Promise.resolve(context.params)
  const id = params?.id
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'Invalid task id.' }, { status: 400 })
  }

  const raw = await request.json().catch(() => null)
  const action = (raw && typeof raw === 'object' ? (raw as { action?: unknown }).action : null) as
    | string
    | null
  if (action !== 'later_today' && action !== 'tomorrow' && action !== 'next_week') {
    return NextResponse.json({ error: 'action must be later_today, tomorrow, or next_week.' }, { status: 400 })
  }

  const taskRes = await supabaseAdmin
    .from('notes_tasks')
    .select('*')
    .eq('org_id', session.orgId)
    .eq('id', id)
    .maybeSingle()

  if (taskRes.error) return NextResponse.json({ error: 'Unable to load task.' }, { status: 500 })
  if (!taskRes.data) return NextResponse.json({ error: 'Task not found.' }, { status: 404 })

  const task = taskRes.data as NotesTaskRow
  if (task.status !== 'active') {
    return NextResponse.json({ error: 'Only active tasks can be snoozed.' }, { status: 400 })
  }

  const { defaults } = await getNotesSettingsWithDefaults({
    orgId: session.orgId,
    fallbackUserId: session.userId,
  })

  const now = new Date()
  const nextDue = computeSnoozeDueAt({
    action,
    now,
    task,
    timeZone: defaults.timezone,
  })
  const nextDueIso = nextDue.toISOString()

  let reminderAt = deriveReminderAt({
    reminderEnabled: task.reminder_enabled,
    dueAtIso: nextDueIso,
    reminderOffsetMinutes: task.reminder_offset_minutes,
  })

  if (
    reminderAt == null &&
    task.reminder_enabled &&
    task.reminder_at &&
    task.due_at &&
    !task.reminder_offset_minutes
  ) {
    const oldDue = new Date(task.due_at)
    const oldReminder = new Date(task.reminder_at)
    if (!Number.isNaN(oldDue.getTime()) && !Number.isNaN(oldReminder.getTime())) {
      const delta = oldDue.getTime() - oldReminder.getTime()
      reminderAt = new Date(nextDue.getTime() - delta).toISOString()
    }
  }

  const update = await supabaseAdmin
    .from('notes_tasks')
    .update({
      due_at: nextDueIso,
      reminder_at: reminderAt,
      reminder_sent_at: null,
      is_all_day: action === 'later_today' ? false : task.is_all_day,
      has_due_time: action === 'later_today' ? true : task.has_due_time,
    })
    .eq('org_id', session.orgId)
    .eq('id', task.id)
    .select('*')
    .single()

  if (update.error || !update.data) {
    return NextResponse.json({ error: 'Unable to snooze task.' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    task: update.data as NotesTaskRow,
    snoozed_to_date: localDateKey(nextDue, defaults.timezone),
  })
}
