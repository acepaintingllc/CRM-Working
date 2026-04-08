import { NextResponse } from 'next/server'
import { getSessionUserOrg, supabaseAdmin } from '@/lib/server/org'
import { computeNextDueAtIso } from '@/lib/notes/recurrence'
import { deriveReminderAt, isUuid, parseTaskRecurrenceRule } from '@/lib/notes/server'
import type { NotesTaskRow } from '@/lib/notes/types'

type Params = { id: string } | Promise<{ id: string }>

export async function POST(_: Request, context: { params: Params }) {
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

  const taskQuery = await supabaseAdmin
    .from('notes_tasks')
    .select('*')
    .eq('org_id', session.orgId)
    .eq('id', id)
    .maybeSingle()

  if (taskQuery.error) {
    return NextResponse.json({ error: 'Unable to load task.' }, { status: 500 })
  }
  if (!taskQuery.data) {
    return NextResponse.json({ error: 'Task not found.' }, { status: 404 })
  }

  const existing = taskQuery.data as NotesTaskRow
  if (existing.status !== 'active') {
    return NextResponse.json({ error: 'Only active tasks can be completed.' }, { status: 400 })
  }

  const completedAt = new Date().toISOString()
  const completedUpdate = await supabaseAdmin
    .from('notes_tasks')
    .update({
      status: 'completed',
      completed_at: completedAt,
      archived_at: null,
    })
    .eq('org_id', session.orgId)
    .eq('id', existing.id)
    .select('*')
    .single()

  if (completedUpdate.error || !completedUpdate.data) {
    return NextResponse.json({ error: 'Unable to complete task.' }, { status: 500 })
  }

  const recurrenceRule = parseTaskRecurrenceRule(existing.recurrence_rule)
  let nextTask: NotesTaskRow | null = null

  if (recurrenceRule) {
    const seriesId = existing.recurrence_series_id ?? crypto.randomUUID()
    const nextDueAt = computeNextDueAtIso({
      currentDueAtIso: existing.due_at,
      completedAt: new Date(completedAt),
      recurrenceRule,
    })
    const nextReminderAt = deriveReminderAt({
      reminderEnabled: existing.reminder_enabled,
      dueAtIso: nextDueAt,
      reminderOffsetMinutes: existing.reminder_offset_minutes,
    })

    const nextInsert = await supabaseAdmin
      .from('notes_tasks')
      .insert({
        org_id: session.orgId,
        title: existing.title,
        description: existing.description,
        status: 'active',
        due_at: nextDueAt,
        is_all_day: existing.is_all_day,
        has_due_time: existing.has_due_time,
        reminder_enabled: existing.reminder_enabled,
        reminder_at: nextReminderAt,
        reminder_offset_minutes: existing.reminder_offset_minutes,
        reminder_sent_at: null,
        recurrence_rule: recurrenceRule,
        recurrence_series_id: seriesId,
        priority: existing.priority,
        starred: existing.starred,
        source_note_id: existing.source_note_id,
        created_by: session.userId,
      })
      .select('*')
      .single()

    if (nextInsert.error) {
      return NextResponse.json(
        {
          error: 'Task completed, but failed to create next recurring occurrence.',
        },
        { status: 500 }
      )
    }

    nextTask = nextInsert.data as NotesTaskRow

    await supabaseAdmin
      .from('notes_tasks')
      .update({ recurrence_series_id: seriesId })
      .eq('org_id', session.orgId)
      .eq('id', existing.id)
  }

  return NextResponse.json({
    ok: true,
    task: completedUpdate.data as NotesTaskRow,
    next_task: nextTask,
  })
}
