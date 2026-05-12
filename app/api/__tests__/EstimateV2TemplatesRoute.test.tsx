import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockRequireSessionUserOrg,
  mockListEstimateTemplates,
  mockCreateEstimateTemplate,
  mockUpdateEstimateTemplate,
} = vi.hoisted(() => ({
  mockRequireSessionUserOrg: vi.fn(),
  mockListEstimateTemplates: vi.fn(),
  mockCreateEstimateTemplate: vi.fn(),
  mockUpdateEstimateTemplate: vi.fn(),
}))

vi.mock('@/lib/server/apiRoute', async () => {
  const actual = await vi.importActual<typeof import('@/lib/server/apiRoute')>(
    '@/lib/server/apiRoute'
  )
  return {
    ...actual,
    requireSessionUserOrg: mockRequireSessionUserOrg,
    readJsonBody: async (request: Request) => {
      try {
        return { ok: true as const, value: (await request.json()) as Record<string, unknown> }
      } catch {
        return {
          ok: false as const,
          response: Response.json({ error: 'Invalid JSON body.' }, { status: 400 }),
        }
      }
    },
  }
})

vi.mock('@/lib/server/estimate-templates/service', () => ({
  listEstimateTemplates: mockListEstimateTemplates,
  createEstimateTemplate: mockCreateEstimateTemplate,
  updateEstimateTemplate: mockUpdateEstimateTemplate,
}))

import { GET, POST } from '../estimates/v2/templates/route'
import { PATCH } from '../estimates/v2/templates/[id]/route'

describe('Estimate V2 templates route', () => {
  beforeEach(() => {
    mockRequireSessionUserOrg.mockReset()
    mockListEstimateTemplates.mockReset()
    mockCreateEstimateTemplate.mockReset()
    mockUpdateEstimateTemplate.mockReset()
    mockRequireSessionUserOrg.mockResolvedValue({
      ok: true,
      session: { orgId: 'org-1', userId: 'user-1' },
    })
  })

  it('returns list payload in the standard read envelope', async () => {
    mockListEstimateTemplates.mockResolvedValue({
      ok: true,
      data: { room_templates: [], job_templates: [] },
    })

    const response = await GET(
      new Request('http://localhost/api/estimates/v2/templates?kind=room')
    )

    expect(mockListEstimateTemplates).toHaveBeenCalledWith(
      'org-1',
      expect.any(URLSearchParams)
    )
    await expect(response.json()).resolves.toEqual({
      data: { room_templates: [], job_templates: [] },
    })
  })

  it('creates templates through the standard mutation envelope', async () => {
    mockCreateEstimateTemplate.mockResolvedValue({
      ok: true,
      data: { id: 'template-1', name: 'Bedroom' },
    })

    const response = await POST(
      new Request('http://localhost/api/estimates/v2/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'room', name: 'Bedroom' }),
      })
    )

    expect(mockCreateEstimateTemplate).toHaveBeenCalledWith(
      'org-1',
      'user-1',
      { kind: 'room', name: 'Bedroom' }
    )
    await expect(response.json()).resolves.toEqual({
      data: { id: 'template-1', name: 'Bedroom' },
      notice: 'Template saved.',
    })
  })

  it('updates templates through the standard mutation envelope', async () => {
    mockUpdateEstimateTemplate.mockResolvedValue({
      ok: true,
      data: { id: '00000000-0000-0000-0000-000000000001', name: 'Bedroom' },
    })

    const response = await PATCH(
      new Request('http://localhost/api/estimates/v2/templates/00000000-0000-0000-0000-000000000001', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'room', name: 'Bedroom' }),
      }),
      { params: { id: '00000000-0000-0000-0000-000000000001' } }
    )

    expect(mockUpdateEstimateTemplate).toHaveBeenCalledWith(
      'org-1',
      'user-1',
      '00000000-0000-0000-0000-000000000001',
      { kind: 'room', name: 'Bedroom' }
    )
    await expect(response.json()).resolves.toEqual({
      data: { id: '00000000-0000-0000-0000-000000000001', name: 'Bedroom' },
      notice: 'Template updated.',
    })
  })

  it('maps auth failures through the shared session guard', async () => {
    mockRequireSessionUserOrg.mockResolvedValueOnce({
      ok: false,
      response: Response.json({ error: 'Not authenticated' }, { status: 401 }),
    })

    const response = await GET(new Request('http://localhost/api/estimates/v2/templates'))
    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Not authenticated' })
  })
})
