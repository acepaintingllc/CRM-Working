import { NextResponse } from 'next/server'
import { getSessionUserOrg, supabaseAdmin } from '@/lib/server/org'
import { isUuid } from '@/lib/tasks/server'
import type { TaskResponse, TaskRow } from '@/lib/tasks/types'

type Params = { id: string } | Promise<{ id: string }>

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status })
}

export async function POST(_: Request, context: { params: Params }) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const message = session.error ?? 'Not authenticated'
    return errorResponse(message, message === 'Not authenticated' ? 401 : 403)
  }

  const { id } = await Promise.resolve(context.params)
  if (!id || !isUuid(id)) return errorResponse('Invalid task id.', 400)

  const existing = await supabaseAdmin
    .from('tasks')
    .select('*')
    .eq('org_id', session.orgId)
    .eq('id', id)
    .maybeSingle()

  if (existing.error) return errorResponse('Unable to load task.', 500)
  if (!existing.data) return errorResponse('Task not found.', 404)
  if ((existing.data as TaskRow).status !== 'done') return errorResponse('Only done tasks can be reopened.', 400)

  const result = await supabaseAdmin
    .from('tasks')
    .update({ status: 'open', completed_at: null })
    .eq('org_id', session.orgId)
    .eq('id', id)
    .select('*')
    .single()

  if (result.error || !result.data) return errorResponse('Unable to reopen task.', 500)
  return NextResponse.json<TaskResponse>({ data: { task: result.data as TaskRow } })
}
