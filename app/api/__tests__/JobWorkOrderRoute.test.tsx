import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockRequireSessionUserOrg,
  mockResolveParams,
  mockReadUuidParam,
  mockLoadJobWorkOrder,
  mockNormalizeWorkOrderGenerateInput,
  mockGenerateJobWorkOrder,
  mockLockJobWorkOrder,
  mockVoidJobWorkOrder,
} = vi.hoisted(() => ({
  mockRequireSessionUserOrg: vi.fn(),
  mockResolveParams: vi.fn(),
  mockReadUuidParam: vi.fn(),
  mockLoadJobWorkOrder: vi.fn(),
  mockNormalizeWorkOrderGenerateInput: vi.fn(),
  mockGenerateJobWorkOrder: vi.fn(),
  mockLockJobWorkOrder: vi.fn(),
  mockVoidJobWorkOrder: vi.fn(),
}))

vi.mock('@/lib/server/apiRoute', async () => ({
  requireSessionUserOrg: mockRequireSessionUserOrg,
  resolveParams: mockResolveParams,
  readUuidParam: mockReadUuidParam,
  jsonError: (error: string, status: number) =>
    new Response(JSON.stringify({ error }), { status }),
  readJsonBody: async (request: Request) => {
    try {
      const text = await request.text()
      return { ok: true as const, value: text ? JSON.parse(text) as Record<string, unknown> : null }
    } catch {
      return {
        ok: false as const,
        response: new Response(JSON.stringify({ error: 'Invalid JSON body.' }), { status: 400 }),
      }
    }
  },
}))

vi.mock('@/lib/server/job-operations/workOrders', () => ({
  loadJobWorkOrder: mockLoadJobWorkOrder,
  normalizeWorkOrderGenerateInput: mockNormalizeWorkOrderGenerateInput,
  generateJobWorkOrder: mockGenerateJobWorkOrder,
  lockJobWorkOrder: mockLockJobWorkOrder,
  voidJobWorkOrder: mockVoidJobWorkOrder,
}))

import { GET } from '../jobs/[id]/work-order/route'
import { POST as GENERATE } from '../jobs/[id]/work-order/generate/route'
import { POST as LOCK } from '../jobs/[id]/work-order/lock/route'
import { POST as VOID } from '../jobs/[id]/work-order/void/route'

const workOrder = {
  id: 'work-order-1',
  job_id: 'job-1',
  revision_number: 1,
  status: 'generated',
}

describe('job work order routes', () => {
  beforeEach(() => {
    mockRequireSessionUserOrg.mockReset()
    mockResolveParams.mockReset()
    mockReadUuidParam.mockReset()
    mockLoadJobWorkOrder.mockReset()
    mockNormalizeWorkOrderGenerateInput.mockReset()
    mockGenerateJobWorkOrder.mockReset()
    mockLockJobWorkOrder.mockReset()
    mockVoidJobWorkOrder.mockReset()

    mockRequireSessionUserOrg.mockResolvedValue({
      ok: true,
      session: { orgId: 'org-1', userId: 'user-1' },
    })
    mockResolveParams.mockResolvedValue({ id: 'job-1' })
    mockReadUuidParam.mockReturnValue({ ok: true, value: 'job-1' })
    mockNormalizeWorkOrderGenerateInput.mockReturnValue({
      ok: true,
      data: {
        force_with_warnings: false,
        crew_notes: 'Use side door',
        access_prep_notes: null,
        special_notes: null,
      },
    })
  })

  it('GET returns the current work order in a data envelope', async () => {
    mockLoadJobWorkOrder.mockResolvedValue({ ok: true, data: { current: workOrder } })

    const response = await GET(new Request('http://localhost/api/jobs/job-1/work-order'), {
      params: { id: 'job-1' },
    })

    expect(mockLoadJobWorkOrder).toHaveBeenCalledWith('org-1', 'job-1')
    await expect(response.json()).resolves.toEqual({ data: { current: workOrder } })
  })

  it('POST generate normalizes input and delegates generation', async () => {
    mockGenerateJobWorkOrder.mockResolvedValue({ ok: true, data: workOrder })

    const response = await GENERATE(
      new Request('http://localhost/api/jobs/job-1/work-order/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crewNotes: 'Use side door' }),
      }),
      { params: { id: 'job-1' } }
    )

    expect(mockGenerateJobWorkOrder).toHaveBeenCalledWith({
      orgId: 'org-1',
      jobId: 'job-1',
      userId: 'user-1',
      input: mockNormalizeWorkOrderGenerateInput.mock.results[0].value.data,
    })
    await expect(response.json()).resolves.toEqual({
      data: workOrder,
      notice: 'Work order generated.',
    })
  })

  it('POST generate returns the warning notice when explicitly forced', async () => {
    mockNormalizeWorkOrderGenerateInput.mockReturnValueOnce({
      ok: true,
      data: {
        force_with_warnings: true,
        crew_notes: null,
        access_prep_notes: null,
        special_notes: null,
      },
    })
    mockGenerateJobWorkOrder.mockResolvedValue({ ok: true, data: workOrder })

    const response = await GENERATE(
      new Request('http://localhost/api/jobs/job-1/work-order/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force_with_warnings: true }),
      }),
      { params: { id: 'job-1' } }
    )

    await expect(response.json()).resolves.toEqual({
      data: workOrder,
      notice: 'Work order generated with warnings.',
    })
  })

  it('POST lock delegates the lifecycle transition', async () => {
    mockLockJobWorkOrder.mockResolvedValue({ ok: true, data: { ...workOrder, status: 'locked' } })

    const response = await LOCK(
      new Request('http://localhost/api/jobs/job-1/work-order/lock', { method: 'POST' }),
      { params: { id: 'job-1' } }
    )

    expect(mockLockJobWorkOrder).toHaveBeenCalledWith({
      orgId: 'org-1',
      jobId: 'job-1',
      userId: 'user-1',
    })
    await expect(response.json()).resolves.toEqual({
      data: { ...workOrder, status: 'locked' },
      notice: 'Work order locked.',
    })
  })

  it('POST void delegates the lifecycle transition', async () => {
    mockVoidJobWorkOrder.mockResolvedValue({ ok: true, data: { ...workOrder, status: 'void' } })

    const response = await VOID(
      new Request('http://localhost/api/jobs/job-1/work-order/void', { method: 'POST' }),
      { params: { id: 'job-1' } }
    )

    expect(mockVoidJobWorkOrder).toHaveBeenCalledWith({
      orgId: 'org-1',
      jobId: 'job-1',
      userId: 'user-1',
    })
    await expect(response.json()).resolves.toEqual({
      data: { ...workOrder, status: 'void' },
      notice: 'Work order voided.',
    })
  })

  it('authenticates before reading params or body', async () => {
    mockRequireSessionUserOrg.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })

    const response = await GENERATE(
      new Request('http://localhost/api/jobs/job-1/work-order/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crewNotes: 'Use side door' }),
      }),
      { params: { id: 'job-1' } }
    )

    expect(response.status).toBe(401)
    expect(mockResolveParams).not.toHaveBeenCalled()
    expect(mockNormalizeWorkOrderGenerateInput).not.toHaveBeenCalled()
    expect(mockGenerateJobWorkOrder).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('maps service conflicts through the standard error envelope', async () => {
    mockLockJobWorkOrder.mockResolvedValue({
      ok: false,
      kind: 'conflict',
      message: 'Only generated work orders can be locked.',
    })

    const response = await LOCK(
      new Request('http://localhost/api/jobs/job-1/work-order/lock', { method: 'POST' }),
      { params: { id: 'job-1' } }
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'Only generated work orders can be locked.',
    })
  })
})
