import { NextResponse } from 'next/server'
import { readJsonBody } from '@/lib/server/apiRoute'
import { getSessionUserOrg, supabaseAdmin } from '@/lib/server/org'
import {
  asDueFilter,
  asNullableIso,
  asNullableTrimmedText,
  asNullableUuid,
  asRecord,
  asTaskListStatus,
  asTrimmedText,
  sortTasksForList,
  taskMatchesDueFilter,
} from '@/lib/tasks/server'
import type { TaskResponse, TaskRow, TasksListResponse } from '@/lib/tasks/types'

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status })
}

export async function GET(request: Request) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const message = session.error ?? 'Not authenticated'
    return errorResponse(message, message === 'Not authenticated' ? 401 : 403)
  }

  const { searchParams } = new URL(request.url)
  const status = asTaskListStatus(searchParams.get('status'))
  const due = asDueFilter(searchParams.get('due'))
  const search = (searchParams.get('search') ?? '').trim()

  try {
    let query = supabaseAdmin
      .from('tasks')
      .select('*')
      .eq('org_id', session.orgId)

    if (status !== 'all') query = query.eq('status', status)
    if (search) {
      const escaped = search.replace(/[,%.]/g, ' ')
      query = query.or(`title.ilike.%${escaped}%,description.ilike.%${escaped}%`)
    }

    const result = await query
    if (result.error) return errorResponse('Unable to load tasks.', 500)

    const rows = sortTasksForList((result.data ?? []) as TaskRow[])
      .filter((task) => taskMatchesDueFilter(task, due))

    return NextResponse.json<TasksListResponse>({
      data: {
        tasks: rows,
        filters: { status, due, search },
      },
    })
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Unable to load tasks.', 500)
  }
}

export async function POST(request: Request) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const message = session.error ?? 'Not authenticated'
    return errorResponse(message, message === 'Not authenticated' ? 401 : 403)
  }

  const parsed = await readJsonBody<Record<string, unknown>>(request, { maxBytes: 64 * 1024 })
  if (!parsed.ok) return parsed.response
  const body = asRecord(parsed.value)
  if (!body) return errorResponse('Invalid JSON body.', 400)

  const title = asTrimmedText(body.title)
  if (!title) return errorResponse('Task title is required.', 400)

  const customerId = asNullableUuid(body.customer_id, 'customer_id')
  if (!customerId.ok) return errorResponse(customerId.error, 400)
  const jobId = asNullableUuid(body.job_id, 'job_id')
  if (!jobId.ok) return errorResponse(jobId.error, 400)
  const estimateId = asNullableUuid(body.estimate_id, 'estimate_id')
  if (!estimateId.ok) return errorResponse(estimateId.error, 400)

  const payload = {
    org_id: session.orgId,
    title,
    description: asNullableTrimmedText(body.description),
    status: 'open',
    due_at: asNullableIso(body.due_at),
    customer_id: customerId.value,
    job_id: jobId.value,
    estimate_id: estimateId.value,
    created_by: session.userId,
    completed_at: null,
  }

  const result = await supabaseAdmin
    .from('tasks')
    .insert(payload)
    .select('*')
    .single()

  if (result.error || !result.data) return errorResponse('Unable to create task.', 500)

  return NextResponse.json<TaskResponse>({ data: { task: result.data as TaskRow } })
}
