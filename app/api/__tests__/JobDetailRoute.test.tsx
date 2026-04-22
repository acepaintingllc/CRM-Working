import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockRequireSessionUserOrg,
  mockResolveParams,
  mockReadUuidParam,
  mockGetJobDetail,
  mockNormalizeUpdateJobInput,
  mockUpdateJob,
  mockDeleteJob,
} = vi.hoisted(() => ({
  mockRequireSessionUserOrg: vi.fn(),
  mockResolveParams: vi.fn(),
  mockReadUuidParam: vi.fn(),
  mockGetJobDetail: vi.fn(),
  mockNormalizeUpdateJobInput: vi.fn(),
  mockUpdateJob: vi.fn(),
  mockDeleteJob: vi.fn(),
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

vi.mock('@/lib/jobs/service', () => ({
  getJobDetail: mockGetJobDetail,
  normalizeUpdateJobInput: mockNormalizeUpdateJobInput,
  updateJob: mockUpdateJob,
  deleteJob: mockDeleteJob,
}))

import { DELETE, GET, PATCH } from '../jobs/[id]/route'

describe('job detail route', () => {
  beforeEach(() => {
    mockRequireSessionUserOrg.mockReset()
    mockResolveParams.mockReset()
    mockReadUuidParam.mockReset()
    mockGetJobDetail.mockReset()
    mockNormalizeUpdateJobInput.mockReset()
    mockUpdateJob.mockReset()
    mockDeleteJob.mockReset()

    mockRequireSessionUserOrg.mockResolvedValue({
      ok: true,
      session: { orgId: 'org-1', userId: 'user-1' },
    })
    mockResolveParams.mockResolvedValue({ id: 'job-1' })
    mockReadUuidParam.mockReturnValue({ ok: true, value: 'job-1' })
  })

  it('returns the standard data envelope for GET', async () => {
    mockGetJobDetail.mockResolvedValue({
      ok: true,
      data: { id: 'job-1', title: 'Paint house', status: 'scheduled' },
    })

    const response = await GET(new Request('http://localhost/jobs/job-1'), {
      params: { id: 'job-1' },
    })

    await expect(response.json()).resolves.toEqual({
      data: { id: 'job-1', title: 'Paint house', status: 'scheduled' },
    })
  })

  it('returns the standard mutation envelope for PATCH', async () => {
    mockNormalizeUpdateJobInput.mockReturnValue({
      ok: true,
      data: { status: 'completed' },
    })
    mockUpdateJob.mockResolvedValue({
      ok: true,
      data: { id: 'job-1', status: 'completed' },
    })

    const response = await PATCH(
      new Request('http://localhost/jobs/job-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      }),
      { params: { id: 'job-1' } }
    )

    await expect(response.json()).resolves.toEqual({
      data: { id: 'job-1', status: 'completed' },
      notice: 'Job updated.',
    })
  })

  it('returns a 400 for invalid ids', async () => {
    mockReadUuidParam.mockReturnValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Invalid job id' }), { status: 400 }),
    })

    const response = await GET(new Request('http://localhost/jobs/not-a-uuid'), {
      params: { id: 'not-a-uuid' },
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid job id' })
  })

  it('maps not found from the service layer', async () => {
    mockGetJobDetail.mockResolvedValue({
      ok: false,
      kind: 'not_found',
      message: 'Job not found',
    })

    const response = await GET(new Request('http://localhost/jobs/job-1'), {
      params: { id: 'job-1' },
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Job not found' })
  })

  it('returns the standard delete envelope', async () => {
    mockDeleteJob.mockResolvedValue({
      ok: true,
      data: { ok: true },
    })

    const response = await DELETE(new Request('http://localhost/jobs/job-1'), {
      params: { id: 'job-1' },
    })

    await expect(response.json()).resolves.toEqual({
      data: { ok: true },
      notice: 'Job deleted.',
    })
  })
})
