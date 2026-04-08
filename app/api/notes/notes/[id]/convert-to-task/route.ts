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
import type { NotesNoteRow, NotesTaskRow } from '@/lib/notes/types'

type Params = { id: string } | Promise<{ id: string }>

export async function POST(request: Request, context: { params: Params }) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const params = await Promise.resolve(context.params)
  const id = params?.id
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'Invalid note id.' }, { status: 400 })
  }

  const noteRes = await supabaseAdmin
    .from('notes_notes')
    .select('*')
    .eq('org_id', session.orgId)
    .eq('id', id)
    .maybeSingle()
  if (noteRes.error) {
    return NextResponse.json({ error: 'Unable to load note.' }, { status: 500 })
  }
  if (!noteRes.data) {
    return NextResponse.json({ error: 'Note not found.' }, { status: 404 })
  }
  const note = noteRes.data as NotesNoteRow

  const raw = await request.json().catch(() => null)
  const body = asRecord(raw) ?? {}
  const carryBody = asBoolean(body.carry_body, true)
  const dueAtIso = asNullableIso(body.due_at)
  const isAllDay = asBoolean(body.is_all_day, false)
  const hasDueTime = isAllDay ? false : asBoolean(body.has_due_time, Boolean(dueAtIso))
  const reminderEnabled = asBoolean(body.reminder_enabled, false)
  const reminderOffsetMinutes = normalizeReminderOffset(body.reminder_offset_minutes)
  const reminderAtIso = asNullableIso(body.reminder_at)
  const recurrenceRule = parseTaskRecurrenceRule(body.recurrence_rule)
  if (body.recurrence_rule != null && !recurrenceRule) {
    return NextResponse.json({ error: 'Invalid recurrence_rule.' }, { status: 400 })
  }

  const taskPayload = {
    org_id: session.orgId,
    title: note.title,
    description: carryBody ? note.body : asOptionalTrimmedText(body.description),
    status: 'active',
    due_at: dueAtIso,
    is_all_day: isAllDay,
    has_due_time: hasDueTime,
    reminder_enabled: reminderEnabled,
    reminder_offset_minutes: reminderOffsetMinutes,
    reminder_at: deriveReminderAt({
      reminderEnabled,
      reminderAtIso,
      dueAtIso,
      reminderOffsetMinutes,
    }),
    reminder_sent_at: null,
    recurrence_rule: recurrenceRule,
    recurrence_series_id: recurrenceRule ? crypto.randomUUID() : null,
    priority: asPriority(body.priority),
    starred: asBoolean(body.starred, note.starred),
    source_note_id: note.id,
    created_by: session.userId,
    completed_at: null,
    archived_at: null,
  }

  const insert = await supabaseAdmin.from('notes_tasks').insert(taskPayload).select('*').single()
  if (insert.error || !insert.data) {
    return NextResponse.json({ error: 'Unable to convert note to task.' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    task: insert.data as NotesTaskRow,
    source_note_id: note.id,
  })
}
