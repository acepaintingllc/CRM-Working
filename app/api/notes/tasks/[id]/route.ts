import { NextResponse } from 'next/server'
import { getSessionUserOrg, supabaseAdmin } from '@/lib/server/org'
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
import type { NotesTaskRow } from '@/lib/notes/types'

type Params = { id: string } | Promise<{ id: string }>

async function loadTask(orgId: string, id: string) {
  const query = await supabaseAdmin
    .from('notes_tasks')
    .select('*')
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle()

  if (query.error) return { error: query.error.message, status: 500 as const }
  if (!query.data) return { error: 'Task not found.', status: 404 as const }
  return { task: query.data as NotesTaskRow }
}

export async function PATCH(request: Request, context: { params: Params }) {
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

  const loaded = await loadTask(session.orgId, id)
  if ('error' in loaded) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status })
  }
  const existing = loaded.task

  const rawBody = await request.json().catch(() => null)
  const body = asRecord(rawBody)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}

  if ('title' in body) {
    const title = asOptionalTrimmedText(body.title)
    if (!title) {
      return NextResponse.json({ error: 'Task title is required.' }, { status: 400 })
    }
    patch.title = title
  }

  if ('description' in body) {
    patch.description = asOptionalTrimmedText(body.description)
  }

  let dueAtIso = existing.due_at
  if ('due_at' in body) {
    dueAtIso = asNullableIso(body.due_at)
    patch.due_at = dueAtIso
  }

  let isAllDay = existing.is_all_day
  if ('is_all_day' in body) {
    isAllDay = asBoolean(body.is_all_day, existing.is_all_day)
    patch.is_all_day = isAllDay
  }

  let hasDueTime = existing.has_due_time
  if ('has_due_time' in body) {
    hasDueTime = isAllDay ? false : asBoolean(body.has_due_time, existing.has_due_time)
    patch.has_due_time = hasDueTime
  } else if ('is_all_day' in body) {
    hasDueTime = isAllDay ? false : existing.has_due_time
    patch.has_due_time = hasDueTime
  }

  if ('priority' in body) {
    patch.priority = asPriority(body.priority)
  }

  if ('starred' in body) {
    patch.starred = asBoolean(body.starred, existing.starred)
  }

  if ('source_note_id' in body) {
    const value = asOptionalTrimmedText(body.source_note_id)
    if (value && !isUuid(value)) {
      return NextResponse.json({ error: 'source_note_id must be a UUID.' }, { status: 400 })
    }
    patch.source_note_id = value
  }

  if ('recurrence_rule' in body) {
    if (body.recurrence_rule == null) {
      patch.recurrence_rule = null
      patch.recurrence_series_id = null
    } else {
      const parsed = parseTaskRecurrenceRule(body.recurrence_rule)
      if (!parsed) {
        return NextResponse.json({ error: 'Invalid recurrence_rule.' }, { status: 400 })
      }
      patch.recurrence_rule = parsed
      patch.recurrence_series_id = existing.recurrence_series_id ?? crypto.randomUUID()
    }
  }

  let reminderEnabled = existing.reminder_enabled
  if ('reminder_enabled' in body) {
    reminderEnabled = asBoolean(body.reminder_enabled, existing.reminder_enabled)
    patch.reminder_enabled = reminderEnabled
  }
  let reminderOffsetMinutes = existing.reminder_offset_minutes
  if ('reminder_offset_minutes' in body) {
    reminderOffsetMinutes = normalizeReminderOffset(body.reminder_offset_minutes)
    patch.reminder_offset_minutes = reminderOffsetMinutes
  }

  const explicitReminderFieldPresent = 'reminder_at' in body
  const explicitReminderAt = explicitReminderFieldPresent ? asNullableIso(body.reminder_at) : existing.reminder_at

  if (explicitReminderFieldPresent || 'due_at' in body || 'reminder_enabled' in body || 'reminder_offset_minutes' in body) {
    const nextReminderAt = deriveReminderAt({
      reminderEnabled,
      reminderAtIso: explicitReminderAt,
      dueAtIso,
      reminderOffsetMinutes,
    })
    patch.reminder_at = nextReminderAt
    patch.reminder_sent_at = null
  }

  const update = await supabaseAdmin
    .from('notes_tasks')
    .update(patch)
    .eq('org_id', session.orgId)
    .eq('id', id)
    .select('*')
    .single()

  if (update.error || !update.data) {
    return NextResponse.json({ error: 'Unable to update task.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, task: update.data as NotesTaskRow })
}

export async function DELETE(_: Request, context: { params: Params }) {
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

  const del = await supabaseAdmin
    .from('notes_tasks')
    .delete()
    .eq('org_id', session.orgId)
    .eq('id', id)

  if (del.error) {
    return NextResponse.json({ error: 'Unable to delete task.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
