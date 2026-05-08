import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockSupabaseAdmin,
  mockGetValidAccessToken,
  mockResolveCalendarId,
  mockSyncJobScheduleRange,
} = vi.hoisted(() => ({
  mockSupabaseAdmin: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
  mockGetValidAccessToken: vi.fn(),
  mockResolveCalendarId: vi.fn(),
  mockSyncJobScheduleRange: vi.fn(),
}))

vi.mock('@/lib/server/org', () => ({
  supabaseAdmin: mockSupabaseAdmin,
}))

vi.mock('@/lib/server/googleCalendar', () => ({
  getValidAccessToken: mockGetValidAccessToken,
  resolveCalendarId: mockResolveCalendarId,
}))

vi.mock('@/lib/server/jobScheduleSync', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/server/jobScheduleSync')>()),
  syncJobScheduleRange: mockSyncJobScheduleRange,
}))

import {
  normalizeReplaceJobPaintLogsInput,
  replaceJobPaintLogs,
} from '@/lib/jobs/service'
import {
  addJobSchedulesToCalendar,
  createJobSchedule,
  deleteJobSchedule,
  normalizeCreateJobScheduleInput,
} from '@/lib/server/jobScheduleWorkflow'
import { deriveJobScheduleRange } from '@/lib/server/jobScheduleSync'

type TableName = 'jobs' | 'customers' | 'job_schedules' | 'job_paint_logs'

const state = {
  jobs: [] as Array<Record<string, unknown>>,
  customers: [] as Array<Record<string, unknown>>,
  schedules: [] as Array<Record<string, unknown>>,
  paintLogs: [] as Array<Record<string, unknown>>,
  insertedSchedule: null as Record<string, unknown> | null,
  updatedSchedules: [] as Array<Record<string, unknown>>,
  deletedSchedules: [] as Array<Record<string, unknown>>,
}

class QueryBuilder {
  private filters = new Map<string, unknown>()
  private operation: 'select' | 'insert' | 'update' | 'delete' | null = null
  private payload: Record<string, unknown> | null = null

  constructor(private table: TableName) {}

  select() {
    this.operation = 'select'
    return this
  }

  insert(payload: Record<string, unknown>) {
    this.operation = 'insert'
    this.payload = payload
    state.insertedSchedule = payload
    return this
  }

  update(payload: Record<string, unknown>) {
    this.operation = 'update'
    this.payload = payload
    return this
  }

  delete() {
    this.operation = 'delete'
    return this
  }

  eq(column: string, value: unknown) {
    this.filters.set(column, value)
    return this
  }

  order() {
    return this
  }

  async maybeSingle() {
    return { data: this.rows()[0] ?? null, error: null }
  }

  async single() {
    return {
      data: {
        id: 'schedule-new',
        start_at: this.payload?.start_at,
        end_at: this.payload?.end_at,
        notes: this.payload?.notes,
        calendar_event_id: null,
        calendar_added_at: null,
      },
      error: null,
    }
  }

  then(resolve: (value: { data?: unknown[]; error: null }) => void) {
    if (this.operation === 'delete' && this.table === 'job_schedules') {
      state.deletedSchedules.push(Object.fromEntries(this.filters))
      resolve({ error: null })
      return
    }

    if (this.operation === 'update' && this.table === 'job_schedules') {
      state.updatedSchedules.push({
        filters: Object.fromEntries(this.filters),
        payload: this.payload,
      })
      resolve({ error: null })
      return
    }

    resolve({ data: this.rows(), error: null })
  }

  private rows() {
    const source =
      this.table === 'jobs'
        ? state.jobs
        : this.table === 'customers'
          ? state.customers
          : this.table === 'job_schedules'
            ? state.schedules
            : state.paintLogs

    return source.filter((row) => {
      for (const [column, value] of this.filters.entries()) {
        if (row[column] !== value) return false
      }
      return true
    })
  }
}

describe('jobs schedule workflow and paint-log service workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    state.jobs = [{ id: 'job-1', org_id: 'org-1', status: 'estimate_scheduled', customer_id: 'customer-1' }]
    state.customers = [{ id: 'customer-1', org_id: 'org-1', name: 'Alice', address: '123 Main St' }]
    state.schedules = [
      {
        id: 'schedule-1',
        org_id: 'org-1',
        job_id: 'job-1',
        start_at: '2026-05-01T10:00:00Z',
        end_at: '2026-05-01T12:00:00Z',
        notes: 'Prep',
        calendar_event_id: null,
      },
    ]
    state.paintLogs = [
      {
        id: 'paint-1',
        org_id: 'org-1',
        job_id: 'job-1',
        sort_order: 0,
        where_used: 'Kitchen',
        paint_product: 'Emerald',
        sheen: null,
        color: null,
        notes: null,
      },
    ]
    state.insertedSchedule = null
    state.updatedSchedules = []
    state.deletedSchedules = []

    mockSupabaseAdmin.from.mockImplementation((table: TableName) => new QueryBuilder(table))
    mockSupabaseAdmin.rpc.mockResolvedValue({ error: null })
    mockGetValidAccessToken.mockResolvedValue({ accessToken: 'token-1' })
    mockResolveCalendarId.mockResolvedValue('calendar-1')
    mockSyncJobScheduleRange.mockResolvedValue({ error: null, range: null })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ id: 'event-1' }))
    )
  })

  it('normalizes valid schedule input to canonical ISO strings', () => {
    expect(
      normalizeCreateJobScheduleInput({
        start_at: ' 2026-05-01T10:00:00Z ',
        end_at: ' 2026-05-01T12:00:00Z ',
        notes: ' Notes ',
      })
    ).toEqual({
      ok: true,
      data: {
        start_at: '2026-05-01T10:00:00.000Z',
        end_at: '2026-05-01T12:00:00.000Z',
        notes: 'Notes',
      },
    })
  })

  it('rejects missing schedule start or end values', () => {
    expect(normalizeCreateJobScheduleInput({ start_at: '' })).toEqual({
      ok: false,
      kind: 'invalid_input',
      message: 'Missing start_at or end_at',
    })
  })

  it('rejects invalid schedule start or end strings', () => {
    expect(
      normalizeCreateJobScheduleInput({
        start_at: 'not a date',
        end_at: '2026-05-01T12:00:00Z',
      })
    ).toEqual({
      ok: false,
      kind: 'invalid_input',
      message: 'Invalid start_at or end_at',
    })
  })

  it('rejects schedule end values before the start', () => {
    expect(
      normalizeCreateJobScheduleInput({
        start_at: '2026-05-01T12:00:00Z',
        end_at: '2026-05-01T10:00:00Z',
      })
    ).toEqual({
      ok: false,
      kind: 'invalid_input',
      message: 'end_at must be after start_at',
    })
  })

  it('rejects schedule end values equal to the start', () => {
    expect(
      normalizeCreateJobScheduleInput({
        start_at: '2026-05-01T10:00:00Z',
        end_at: '2026-05-01T10:00:00Z',
      })
    ).toEqual({
      ok: false,
      kind: 'invalid_input',
      message: 'end_at must be after start_at',
    })
  })

  it('normalizes blank schedule notes to null', () => {
    expect(
      normalizeCreateJobScheduleInput({
        start_at: '2026-05-01T10:00:00Z',
        end_at: '2026-05-01T12:00:00Z',
        notes: '   ',
      })
    ).toEqual({
      ok: true,
      data: {
        start_at: '2026-05-01T10:00:00.000Z',
        end_at: '2026-05-01T12:00:00.000Z',
        notes: null,
      },
    })
  })

  it('normalizes paint-log inputs in the service layer', () => {
    expect(
      normalizeReplaceJobPaintLogsInput({
        rows: [{ where_used: ' Kitchen ', paint_product: 'Emerald', notes: 'x'.repeat(700) }],
      })
    ).toEqual({
      ok: true,
      data: {
        rows: [
          {
            where_used: 'Kitchen',
            paint_product: 'Emerald',
            sheen: null,
            color: null,
            notes: 'x'.repeat(600),
          },
        ],
      },
    })
  })

  it('creates a schedule and routes status side effects through job schedule sync', async () => {
    const result = await createJobSchedule('org-1', 'job-1', {
      start_at: '2026-05-02T10:00:00Z',
      end_at: '2026-05-02T12:00:00Z',
      notes: null,
    })

    expect(result).toEqual({
      ok: true,
      data: {
        id: 'schedule-new',
        start_at: '2026-05-02T10:00:00Z',
        end_at: '2026-05-02T12:00:00Z',
        notes: null,
        calendar_event_id: null,
        calendar_added_at: null,
      },
    })
    expect(state.insertedSchedule).toMatchObject({ org_id: 'org-1', job_id: 'job-1' })
    expect(mockSyncJobScheduleRange).toHaveBeenCalledWith('org-1', 'job-1', {
      statusWhenSchedulesExist: 'scheduled',
    })
  })

  it('deletes an existing calendar event before deleting the schedule and delegates empty-status fallback to schedule sync', async () => {
    state.schedules[0].calendar_event_id = 'event-1'
    state.jobs[0].status = 'scheduled'

    const result = await deleteJobSchedule({
      orgId: 'org-1',
      userId: 'user-1',
      origin: 'http://localhost',
      jobId: 'job-1',
      scheduleId: 'schedule-1',
    })

    expect(result).toEqual({ ok: true, data: { ok: true } })
    expect(mockGetValidAccessToken).toHaveBeenCalledWith({
      origin: 'http://localhost',
      orgId: 'org-1',
      userId: 'user-1',
    })
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://www.googleapis.com/calendar/v3/calendars/calendar-1/events/event-1',
      expect.objectContaining({ method: 'DELETE' })
    )
    expect(state.deletedSchedules).toEqual([
      { org_id: 'org-1', job_id: 'job-1', id: 'schedule-1' },
    ])
    expect(mockSyncJobScheduleRange).toHaveBeenCalledWith('org-1', 'job-1', {
      statusWhenSchedulesExist: 'scheduled',
      statusWhenEmpty: 'estimate_sent',
    })
  })

  it('preserves completed when deleting the final schedule from a completed job', async () => {
    state.jobs[0].status = 'completed'

    const result = await deleteJobSchedule({
      orgId: 'org-1',
      userId: 'user-1',
      origin: 'http://localhost',
      jobId: 'job-1',
      scheduleId: 'schedule-1',
    })

    expect(result).toEqual({ ok: true, data: { ok: true } })
    expect(mockSyncJobScheduleRange).toHaveBeenCalledWith('org-1', 'job-1', {
      statusWhenSchedulesExist: 'scheduled',
      statusWhenEmpty: 'completed',
    })
  })

  it('preserves lost when deleting the final schedule from a lost job', async () => {
    state.jobs[0].status = 'lost'

    const result = await deleteJobSchedule({
      orgId: 'org-1',
      userId: 'user-1',
      origin: 'http://localhost',
      jobId: 'job-1',
      scheduleId: 'schedule-1',
    })

    expect(result).toEqual({ ok: true, data: { ok: true } })
    expect(mockSyncJobScheduleRange).toHaveBeenCalledWith('org-1', 'job-1', {
      statusWhenSchedulesExist: 'scheduled',
      statusWhenEmpty: 'lost',
    })
  })

  it('returns not_found for a missing schedule without calendar deletion, delete, or sync', async () => {
    const result = await deleteJobSchedule({
      orgId: 'org-1',
      userId: 'user-1',
      origin: 'http://localhost',
      jobId: 'job-1',
      scheduleId: 'missing-schedule',
    })

    expect(result).toEqual({
      ok: false,
      kind: 'not_found',
      message: 'Schedule not found',
    })
    expect(mockGetValidAccessToken).not.toHaveBeenCalled()
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(state.deletedSchedules).toEqual([])
    expect(mockSyncJobScheduleRange).not.toHaveBeenCalled()
  })

  it('adds missing schedule blocks to Google Calendar and stores event metadata', async () => {
    const result = await addJobSchedulesToCalendar({
      orgId: 'org-1',
      userId: 'user-1',
      origin: 'http://localhost',
      jobId: 'job-1',
    })

    expect(result).toEqual({
      ok: true,
      data: [{ scheduleId: 'schedule-1', eventId: 'event-1', skipped: false }],
    })
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://www.googleapis.com/calendar/v3/calendars/calendar-1/events',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"summary":"Job - Alice"'),
      })
    )
    expect(state.updatedSchedules[0]).toMatchObject({
      filters: { org_id: 'org-1', job_id: 'job-1', id: 'schedule-1' },
      payload: { calendar_event_id: 'event-1' },
    })
    expect(mockSyncJobScheduleRange).toHaveBeenCalledWith('org-1', 'job-1', {
      statusWhenSchedulesExist: 'scheduled',
    })
  })

  it('preserves skipped calendar behavior for existing event ids', async () => {
    state.schedules[0].start_at = null
    state.schedules[0].end_at = ''
    state.schedules[0].calendar_event_id = 'event-existing'

    const result = await addJobSchedulesToCalendar({
      orgId: 'org-1',
      userId: 'user-1',
      origin: 'http://localhost',
      jobId: 'job-1',
    })

    expect(result).toEqual({
      ok: true,
      data: [{ scheduleId: 'schedule-1', eventId: 'event-existing', skipped: true }],
    })
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(state.updatedSchedules).toEqual([])
    expect(mockSyncJobScheduleRange).toHaveBeenCalledWith('org-1', 'job-1', {
      statusWhenSchedulesExist: 'scheduled',
    })
  })

  it('rejects invalid persisted schedule rows before sending Google Calendar payloads', async () => {
    state.schedules[0].start_at = '   '
    state.schedules[0].end_at = 'not a date'

    const result = await addJobSchedulesToCalendar({
      orgId: 'org-1',
      userId: 'user-1',
      origin: 'http://localhost',
      jobId: 'job-1',
    })

    expect(result).toEqual({
      ok: false,
      kind: 'invalid_input',
      message: 'Invalid persisted schedule start_at or end_at',
    })
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(state.updatedSchedules).toEqual([])
    expect(mockSyncJobScheduleRange).not.toHaveBeenCalled()
  })

  it('does not send invalid end-before-start schedule rows to Google Calendar', async () => {
    state.schedules[0].start_at = '2026-05-01T12:00:00Z'
    state.schedules[0].end_at = '2026-05-01T10:00:00Z'

    const result = await addJobSchedulesToCalendar({
      orgId: 'org-1',
      userId: 'user-1',
      origin: 'http://localhost',
      jobId: 'job-1',
    })

    expect(result).toMatchObject({
      ok: false,
      kind: 'invalid_input',
    })
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('derives schedule ranges from valid dates only', () => {
    expect(
      deriveJobScheduleRange([
        { start_at: null, end_at: null },
        { start_at: '', end_at: '   ' },
        { start_at: 'not a date', end_at: '2026-05-05T12:00:00Z' },
        { start_at: '2026-05-02T10:00:00-05:00', end_at: 'invalid' },
        { start_at: '2026-05-01T10:00:00Z', end_at: '2026-05-03T12:00:00-05:00' },
      ])
    ).toEqual({
      hasSchedules: true,
      scheduled_date: '2026-05-01T10:00:00.000Z',
      scheduled_end_date: '2026-05-05T12:00:00.000Z',
    })

    expect(
      deriveJobScheduleRange([
        { start_at: null, end_at: null },
        { start_at: '   ', end_at: 'invalid' },
      ])
    ).toEqual({
      hasSchedules: false,
      scheduled_date: null,
      scheduled_end_date: null,
    })
  })

  it('replaces paint logs through the RPC and reloads normalized rows', async () => {
    const input = {
      rows: [{ where_used: 'Kitchen', paint_product: null, sheen: null, color: null, notes: null }],
    }

    const result = await replaceJobPaintLogs('org-1', 'job-1', input)

    expect(mockSupabaseAdmin.rpc).toHaveBeenCalledWith('replace_job_paint_logs', {
      p_org_id: 'org-1',
      p_job_id: 'job-1',
      p_rows: input.rows,
    })
    expect(result).toEqual({ ok: true, data: state.paintLogs })
  })
})
