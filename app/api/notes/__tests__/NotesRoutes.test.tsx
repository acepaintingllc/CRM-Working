import { beforeEach, describe, expect, it, vi } from 'vitest'

type QueryResult = { data: unknown; error: { message: string } | null }

const {
  mockServerGetSessionUserOrg,
  mockGetNotesSettingsWithDefaults,
  mockComputeNextDueAtIso,
  mockParseTaskRecurrenceRule,
  mockDeriveReminderAt,
  mockPartitionTasksForDashboard,
  mockDb,
  mockRandomUUID,
} = vi.hoisted(() => {
  const state = {
    queued: {
      notes_tasks: {
        list: [] as QueryResult[],
        maybeSingle: [] as QueryResult[],
        single: [] as QueryResult[],
      },
      notes_notes: {
        list: [] as QueryResult[],
        maybeSingle: [] as QueryResult[],
        single: [] as QueryResult[],
      },
    },
    updates: [] as Array<{ table: string; payload: unknown }>,
    inserts: [] as Array<{ table: string; payload: unknown }>,
    from: vi.fn((table: 'notes_tasks' | 'notes_notes') => {
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        is: vi.fn(() => builder),
        or: vi.fn(() => builder),
        order: vi.fn(() => builder),
        limit: vi.fn(() => builder),
        update: vi.fn((payload: unknown) => {
          state.updates.push({ table, payload })
          return builder
        }),
        insert: vi.fn((payload: unknown) => {
          state.inserts.push({ table, payload })
          return builder
        }),
        delete: vi.fn(() => builder),
        maybeSingle: vi.fn(async () => state.queued[table].maybeSingle.shift() ?? { data: null, error: null }),
        single: vi.fn(async () => state.queued[table].single.shift() ?? { data: null, error: null }),
        then: (onFulfilled: (value: QueryResult) => unknown, onRejected?: (reason: unknown) => unknown) =>
          Promise.resolve(state.queued[table].list.shift() ?? { data: [], error: null }).then(onFulfilled, onRejected),
      }
      return builder
    }),
    reset() {
      state.queued.notes_tasks.list = []
      state.queued.notes_tasks.maybeSingle = []
      state.queued.notes_tasks.single = []
      state.queued.notes_notes.list = []
      state.queued.notes_notes.maybeSingle = []
      state.queued.notes_notes.single = []
      state.updates = []
      state.inserts = []
      state.from.mockClear()
    },
  }

  return {
    mockServerGetSessionUserOrg: vi.fn(),
    mockGetNotesSettingsWithDefaults: vi.fn(),
    mockComputeNextDueAtIso: vi.fn(),
    mockParseTaskRecurrenceRule: vi.fn(),
    mockDeriveReminderAt: vi.fn(),
    mockPartitionTasksForDashboard: vi.fn(),
    mockRandomUUID: vi.fn(() => 'series-generated'),
    mockDb: state,
  }
})

vi.mock('@/lib/server/org', () => ({
  getSessionUserOrg: mockServerGetSessionUserOrg,
  supabaseAdmin: {
    from: mockDb.from,
  },
}))

vi.mock('@/lib/notes/settings', () => ({
  getNotesSettingsWithDefaults: mockGetNotesSettingsWithDefaults,
}))

vi.mock('@/lib/notes/recurrence', async () => {
  const actual = await vi.importActual<typeof import('@/lib/notes/recurrence')>('@/lib/notes/recurrence')
  return {
    ...actual,
    computeNextDueAtIso: mockComputeNextDueAtIso,
  }
})

vi.mock('@/lib/notes/server', async () => {
  const actual = await vi.importActual<typeof import('@/lib/notes/server')>('@/lib/notes/server')
  return {
    ...actual,
    parseTaskRecurrenceRule: mockParseTaskRecurrenceRule,
    deriveReminderAt: mockDeriveReminderAt,
  }
})

vi.mock('@/lib/notes/reminders', async () => {
  const actual = await vi.importActual<typeof import('@/lib/notes/reminders')>('@/lib/notes/reminders')
  return {
    ...actual,
    partitionTasksForDashboard: mockPartitionTasksForDashboard,
  }
})

import { GET as dashboardRoute } from '../dashboard/route'
import { GET as listNotesRoute } from '../notes/route'
import { POST as completeTaskRoute } from '../tasks/[id]/complete/route'
import { POST as snoozeTaskRoute } from '../tasks/[id]/snooze/route'
import { GET as listTasksRoute } from '../tasks/route'
import { PATCH as patchTaskRoute } from '../tasks/[id]/route'

function jsonRequest(method: string, body: unknown) {
  return new Request(`http://localhost/${method.toLowerCase()}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'd4e9f6ea-4ac6-4e8f-8e62-a4bc90f2d67d',
    org_id: 'org-1',
    title: 'Follow up',
    description: 'Call back',
    status: 'active',
    due_at: '2026-04-21T15:00:00.000Z',
    is_all_day: false,
    has_due_time: true,
    reminder_enabled: true,
    reminder_at: '2026-04-21T14:00:00.000Z',
    reminder_offset_minutes: 60,
    reminder_sent_at: '2026-04-21T13:30:00.000Z',
    recurrence_rule: null,
    recurrence_series_id: null,
    priority: 'medium',
    starred: false,
    source_note_id: null,
    created_by: 'user-1',
    created_at: '2026-04-21T12:00:00.000Z',
    updated_at: '2026-04-21T12:00:00.000Z',
    completed_at: null,
    archived_at: null,
    ...overrides,
  }
}

function makeNote(overrides: Record<string, unknown> = {}) {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    org_id: 'org-1',
    title: 'Customer idea',
    body: 'Body',
    folder_id: null,
    status: 'active',
    starred: false,
    created_by: null,
    created_at: '2026-04-21T12:00:00.000Z',
    updated_at: '2026-04-21T12:00:00.000Z',
    archived_at: null,
    ...overrides,
  }
}

describe('notes routes', () => {
  beforeEach(() => {
    mockDb.reset()
    mockServerGetSessionUserOrg.mockReset()
    mockGetNotesSettingsWithDefaults.mockReset()
    mockComputeNextDueAtIso.mockReset()
    mockParseTaskRecurrenceRule.mockReset()
    mockDeriveReminderAt.mockReset()
    mockPartitionTasksForDashboard.mockReset()
    mockRandomUUID.mockReset()
    mockRandomUUID.mockReturnValue('series-generated')
    vi.stubGlobal('crypto', { randomUUID: mockRandomUUID })

    mockServerGetSessionUserOrg.mockResolvedValue({
      orgId: 'org-1',
      userId: 'user-1',
    })
    mockGetNotesSettingsWithDefaults.mockResolvedValue({
      settings: null,
      defaults: {
        orgName: 'ACE CRM',
        timezone: 'America/Chicago',
        showUpcomingDays: 3,
        dailySummaryTimeLocal: '06:00',
        dailySummaryEmailTo: null,
        senderUserId: 'user-1',
      },
    })
    mockDeriveReminderAt.mockReturnValue('2026-04-22T13:00:00.000Z')
  })

  it('completes an active non-recurring task without creating a follow-up task', async () => {
    mockDb.queued.notes_tasks.maybeSingle.push({
      data: makeTask({ recurrence_rule: null, recurrence_series_id: null }),
      error: null,
    })
    mockDb.queued.notes_tasks.single.push({
      data: makeTask({
        status: 'completed',
        completed_at: '2026-04-21T16:00:00.000Z',
        archived_at: null,
      }),
      error: null,
    })
    mockParseTaskRecurrenceRule.mockReturnValue(null)

    const response = await completeTaskRoute(new Request('http://localhost/complete', { method: 'POST' }), {
      params: { id: 'd4e9f6ea-4ac6-4e8f-8e62-a4bc90f2d67d' },
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      task: expect.objectContaining({ status: 'completed' }),
      next_task: null,
    })
    expect(mockDb.inserts).toEqual([])
  })

  it('completes a recurring task and creates the next occurrence', async () => {
    const recurrenceRule = { frequency: 'weekly' }
    mockDb.queued.notes_tasks.maybeSingle.push({
      data: makeTask({
        recurrence_rule: recurrenceRule,
        recurrence_series_id: null,
      }),
      error: null,
    })
    mockDb.queued.notes_tasks.single.push(
      {
        data: makeTask({
          status: 'completed',
          recurrence_rule: recurrenceRule,
          completed_at: '2026-04-21T16:00:00.000Z',
        }),
        error: null,
      },
      {
        data: makeTask({
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          status: 'active',
          due_at: '2026-04-28T15:00:00.000Z',
          recurrence_rule: recurrenceRule,
          recurrence_series_id: 'series-generated',
          reminder_sent_at: null,
        }),
        error: null,
      }
    )
    mockParseTaskRecurrenceRule.mockReturnValue(recurrenceRule)
    mockComputeNextDueAtIso.mockReturnValue('2026-04-28T15:00:00.000Z')
    mockDeriveReminderAt.mockReturnValue('2026-04-28T14:00:00.000Z')

    const response = await completeTaskRoute(new Request('http://localhost/complete', { method: 'POST' }), {
      params: { id: 'd4e9f6ea-4ac6-4e8f-8e62-a4bc90f2d67d' },
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      task: expect.objectContaining({ status: 'completed' }),
      next_task: expect.objectContaining({
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        recurrence_series_id: 'series-generated',
      }),
    })
    expect(mockComputeNextDueAtIso).toHaveBeenCalled()
    expect(mockDb.inserts).toEqual([
      {
        table: 'notes_tasks',
        payload: expect.objectContaining({
          recurrence_series_id: 'series-generated',
          due_at: '2026-04-28T15:00:00.000Z',
          reminder_at: '2026-04-28T14:00:00.000Z',
        }),
      },
    ])
  })

  it('returns auth failures from the task completion guard', async () => {
    mockServerGetSessionUserOrg.mockResolvedValue({ error: 'Not authenticated' })

    const response = await completeTaskRoute(new Request('http://localhost/complete', { method: 'POST' }), {
      params: { id: 'd4e9f6ea-4ac6-4e8f-8e62-a4bc90f2d67d' },
    })

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Not authenticated' })
  })

  it('snoozes later today and clears reminder_sent_at', async () => {
    mockDb.queued.notes_tasks.maybeSingle.push({
      data: makeTask(),
      error: null,
    })
    mockDb.queued.notes_tasks.single.push({
      data: makeTask({
        due_at: '2026-04-21T18:00:00.000Z',
        reminder_at: '2026-04-21T17:00:00.000Z',
        reminder_sent_at: null,
        is_all_day: false,
        has_due_time: true,
      }),
      error: null,
    })

    const response = await snoozeTaskRoute(jsonRequest('POST', { action: 'later_today' }), {
      params: { id: 'd4e9f6ea-4ac6-4e8f-8e62-a4bc90f2d67d' },
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      task: expect.objectContaining({
        due_at: '2026-04-21T18:00:00.000Z',
      }),
      snoozed_to_date: expect.any(String),
    })
    expect(mockDb.updates.at(-1)).toEqual({
      table: 'notes_tasks',
      payload: expect.objectContaining({
        reminder_sent_at: null,
        is_all_day: false,
        has_due_time: true,
      }),
    })
  })

  it('carries forward a manual reminder when snoozing without an offset', async () => {
    mockDb.queued.notes_tasks.maybeSingle.push({
      data: makeTask({
        due_at: '2026-04-21T15:00:00.000Z',
        reminder_at: '2026-04-21T13:30:00.000Z',
        reminder_offset_minutes: null,
      }),
      error: null,
    })
    mockDb.queued.notes_tasks.single.push({
      data: makeTask({
        due_at: '2026-04-28T15:00:00.000Z',
        reminder_at: '2026-04-28T13:30:00.000Z',
        reminder_offset_minutes: null,
        reminder_sent_at: null,
      }),
      error: null,
    })
    mockDeriveReminderAt.mockReturnValue(null)

    const response = await snoozeTaskRoute(jsonRequest('POST', { action: 'next_week' }), {
      params: { id: 'd4e9f6ea-4ac6-4e8f-8e62-a4bc90f2d67d' },
    })

    expect(response.status).toBe(200)
    expect(mockDb.updates.at(-1)).toEqual({
      table: 'notes_tasks',
      payload: expect.objectContaining({
        reminder_at: '2026-04-28T13:30:00.000Z',
        reminder_sent_at: null,
      }),
    })
  })

  it('adds recurrence metadata and recalculates reminders on task patch', async () => {
    const recurrenceRule = { frequency: 'custom', interval: 2, unit: 'week' }
    mockDb.queued.notes_tasks.maybeSingle.push({
      data: makeTask({
        recurrence_rule: null,
        recurrence_series_id: null,
      }),
      error: null,
    })
    mockDb.queued.notes_tasks.single.push({
      data: makeTask({
        title: 'Updated title',
        recurrence_rule: recurrenceRule,
        recurrence_series_id: 'series-generated',
        reminder_at: '2026-04-23T13:00:00.000Z',
        reminder_sent_at: null,
      }),
      error: null,
    })
    mockParseTaskRecurrenceRule.mockReturnValue(recurrenceRule)
    mockDeriveReminderAt.mockReturnValue('2026-04-23T13:00:00.000Z')

    const response = await patchTaskRoute(
      jsonRequest('PATCH', {
        title: ' Updated title ',
        due_at: '2026-04-23T14:00:00.000Z',
        recurrence_rule: recurrenceRule,
        reminder_enabled: true,
        reminder_offset_minutes: 60,
      }),
      {
        params: { id: 'd4e9f6ea-4ac6-4e8f-8e62-a4bc90f2d67d' },
      }
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      task: expect.objectContaining({
        title: 'Updated title',
        recurrence_series_id: 'series-generated',
      }),
    })
    expect(mockDb.updates.at(-1)).toEqual({
      table: 'notes_tasks',
      payload: expect.objectContaining({
        title: 'Updated title',
        recurrence_rule: recurrenceRule,
        recurrence_series_id: 'series-generated',
        reminder_at: '2026-04-23T13:00:00.000Z',
        reminder_sent_at: null,
      }),
    })
  })

  it('removes recurrence metadata when the patch clears recurrence', async () => {
    mockDb.queued.notes_tasks.maybeSingle.push({
      data: makeTask({
        recurrence_rule: { frequency: 'weekly' },
        recurrence_series_id: 'series-1',
      }),
      error: null,
    })
    mockDb.queued.notes_tasks.single.push({
      data: makeTask({
        recurrence_rule: null,
        recurrence_series_id: null,
      }),
      error: null,
    })

    const response = await patchTaskRoute(
      jsonRequest('PATCH', {
        recurrence_rule: null,
      }),
      {
        params: { id: 'd4e9f6ea-4ac6-4e8f-8e62-a4bc90f2d67d' },
      }
    )

    expect(response.status).toBe(200)
    expect(mockDb.updates.at(-1)).toEqual({
      table: 'notes_tasks',
      payload: expect.objectContaining({
        recurrence_rule: null,
        recurrence_series_id: null,
      }),
    })
  })

  it('returns the canonical dashboard shape', async () => {
    const tasks = [makeTask({ id: 'task-overdue', due_at: '2026-04-20T15:00:00.000Z' })]
    const notes = [
      makeNote({ id: 'note-starred', starred: true }),
      makeNote({ id: 'note-recent', starred: false }),
    ]

    mockDb.queued.notes_tasks.list.push({
      data: tasks,
      error: null,
    })
    mockDb.queued.notes_notes.list.push({
      data: notes,
      error: null,
    })
    mockPartitionTasksForDashboard.mockReturnValue({
      dateKey: '2026-04-21',
      overdue: [tasks[0]],
      dueToday: [],
      upcoming: [],
      untimedToday: [],
    })

    const response = await dashboardRoute()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      today: {
        timezone: 'America/Chicago',
        date_key: '2026-04-21',
      },
      settings: {
        upcoming_days: 3,
      },
      tasks: {
        overdue: [expect.objectContaining({ id: 'task-overdue' })],
        due_today: [],
        upcoming: [],
        untimed_today: [],
      },
      notes: {
        starred: [expect.objectContaining({ id: 'note-starred' })],
        recent: [
          expect.objectContaining({ id: 'note-starred' }),
          expect.objectContaining({ id: 'note-recent' }),
        ],
      },
    })
  })

  it('returns shared auth failures from the dashboard guard', async () => {
    mockServerGetSessionUserOrg.mockResolvedValue({ error: 'Org access denied' })

    const response = await dashboardRoute()

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Org access denied' })
  })

  it('filters and paginates the task list with an opaque cursor', async () => {
    mockDb.queued.notes_tasks.list.push({
      data: [
        makeTask({ id: 'task-a', title: 'Follow up Alpha', priority: 'high', starred: true, created_at: '2026-04-21T12:00:00.000Z' }),
        makeTask({ id: 'task-b', title: 'Follow up Beta', priority: 'high', starred: false, created_at: '2026-04-20T12:00:00.000Z' }),
      ],
      error: null,
    })

    const firstResponse = await listTasksRoute(
      new Request('http://localhost/tasks?status=active&priority=high&search=Follow&limit=1')
    )
    const firstPayload = await firstResponse.json()

    expect(firstResponse.status).toBe(200)
    expect(firstPayload.tasks).toHaveLength(1)
    expect(firstPayload.tasks[0]).toEqual(expect.objectContaining({ id: 'task-a' }))
    expect(firstPayload.filters).toEqual({
      status: 'active',
      due: 'all',
      starred: false,
      priority: 'high',
      search: 'Follow',
    })
    expect(firstPayload.page).toEqual({
      limit: 1,
      has_more: true,
      next_cursor: expect.any(String),
    })

    mockDb.queued.notes_tasks.list.push({
      data: [
        makeTask({ id: 'task-a', title: 'Follow up Alpha', priority: 'high', starred: true, created_at: '2026-04-21T12:00:00.000Z' }),
        makeTask({ id: 'task-b', title: 'Follow up Beta', priority: 'high', starred: false, created_at: '2026-04-20T12:00:00.000Z' }),
      ],
      error: null,
    })

    const secondResponse = await listTasksRoute(
      new Request(`http://localhost/tasks?status=active&priority=high&search=Follow&limit=1&cursor=${encodeURIComponent(firstPayload.page.next_cursor)}`)
    )

    await expect(secondResponse.json()).resolves.toEqual({
      tasks: [expect.objectContaining({ id: 'task-b' })],
      filters: {
        status: 'active',
        due: 'all',
        starred: false,
        priority: 'high',
        search: 'Follow',
      },
      page: {
        limit: 1,
        has_more: false,
        next_cursor: null,
      },
    })
  })

  it('filters and paginates the notes list with sections for the home explorer', async () => {
    mockDb.queued.notes_notes.list.push({
      data: [
        makeNote({ id: 'note-a', title: 'Alpha', starred: true, updated_at: '2026-04-21T12:00:00.000Z' }),
        makeNote({ id: 'note-b', title: 'Beta', folder_id: null, updated_at: '2026-04-20T12:00:00.000Z' }),
      ],
      error: null,
    })

    const firstResponse = await listNotesRoute(
      new Request('http://localhost/notes?status=active&limit=1')
    )
    const firstPayload = await firstResponse.json()

    expect(firstResponse.status).toBe(200)
    expect(firstPayload.notes).toHaveLength(1)
    expect(firstPayload.notes[0]).toEqual(expect.objectContaining({ id: 'note-a' }))
    expect(firstPayload.sections).toEqual({
      starred: [expect.objectContaining({ id: 'note-a' })],
      recent: [expect.objectContaining({ id: 'note-a' }), expect.objectContaining({ id: 'note-b' })],
      loose: [expect.objectContaining({ id: 'note-b' })],
    })
    expect(firstPayload.page).toEqual({
      limit: 1,
      has_more: true,
      next_cursor: expect.any(String),
    })

    mockDb.queued.notes_notes.list.push({
      data: [
        makeNote({ id: 'note-a', title: 'Alpha', starred: true, updated_at: '2026-04-21T12:00:00.000Z' }),
        makeNote({ id: 'note-b', title: 'Beta', folder_id: null, updated_at: '2026-04-20T12:00:00.000Z' }),
      ],
      error: null,
    })

    const secondResponse = await listNotesRoute(
      new Request(`http://localhost/notes?status=active&limit=1&cursor=${encodeURIComponent(firstPayload.page.next_cursor)}`)
    )

    await expect(secondResponse.json()).resolves.toEqual({
      notes: [expect.objectContaining({ id: 'note-b' })],
      filters: {
        status: 'active',
        folder_id: null,
        search: '',
      },
      page: {
        limit: 1,
        has_more: false,
        next_cursor: null,
      },
      sections: {
        starred: [expect.objectContaining({ id: 'note-a' })],
        recent: [expect.objectContaining({ id: 'note-a' }), expect.objectContaining({ id: 'note-b' })],
        loose: [expect.objectContaining({ id: 'note-b' })],
      },
    })
  })
})
