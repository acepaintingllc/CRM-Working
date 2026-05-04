import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockRequireSessionUserOrg,
  mockResolveParams,
  mockReadUuidParam,
  mockLoadJobActuals,
  mockNormalizeActualsSnapshotId,
  mockNormalizeJobActualsDraftInput,
  mockSaveDraftJobActuals,
  mockSubmitJobActuals,
  mockLockJobActuals,
} = vi.hoisted(() => ({
  mockRequireSessionUserOrg: vi.fn(),
  mockResolveParams: vi.fn(),
  mockReadUuidParam: vi.fn(),
  mockLoadJobActuals: vi.fn(),
  mockNormalizeActualsSnapshotId: vi.fn(),
  mockNormalizeJobActualsDraftInput: vi.fn(),
  mockSaveDraftJobActuals: vi.fn(),
  mockSubmitJobActuals: vi.fn(),
  mockLockJobActuals: vi.fn(),
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

vi.mock('@/lib/server/estimate-feedback/actuals', () => ({
  loadJobActuals: mockLoadJobActuals,
  normalizeActualsSnapshotId: mockNormalizeActualsSnapshotId,
  normalizeJobActualsDraftInput: mockNormalizeJobActualsDraftInput,
  saveDraftJobActuals: mockSaveDraftJobActuals,
  submitJobActuals: mockSubmitJobActuals,
  lockJobActuals: mockLockJobActuals,
}))

import { GET, PUT } from '../jobs/[id]/actuals/route'
import { POST as SUBMIT } from '../jobs/[id]/actuals/submit/route'
import { POST as LOCK } from '../jobs/[id]/actuals/lock/route'

const actuals = {
  id: 'actual-1',
  job_id: 'job-1',
  estimate_snapshot_id: 'snapshot-1',
  status: 'draft',
}

describe('job actuals routes', () => {
  beforeEach(() => {
    mockRequireSessionUserOrg.mockReset()
    mockResolveParams.mockReset()
    mockReadUuidParam.mockReset()
    mockLoadJobActuals.mockReset()
    mockNormalizeActualsSnapshotId.mockReset()
    mockNormalizeJobActualsDraftInput.mockReset()
    mockSaveDraftJobActuals.mockReset()
    mockSubmitJobActuals.mockReset()
    mockLockJobActuals.mockReset()

    mockRequireSessionUserOrg.mockResolvedValue({
      ok: true,
      session: { orgId: 'org-1', userId: 'user-1' },
    })
    mockResolveParams.mockResolvedValue({ id: 'job-1' })
    mockReadUuidParam.mockReturnValue({ ok: true, value: 'job-1' })
    mockNormalizeActualsSnapshotId.mockReturnValue({ ok: true, data: 'snapshot-1' })
    mockNormalizeJobActualsDraftInput.mockReturnValue({
      ok: true,
      data: {
        estimate_snapshot_id: 'snapshot-1',
        actual_labor_hours: 10,
        actual_paint_gallons: 3,
        actual_supplies_cost: 40,
        actual_other_cost: 5,
        notes: null,
      },
    })
  })

  it('GET loads actuals through the standard data envelope', async () => {
    mockLoadJobActuals.mockResolvedValue({ ok: true, data: actuals })

    const response = await GET(
      new Request('http://localhost/api/jobs/job-1/actuals?estimateSnapshotId=snapshot-1'),
      { params: { id: 'job-1' } }
    )

    expect(mockLoadJobActuals).toHaveBeenCalledWith('org-1', 'job-1', 'snapshot-1')
    await expect(response.json()).resolves.toEqual({ data: actuals })
  })

  it('PUT saves draft actuals through the standard mutation envelope', async () => {
    mockSaveDraftJobActuals.mockResolvedValue({ ok: true, data: actuals })

    const response = await PUT(
      new Request('http://localhost/api/jobs/job-1/actuals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estimate_snapshot_id: 'snapshot-1' }),
      }),
      { params: { id: 'job-1' } }
    )

    expect(mockSaveDraftJobActuals).toHaveBeenCalledWith({
      orgId: 'org-1',
      jobId: 'job-1',
      userId: 'user-1',
      input: mockNormalizeJobActualsDraftInput.mock.results[0].value.data,
    })
    await expect(response.json()).resolves.toEqual({
      data: actuals,
      notice: 'Job actuals saved.',
    })
  })

  it('POST submit transitions draft actuals', async () => {
    mockSubmitJobActuals.mockResolvedValue({
      ok: true,
      data: { ...actuals, status: 'submitted' },
    })

    const response = await SUBMIT(
      new Request('http://localhost/api/jobs/job-1/actuals/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estimate_snapshot_id: 'snapshot-1' }),
      }),
      { params: { id: 'job-1' } }
    )

    expect(mockSubmitJobActuals).toHaveBeenCalledWith({
      orgId: 'org-1',
      jobId: 'job-1',
      userId: 'user-1',
      estimateSnapshotId: 'snapshot-1',
    })
    await expect(response.json()).resolves.toEqual({
      data: { ...actuals, status: 'submitted' },
      notice: 'Job actuals submitted.',
    })
  })

  it('POST lock transitions submitted actuals', async () => {
    mockLockJobActuals.mockResolvedValue({ ok: true, data: { ...actuals, status: 'locked' } })

    const response = await LOCK(
      new Request('http://localhost/api/jobs/job-1/actuals/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estimate_snapshot_id: 'snapshot-1' }),
      }),
      { params: { id: 'job-1' } }
    )

    expect(mockLockJobActuals).toHaveBeenCalledWith({
      orgId: 'org-1',
      jobId: 'job-1',
      userId: 'user-1',
      estimateSnapshotId: 'snapshot-1',
    })
    await expect(response.json()).resolves.toEqual({
      data: { ...actuals, status: 'locked' },
      notice: 'Job actuals locked.',
    })
  })

  it('authenticates before reading params or body', async () => {
    mockRequireSessionUserOrg.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })

    const response = await PUT(
      new Request('http://localhost/api/jobs/job-1/actuals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estimate_snapshot_id: 'snapshot-1' }),
      }),
      { params: { id: 'job-1' } }
    )

    expect(response.status).toBe(401)
    expect(mockResolveParams).not.toHaveBeenCalled()
    expect(mockNormalizeJobActualsDraftInput).not.toHaveBeenCalled()
    expect(mockSaveDraftJobActuals).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('returns 400 with an error envelope for an invalid job id', async () => {
    mockReadUuidParam.mockReturnValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Invalid job id' }), { status: 400 }),
    })

    const response = await GET(
      new Request('http://localhost/api/jobs/not-a-uuid/actuals?estimateSnapshotId=snapshot-1'),
      { params: { id: 'not-a-uuid' } }
    )

    expect(response.status).toBe(400)
    expect(mockLoadJobActuals).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ error: 'Invalid job id' })
  })

  it('returns 400 with an error envelope for an invalid estimate snapshot id', async () => {
    mockNormalizeActualsSnapshotId.mockReturnValueOnce({
      ok: false,
      message: 'Invalid estimate snapshot id',
    })

    const response = await GET(
      new Request('http://localhost/api/jobs/job-1/actuals?estimateSnapshotId=bad-snapshot'),
      { params: { id: 'job-1' } }
    )

    expect(response.status).toBe(400)
    expect(mockLoadJobActuals).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ error: 'Invalid estimate snapshot id' })
  })

  it('maps GET service errors through serviceResultResponse', async () => {
    mockLoadJobActuals.mockResolvedValue({
      ok: false,
      kind: 'not_found',
      message: 'Job actuals not found',
    })

    const response = await GET(
      new Request('http://localhost/api/jobs/job-1/actuals?estimateSnapshotId=snapshot-1'),
      { params: { id: 'job-1' } }
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Job actuals not found' })
  })

  it('maps lock service errors through serviceResultResponse', async () => {
    mockLockJobActuals.mockResolvedValue({
      ok: false,
      kind: 'conflict',
      message: 'Job actuals are already locked',
    })

    const response = await LOCK(
      new Request('http://localhost/api/jobs/job-1/actuals/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estimate_snapshot_id: 'snapshot-1' }),
      }),
      { params: { id: 'job-1' } }
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({ error: 'Job actuals are already locked' })
  })
})
