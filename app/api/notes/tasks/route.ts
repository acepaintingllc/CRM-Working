import { NextResponse } from 'next/server'
import { getSessionUserOrg, supabaseAdmin } from '@/lib/server/org'
import { readJsonBody } from '@/lib/server/apiRoute'
import {
  asBoolean,
  asNullableIso,
  asOptionalTrimmedText,
  asPriority,
  asRecord,
  deriveReminderAt,
  isUuid,
  normalizeReminderOffset,
  parseTaskRecurrenceRule,
} from '@/lib/notes/server'
import { getNotesSettingsWithDefaults } from '@/lib/notes/settings'
import { partitionTasksForDashboard } from '@/lib/notes/reminders'
import type { NotesTaskRow, NotesTaskStatus } from '@/lib/notes/types'

function normalizeTaskRows(rows: NotesTaskRow[]) {
  return rows.map((row) => ({
    ...row,
    recurrence_rule: parseTaskRecurrenceRule(row.recurrence_rule),
  }))
}

function asTaskStatus(value: string | null): NotesTaskStatus | null {
  if (value === 'active' || value === 'completed' || value === 'archived') return value
  return null
}

export async function GET(request: Request) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }
  const { orgId, userId } = session

  const { searchParams } = new URL(request.url)
  const status = asTaskStatus(searchParams.get('status')) ?? 'active'
  const due = searchParams.get('due') ?? 'all'
  const starredOnly = searchParams.get('starred') === 'true'
  const priority = asPriority(searchParams.get('priority'))
  const search = (searchParams.get('search') ?? '').trim().toLowerCase()

  try {
    const [{ defaults }, query] = await Promise.all([
      getNotesSettingsWithDefaults({ orgId, fallbackUserId: userId }),
      supabaseAdmin
        .from('notes_tasks')
        .select('*')
        .eq('org_id', orgId)
        .eq('status', status)
        .order('starred', { ascending: false })
        .order('due_at', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(500),
    ])

    if (query.error) {
      return NextResponse.json({ error: 'Unable to load tasks.' }, { status: 500 })
    }

    let tasks = normalizeTaskRows((query.data ?? []) as NotesTaskRow[])

    if (search) {
      tasks = tasks.filter((task) => {
        const haystack = `${task.title} ${task.description ?? ''}`.toLowerCase()
        return haystack.includes(search)
      })
    }
    if (starredOnly) {
      tasks = tasks.filter((task) => task.starred)
    }
    if (priority) {
      tasks = tasks.filter((task) => task.priority === priority)
    }

    if (status === 'active' && due !== 'all') {
      const grouped = partitionTasksForDashboard({
        tasks,
        now: new Date(),
        timeZone: defaults.timezone,
        upcomingDays: defaults.showUpcomingDays,
      })
      if (due === 'overdue') tasks = grouped.overdue
      if (due === 'today') tasks = grouped.dueToday
      if (due === 'upcoming') tasks = grouped.upcoming
    }

    return NextResponse.json({
      tasks,
      filters: {
        status,
        due,
        starred: starredOnly,
        priority,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load tasks.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }
  const { orgId, userId } = session

  const parsed = await readJsonBody<Record<string, unknown>>(request, { maxBytes: 128 * 1024 })
  if (!parsed.ok) return parsed.response
  const body = asRecord(parsed.value)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const title = asOptionalTrimmedText(body.title)
  if (!title) {
    return NextResponse.json({ error: 'Task title is required.' }, { status: 400 })
  }

  const dueAtIso = asNullableIso(body.due_at)
  const isAllDay = asBoolean(body.is_all_day, false)
  const hasDueTime = isAllDay ? false : asBoolean(body.has_due_time, Boolean(dueAtIso))
  const reminderEnabled = asBoolean(body.reminder_enabled, false)
  const reminderOffsetMinutes = normalizeReminderOffset(body.reminder_offset_minutes)
  const reminderAtIso = asNullableIso(body.reminder_at)
  const derivedReminderAt = deriveReminderAt({
    reminderEnabled,
    reminderAtIso,
    dueAtIso,
    reminderOffsetMinutes,
  })
  const recurrenceRule = parseTaskRecurrenceRule(body.recurrence_rule)
  if (body.recurrence_rule != null && !recurrenceRule) {
    return NextResponse.json({ error: 'Invalid recurrence_rule.' }, { status: 400 })
  }
  const priority = asPriority(body.priority)
  const sourceNoteIdRaw = asOptionalTrimmedText(body.source_note_id)
  if (sourceNoteIdRaw && !isUuid(sourceNoteIdRaw)) {
    return NextResponse.json({ error: 'source_note_id must be a UUID.' }, { status: 400 })
  }

  const payload = {
    org_id: orgId,
    title,
    description: asOptionalTrimmedText(body.description),
    status: 'active',
    due_at: dueAtIso,
    is_all_day: isAllDay,
    has_due_time: hasDueTime,
    reminder_enabled: reminderEnabled,
    reminder_at: derivedReminderAt,
    reminder_offset_minutes: reminderOffsetMinutes,
    reminder_sent_at: null,
    recurrence_rule: recurrenceRule,
    recurrence_series_id: null,
    priority,
    starred: asBoolean(body.starred, false),
    source_note_id: sourceNoteIdRaw,
    created_by: userId,
    completed_at: null,
    archived_at: null,
  }

  const insert = await supabaseAdmin.from('notes_tasks').insert(payload).select('*').single()
  if (insert.error || !insert.data) {
    return NextResponse.json({ error: 'Unable to create task.' }, { status: 500 })
  }

  const task = normalizeTaskRows([insert.data as NotesTaskRow])[0]
  return NextResponse.json({ ok: true, task })
}
