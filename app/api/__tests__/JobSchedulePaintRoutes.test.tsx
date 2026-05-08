import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockRequireSessionUserOrg,
  mockResolveParams,
  mockReadUuidParam,
  mockListJobSchedules,
  mockNormalizeCreateJobScheduleInput,
  mockCreateJobSchedule,
  mockDeleteJobSchedule,
  mockAddJobSchedulesToCalendar,
  mockListJobPaintLogs,
  mockNormalizeReplaceJobPaintLogsInput,
  mockReplaceJobPaintLogs,
} = vi.hoisted(() => ({
  mockRequireSessionUserOrg: vi.fn(),
  mockResolveParams: vi.fn(),
  mockReadUuidParam: vi.fn(),
  mockListJobSchedules: vi.fn(),
  mockNormalizeCreateJobScheduleInput: vi.fn(),
  mockCreateJobSchedule: vi.fn(),
  mockDeleteJobSchedule: vi.fn(),
  mockAddJobSchedulesToCalendar: vi.fn(),
  mockListJobPaintLogs: vi.fn(),
  mockNormalizeReplaceJobPaintLogsInput: vi.fn(),
  mockReplaceJobPaintLogs: vi.fn(),
}))

vi.mock('@/lib/server/apiRoute', async () => ({
  requireSessionUserOrg: mockRequireSessionUserOrg,
  resolveParams: mockResolveParams,
  readUuidParam: mockReadUuidParam,
  jsonError: (error: string, status: number) =>
    new Response(JSON.stringify({ error }), { status }),
  readJsonBody: async (request: Request) => {
    try {
      return { ok: true as const, value: (await request.json()) as Record<string, unknown> }
    } catch {
      return {
        ok: false as const,
        response: new Response(JSON.stringify({ error: 'Invalid JSON body.' }), { status: 400 }),
      }
    }
  },
}))

vi.mock('@/lib/server/jobScheduleWorkflow', () => ({
  listJobSchedules: mockListJobSchedules,
  normalizeCreateJobScheduleInput: mockNormalizeCreateJobScheduleInput,
  createJobSchedule: mockCreateJobSchedule,
  deleteJobSchedule: mockDeleteJobSchedule,
  addJobSchedulesToCalendar: mockAddJobSchedulesToCalendar,
}))

vi.mock('@/lib/jobs/service', () => ({
  listJobPaintLogs: mockListJobPaintLogs,
  normalizeReplaceJobPaintLogsInput: mockNormalizeReplaceJobPaintLogsInput,
  replaceJobPaintLogs: mockReplaceJobPaintLogs,
}))

import { GET as getSchedules, POST as postSchedule } from '../jobs/[id]/schedules/route'
import { DELETE as deleteSchedule } from '../jobs/[id]/schedules/[scheduleId]/route'
import { POST as addSchedulesToCalendar } from '../jobs/[id]/schedules/add-to-calendar/route'
import { GET as getPaintLogs, PUT as putPaintLogs } from '../jobs/[id]/paint-logs/route'

describe('job schedule and paint-log routes', () => {
  beforeEach(() => {
    for (const mock of [
      mockRequireSessionUserOrg,
      mockResolveParams,
      mockReadUuidParam,
      mockListJobSchedules,
      mockNormalizeCreateJobScheduleInput,
      mockCreateJobSchedule,
      mockDeleteJobSchedule,
      mockAddJobSchedulesToCalendar,
      mockListJobPaintLogs,
      mockNormalizeReplaceJobPaintLogsInput,
      mockReplaceJobPaintLogs,
    ]) {
      mock.mockReset()
    }

    mockRequireSessionUserOrg.mockResolvedValue({
      ok: true,
      session: { orgId: 'org-1', userId: 'user-1' },
    })
    mockResolveParams.mockResolvedValue({ id: 'job-1', scheduleId: 'schedule-1' })
    mockReadUuidParam.mockImplementation((value: string) => ({ ok: true, value }))
  })

  it('authenticates before parsing route params', async () => {
    mockRequireSessionUserOrg.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401 }),
    })

    const response = await getSchedules(new Request('http://localhost/api/jobs/job-1/schedules'), {
      params: { id: 'job-1' },
    })

    expect(response.status).toBe(401)
    expect(mockResolveParams).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ error: 'Not authenticated' })
  })

  it('returns schedule rows in the standard data envelope', async () => {
    mockListJobSchedules.mockResolvedValue({
      ok: true,
      data: [{ id: 'schedule-1', start_at: '2026-05-01T10:00:00Z', end_at: '2026-05-01T12:00:00Z' }],
    })

    const response = await getSchedules(new Request('http://localhost/api/jobs/job-1/schedules'), {
      params: { id: 'job-1' },
    })

    await expect(response.json()).resolves.toEqual({
      data: [{ id: 'schedule-1', start_at: '2026-05-01T10:00:00Z', end_at: '2026-05-01T12:00:00Z' }],
    })
  })

  it('maps missing parent jobs to the jobs route 404 contract for schedule reads', async () => {
    mockListJobSchedules.mockResolvedValue({
      ok: false,
      kind: 'not_found',
      message: 'Job not found',
    })

    const response = await getSchedules(new Request('http://localhost/api/jobs/job-1/schedules'), {
      params: { id: 'job-1' },
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Job not found' })
  })

  it('rejects invalid schedule route params', async () => {
    mockReadUuidParam.mockReturnValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Invalid job id' }), { status: 400 }),
    })

    const response = await getSchedules(new Request('http://localhost/api/jobs/not-a-uuid/schedules'), {
      params: { id: 'not-a-uuid' },
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid job id' })
  })

  it('creates schedules through the service with a mutation envelope', async () => {
    mockNormalizeCreateJobScheduleInput.mockReturnValue({
      ok: true,
      data: { start_at: '2026-05-01T10:00:00Z', end_at: '2026-05-01T12:00:00Z', notes: null },
    })
    mockCreateJobSchedule.mockResolvedValue({
      ok: true,
      data: { id: 'schedule-1', start_at: '2026-05-01T10:00:00Z', end_at: '2026-05-01T12:00:00Z' },
    })

    const response = await postSchedule(
      new Request('http://localhost/api/jobs/job-1/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_at: '2026-05-01T10:00:00Z', end_at: '2026-05-01T12:00:00Z' }),
      }),
      { params: { id: 'job-1' } }
    )

    await expect(response.json()).resolves.toEqual({
      data: { id: 'schedule-1', start_at: '2026-05-01T10:00:00Z', end_at: '2026-05-01T12:00:00Z' },
      notice: 'Schedule added.',
    })
  })

  it('maps invalid schedule bodies to a standard error envelope', async () => {
    mockNormalizeCreateJobScheduleInput.mockReturnValue({
      ok: false,
      kind: 'invalid_input',
      message: 'Missing start_at or end_at',
    })

    const response = await postSchedule(
      new Request('http://localhost/api/jobs/job-1/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_at: '' }),
      }),
      { params: { id: 'job-1' } }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Missing start_at or end_at' })
    expect(mockCreateJobSchedule).not.toHaveBeenCalled()
  })

  it('returns a 400 error envelope for invalid normalized schedule ranges', async () => {
    mockNormalizeCreateJobScheduleInput.mockReturnValue({
      ok: false,
      kind: 'invalid_input',
      message: 'end_at must be after start_at',
    })

    const response = await postSchedule(
      new Request('http://localhost/api/jobs/job-1/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_at: '2026-05-01T12:00:00Z',
          end_at: '2026-05-01T10:00:00Z',
        }),
      }),
      { params: { id: 'job-1' } }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'end_at must be after start_at' })
    expect(mockCreateJobSchedule).not.toHaveBeenCalled()
  })

  it('deletes schedules through the service with a stable object envelope', async () => {
    mockDeleteJobSchedule.mockResolvedValue({ ok: true, data: { ok: true } })

    const response = await deleteSchedule(new Request('http://localhost/api/jobs/job-1/schedules/schedule-1'), {
      params: { id: 'job-1', scheduleId: 'schedule-1' },
    })

    expect(mockDeleteJobSchedule).toHaveBeenCalledWith({
      orgId: 'org-1',
      userId: 'user-1',
      origin: 'http://localhost',
      jobId: 'job-1',
      scheduleId: 'schedule-1',
    })
    await expect(response.json()).resolves.toEqual({
      data: { ok: true },
      notice: 'Schedule deleted.',
    })
  })

  it('maps missing schedule deletes to a 404 error envelope', async () => {
    mockDeleteJobSchedule.mockResolvedValue({
      ok: false,
      kind: 'not_found',
      message: 'Schedule not found',
    })

    const response = await deleteSchedule(new Request('http://localhost/api/jobs/job-1/schedules/missing'), {
      params: { id: 'job-1', scheduleId: 'missing' },
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Schedule not found' })
  })

  it('adds schedules to calendar through the service', async () => {
    mockAddJobSchedulesToCalendar.mockResolvedValue({
      ok: true,
      data: [{ scheduleId: 'schedule-1', eventId: 'event-1', skipped: false }],
    })

    const response = await addSchedulesToCalendar(
      new Request('http://localhost/api/jobs/job-1/schedules/add-to-calendar', { method: 'POST' }),
      { params: { id: 'job-1' } }
    )

    await expect(response.json()).resolves.toEqual({
      data: [{ scheduleId: 'schedule-1', eventId: 'event-1', skipped: false }],
      notice: 'Added schedules to calendar.',
    })
  })

  it('returns paint logs in the standard data envelope', async () => {
    mockListJobPaintLogs.mockResolvedValue({
      ok: true,
      data: [{ id: 'paint-1', where_used: 'Kitchen', paint_product: 'Emerald' }],
    })

    const response = await getPaintLogs(new Request('http://localhost/api/jobs/job-1/paint-logs'), {
      params: { id: 'job-1' },
    })

    await expect(response.json()).resolves.toEqual({
      data: [{ id: 'paint-1', where_used: 'Kitchen', paint_product: 'Emerald' }],
    })
  })

  it('replaces paint logs through normalized service input', async () => {
    mockNormalizeReplaceJobPaintLogsInput.mockReturnValue({
      ok: true,
      data: { rows: [{ where_used: 'Kitchen', paint_product: null, sheen: null, color: null, notes: null }] },
    })
    mockReplaceJobPaintLogs.mockResolvedValue({
      ok: true,
      data: [{ id: 'paint-1', where_used: 'Kitchen' }],
    })

    const response = await putPaintLogs(
      new Request('http://localhost/api/jobs/job-1/paint-logs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: [{ where_used: 'Kitchen' }] }),
      }),
      { params: { id: 'job-1' } }
    )

    await expect(response.json()).resolves.toEqual({
      data: [{ id: 'paint-1', where_used: 'Kitchen' }],
      notice: 'Paint log saved.',
    })
  })
})
