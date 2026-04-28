import { NextResponse } from 'next/server'
import { getSessionUserOrg, supabaseAdmin } from '@/lib/server/org'
import { sortTasksForList, taskMatchesDueFilter } from '@/lib/tasks/server'
import type { TaskRow } from '@/lib/tasks/types'

export async function GET() {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const result = await supabaseAdmin
    .from('tasks')
    .select('*')
    .eq('org_id', session.orgId)
    .eq('status', 'open')

  if (result.error) {
    return NextResponse.json({ error: 'Unable to load task dashboard.' }, { status: 500 })
  }

  const tasks = sortTasksForList((result.data ?? []) as TaskRow[])
  return NextResponse.json({
    data: {
      tasks: {
        overdue: tasks.filter((task) => taskMatchesDueFilter(task, 'overdue')),
        due_today: tasks.filter((task) => taskMatchesDueFilter(task, 'today')),
      },
    },
  })
}
