import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockRequireSessionUserOrg,
  mockListJobs,
  mockNormalizeCreateJobInput,
  mockCreateJob,
} = vi.hoisted(() => ({
  mockRequireSessionUserOrg: vi.fn(),
  mockListJobs: vi.fn(),
  mockNormalizeCreateJobInput: vi.fn(),
  mockCreateJob: vi.fn(),
}))

vi.mock('@/lib/server/apiRoute', async () => ({
  requireSessionUserOrg: mockRequireSessionUserOrg,
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
  listJobs: mockListJobs,
  normalizeCreateJobInput: mockNormalizeCreateJobInput,
  createJob: mockCreateJob,
}))

import { GET, POST } from '../jobs/route'

describe('jobs route', () => {
  beforeEach(() => {
    mockRequireSessionUserOrg.mockReset()
    mockListJobs.mockReset()
    mockNormalizeCreateJobInput.mockReset()
    mockCreateJob.mockReset()
    mockRequireSessionUserOrg.mockResolvedValue({
      ok: true,
      session: { orgId: 'org-1', userId: 'user-1' },
    })
  })

  it('returns the standard data envelope for GET', async () => {
    mockListJobs.mockResolvedValue({
      ok: true,
      data: [{ id: 'job-1', title: 'Paint', status: 'estimate_scheduled' }],
    })

    const response = await GET()

    await expect(response.json()).resolves.toEqual({
      data: [{ id: 'job-1', title: 'Paint', status: 'estimate_scheduled' }],
    })
  })

  it('returns the standard mutation envelope for POST', async () => {
    mockNormalizeCreateJobInput.mockReturnValue({
      ok: true,
      data: { customer_id: 'customer-1', title: 'Paint house' },
    })
    mockCreateJob.mockResolvedValue({
      ok: true,
      data: { id: 'job-1', title: 'Paint house', status: 'estimate_scheduled' },
    })

    const response = await POST(
      new Request('http://localhost/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: 'customer-1', title: 'Paint house' }),
      })
    )

    await expect(response.json()).resolves.toEqual({
      data: { id: 'job-1', title: 'Paint house', status: 'estimate_scheduled' },
      notice: 'Job created.',
    })
  })

  it('maps normalization failures through the shared error response', async () => {
    mockNormalizeCreateJobInput.mockReturnValue({
      ok: false,
      kind: 'invalid_input',
      message: 'Missing title',
    })

    const response = await POST(
      new Request('http://localhost/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: 'customer-1' }),
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Missing title' })
  })

  it('maps auth failures through the shared session guard', async () => {
    mockRequireSessionUserOrg.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401 }),
    })

    const response = await GET()

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Not authenticated' })
  })
})
