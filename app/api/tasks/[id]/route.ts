import { NextResponse } from 'next/server'
import { readJsonBody } from '@/lib/server/apiRoute'
import { getSessionUserOrg, supabaseAdmin } from '@/lib/server/org'
import {
  asNullableIso,
  asNullableTrimmedText,
  asNullableUuid,
  asRecord,
  asTaskStatus,
  asTrimmedText,
  isUuid,
} from '@/lib/tasks/server'
import type { TaskOkResponse, TaskResponse, TaskRow } from '@/lib/tasks/types'

type Params = { id: string } | Promise<{ id: string }>

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status })
}

async function loadTask(orgId: string, id: string): Promise<
  | { task: TaskRow }
  | { error: string; status: 500 | 404 }
> {
  const result = await supabaseAdmin
    .from('tasks')
    .select('*')
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle()

  if (result.error) return { error: 'Unable to load task.', status: 500 as const }
  if (!result.data) return { error: 'Task not found.', status: 404 as const }
  return { task: result.data as TaskRow }
}

export async function GET(_: Request, context: { params: Params }) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const message = session.error ?? 'Not authenticated'
    return errorResponse(message, message === 'Not authenticated' ? 401 : 403)
  }

  const { id } = await Promise.resolve(context.params)
  if (!id || !isUuid(id)) return errorResponse('Invalid task id.', 400)

  const loaded = await loadTask(session.orgId, id)
  if ('error' in loaded) return errorResponse(loaded.error, loaded.status)

  return NextResponse.json<TaskResponse>({ data: { task: loaded.task } })
}

export async function PATCH(request: Request, context: { params: Params }) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const message = session.error ?? 'Not authenticated'
    return errorResponse(message, message === 'Not authenticated' ? 401 : 403)
  }

  const { id } = await Promise.resolve(context.params)
  if (!id || !isUuid(id)) return errorResponse('Invalid task id.', 400)

  const parsed = await readJsonBody<Record<string, unknown>>(request, { maxBytes: 64 * 1024 })
  if (!parsed.ok) return parsed.response
  const body = asRecord(parsed.value)
  if (!body) return errorResponse('Invalid JSON body.', 400)

  const patch: Record<string, unknown> = {}

  if ('title' in body) {
    const title = asTrimmedText(body.title)
    if (!title) return errorResponse('Task title is required.', 400)
    patch.title = title
  }
  if ('description' in body) patch.description = asNullableTrimmedText(body.description)
  if ('due_at' in body) patch.due_at = asNullableIso(body.due_at)
  if ('status' in body) {
    const status = asTaskStatus(body.status)
    if (!status) return errorResponse('Invalid task status.', 400)
    patch.status = status
    patch.completed_at = status === 'done' ? new Date().toISOString() : null
  }

  for (const field of ['customer_id', 'job_id', 'estimate_id'] as const) {
    if (field in body) {
      const value = asNullableUuid(body[field], field)
      if (!value.ok) return errorResponse(value.error, 400)
      patch[field] = value.value
    }
  }

  const result = await supabaseAdmin
    .from('tasks')
    .update(patch)
    .eq('org_id', session.orgId)
    .eq('id', id)
    .select('*')
    .single()

  if (result.error || !result.data) return errorResponse('Unable to update task.', 500)

  return NextResponse.json<TaskResponse>({ data: { task: result.data as TaskRow } })
}

export async function DELETE(_: Request, context: { params: Params }) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const message = session.error ?? 'Not authenticated'
    return errorResponse(message, message === 'Not authenticated' ? 401 : 403)
  }

  const { id } = await Promise.resolve(context.params)
  if (!id || !isUuid(id)) return errorResponse('Invalid task id.', 400)

  const result = await supabaseAdmin
    .from('tasks')
    .delete()
    .eq('org_id', session.orgId)
    .eq('id', id)

  if (result.error) return errorResponse('Unable to delete task.', 500)
  return NextResponse.json<TaskOkResponse>({ data: { ok: true } })
}
