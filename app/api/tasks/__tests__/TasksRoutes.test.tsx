import { beforeEach, describe, expect, it, vi } from 'vitest'

type QueuedResult = { data?: unknown; error?: { message: string } | null }

const { mockSession, dbState, mockFrom } = vi.hoisted(() => {
  const state = {
    list: [] as QueuedResult[],
    maybeSingle: [] as QueuedResult[],
    single: [] as QueuedResult[],
    inserts: [] as unknown[],
    updates: [] as unknown[],
    deletes: 0,
  }

  function createBuilder() {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      or: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      insert: vi.fn((payload: unknown) => {
        state.inserts.push(payload)
        return builder
      }),
      update: vi.fn((payload: unknown) => {
        state.updates.push(payload)
        return builder
      }),
      delete: vi.fn(() => {
        state.deletes += 1
        return builder
      }),
      maybeSingle: vi.fn(async () => state.maybeSingle.shift() ?? { data: null, error: null }),
      single: vi.fn(async () => state.single.shift() ?? { data: null, error: null }),
      then: (resolve: (value: QueuedResult) => void) => {
        resolve(state.list.shift() ?? { data: [], error: null })
      },
    }
    return builder
  }

  return {
    mockSession: vi.fn(),
    dbState: state,
    mockFrom: vi.fn(() => createBuilder()),
  }
})

vi.mock('@/lib/server/org', () => ({
  getSessionUserOrg: mockSession,
  supabaseAdmin: {
    from: mockFrom,
  },
}))

import { POST as completeTaskRoute } from '../[id]/complete/route'
import { POST as reopenTaskRoute } from '../[id]/reopen/route'
import { DELETE as deleteTaskRoute } from '../[id]/route'
import { GET as listTasksRoute, POST as createTaskRoute } from '../route'

function jsonRequest(method: string, body?: unknown) {
  return new Request('http://localhost/api/tasks', {
    method,
    body: body == null ? undefined : JSON.stringify(body),
    headers: body == null ? undefined : { 'Content-Type': 'application/json' },
  })
}

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    org_id: 'org-1',
    title: 'Follow up',
    description: null,
    status: 'open',
    due_at: null,
    customer_id: null,
    job_id: null,
    estimate_id: null,
    created_by: 'user-1',
    created_at: '2026-04-28T12:00:00.000Z',
    updated_at: '2026-04-28T12:00:00.000Z',
    completed_at: null,
    ...overrides,
  }
}

describe('tasks routes', () => {
  beforeEach(() => {
    mockSession.mockResolvedValue({ orgId: 'org-1', userId: 'user-1' })
    mockFrom.mockClear()
    dbState.list = []
    dbState.maybeSingle = []
    dbState.single = []
    dbState.inserts = []
    dbState.updates = []
    dbState.deletes = 0
  })

  it('creates a simple CRM-linked task', async () => {
    const task = makeTask({
      title: 'Call customer',
      customer_id: '22222222-2222-4222-8222-222222222222',
      job_id: '33333333-3333-4333-8333-333333333333',
      estimate_id: '44444444-4444-4444-8444-444444444444',
    })
    dbState.single.push({ data: task, error: null })

    const response = await createTaskRoute(jsonRequest('POST', {
      title: ' Call customer ',
      description: '',
      due_at: '2026-04-29T15:00:00.000Z',
      customer_id: task.customer_id,
      job_id: task.job_id,
      estimate_id: task.estimate_id,
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: { task } })
    expect(mockFrom).toHaveBeenCalledWith('tasks')
    expect(dbState.inserts[0]).toMatchObject({
      org_id: 'org-1',
      title: 'Call customer',
      description: null,
      status: 'open',
      customer_id: task.customer_id,
      job_id: task.job_id,
      estimate_id: task.estimate_id,
      created_by: 'user-1',
    })
  })

  it('lists open tasks in a stable envelope', async () => {
    dbState.list.push({ data: [makeTask({ title: 'Today', due_at: new Date().toISOString() })], error: null })

    const response = await listTasksRoute(new Request('http://localhost/api/tasks?status=open&due=today'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        tasks: [expect.objectContaining({ title: 'Today', status: 'open' })],
        filters: { status: 'open', due: 'today', search: '' },
      },
    })
  })

  it('completes and reopens tasks with only open and done statuses', async () => {
    dbState.maybeSingle.push({ data: makeTask({ status: 'open' }), error: null })
    dbState.single.push({ data: makeTask({ status: 'done', completed_at: '2026-04-28T12:30:00.000Z' }), error: null })

    const complete = await completeTaskRoute(jsonRequest('POST'), {
      params: { id: '11111111-1111-4111-8111-111111111111' },
    })

    expect(complete.status).toBe(200)
    expect(dbState.updates[0]).toMatchObject({ status: 'done' })

    dbState.maybeSingle.push({ data: makeTask({ status: 'done' }), error: null })
    dbState.single.push({ data: makeTask({ status: 'open', completed_at: null }), error: null })

    const reopen = await reopenTaskRoute(jsonRequest('POST'), {
      params: { id: '11111111-1111-4111-8111-111111111111' },
    })

    expect(reopen.status).toBe(200)
    expect(dbState.updates[1]).toMatchObject({ status: 'open', completed_at: null })
  })

  it('deletes a task permanently', async () => {
    const response = await deleteTaskRoute(jsonRequest('DELETE'), {
      params: { id: '11111111-1111-4111-8111-111111111111' },
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: { ok: true } })
    expect(dbState.deletes).toBe(1)
  })
})
