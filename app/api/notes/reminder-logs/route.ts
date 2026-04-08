import { NextResponse } from 'next/server'
import { getSessionUserOrg, supabaseAdmin } from '@/lib/server/org'
import type { NotesTaskRow } from '@/lib/notes/types'

const allowedStatuses = new Set(['pending', 'sent', 'failed', 'skipped'])
const allowedTypes = new Set(['daily_summary', 'single_task_reminder', 'recurring_task_reminder'])

export async function GET(request: Request) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const { searchParams } = new URL(request.url)
  const statusFilter = searchParams.get('status')
  const typeFilter = searchParams.get('reminder_type')
  const limitRaw = searchParams.get('limit')
  const limit = limitRaw && /^\d+$/.test(limitRaw) ? Math.min(200, Number(limitRaw)) : 100

  let query = supabaseAdmin
    .from('notes_reminder_logs')
    .select('*')
    .eq('org_id', session.orgId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (statusFilter && allowedStatuses.has(statusFilter)) {
    query = query.eq('status', statusFilter)
  }
  if (typeFilter && allowedTypes.has(typeFilter)) {
    query = query.eq('reminder_type', typeFilter)
  }

  const logsRes = await query
  if (logsRes.error) {
    return NextResponse.json({ error: 'Unable to load reminder logs.' }, { status: 500 })
  }

  const logs = logsRes.data ?? []
  const taskIds = Array.from(
    new Set(
      logs
        .map((row) => row.task_id)
        .filter((value): value is string => typeof value === 'string')
    )
  )

  const taskTitleById = new Map<string, string>()
  if (taskIds.length > 0) {
    const taskRes = await supabaseAdmin
      .from('notes_tasks')
      .select('id, title')
      .eq('org_id', session.orgId)
      .in('id', taskIds)
    if (!taskRes.error) {
      for (const row of (taskRes.data ?? []) as Pick<NotesTaskRow, 'id' | 'title'>[]) {
        taskTitleById.set(row.id, row.title)
      }
    }
  }

  return NextResponse.json({
    logs: logs.map((row) => ({
      ...row,
      task_title: row.task_id ? taskTitleById.get(row.task_id) ?? null : null,
    })),
  })
}
