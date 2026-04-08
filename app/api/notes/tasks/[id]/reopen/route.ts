import { NextResponse } from 'next/server'
import { getSessionUserOrg, supabaseAdmin } from '@/lib/server/org'
import { isUuid } from '@/lib/notes/server'
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

  const taskRes = await supabaseAdmin
    .from('notes_tasks')
    .select('*')
    .eq('org_id', session.orgId)
    .eq('id', id)
    .maybeSingle()

  if (taskRes.error) return NextResponse.json({ error: 'Unable to load task.' }, { status: 500 })
  if (!taskRes.data) return NextResponse.json({ error: 'Task not found.' }, { status: 404 })

  const task = taskRes.data as NotesTaskRow
  if (task.status !== 'completed') {
    return NextResponse.json({ error: 'Only completed tasks can be reopened.' }, { status: 400 })
  }

  if (task.recurrence_series_id) {
    const activeSibling = await supabaseAdmin
      .from('notes_tasks')
      .select('id')
      .eq('org_id', session.orgId)
      .eq('recurrence_series_id', task.recurrence_series_id)
      .eq('status', 'active')
      .neq('id', task.id)
      .limit(1)
      .maybeSingle()

    if (activeSibling.error) {
      return NextResponse.json({ error: 'Unable to validate recurrence state.' }, { status: 500 })
    }
    if (activeSibling.data?.id) {
      return NextResponse.json(
        { error: 'Cannot reopen this occurrence because a newer active recurring occurrence already exists.' },
        { status: 409 }
      )
    }
  }

  const update = await supabaseAdmin
    .from('notes_tasks')
    .update({
      status: 'active',
      completed_at: null,
      archived_at: null,
      reminder_sent_at: null,
    })
    .eq('org_id', session.orgId)
    .eq('id', task.id)
    .select('*')
    .single()

  if (update.error || !update.data) {
    return NextResponse.json({ error: 'Unable to reopen task.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, task: update.data as NotesTaskRow })
}
