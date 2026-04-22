import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockRequireSessionUserOrg,
  mockReadUuidParam,
  mockReadJsonBody,
  mockFrom,
} = vi.hoisted(() => ({
  mockRequireSessionUserOrg: vi.fn(),
  mockReadUuidParam: vi.fn(),
  mockReadJsonBody: vi.fn(),
  mockFrom: vi.fn(),
}))

vi.mock('@/lib/server/apiRoute', () => ({
  requireSessionUserOrg: mockRequireSessionUserOrg,
  readUuidParam: mockReadUuidParam,
  readJsonBody: mockReadJsonBody,
  resolveParams: (context: { params: unknown }) => Promise.resolve(context.params),
  jsonError: (error: string, status: number) =>
    new Response(JSON.stringify({ error }), { status }),
}))

vi.mock('@/lib/server/org', () => ({
  supabaseAdmin: {
    from: mockFrom,
  },
}))

import { PATCH } from '../estimates/v2/products/[id]/route'

function createSelectSingleChain(result: unknown) {
  const chain = {
    eq: vi.fn(),
    single: vi.fn().mockResolvedValue(result),
  }
  chain.eq.mockReturnValue(chain)
  return chain
}

function createUpdateChain(result: unknown) {
  const chain = {
    eq: vi.fn(),
    select: vi.fn(),
    single: vi.fn().mockResolvedValue(result),
  }
  chain.eq.mockReturnValue(chain)
  chain.select.mockReturnValue(chain)
  return chain
}

describe('estimate products [id] route', () => {
  beforeEach(() => {
    mockRequireSessionUserOrg.mockReset()
    mockReadUuidParam.mockReset()
    mockReadJsonBody.mockReset()
    mockFrom.mockReset()

    mockRequireSessionUserOrg.mockResolvedValue({
      ok: true,
      session: { orgId: 'org-1', userId: 'user-1' },
    })
    mockReadUuidParam.mockReturnValue({
      ok: true,
      value: '11111111-1111-4111-8111-111111111111',
    })
  })

  it('rejects invalid merged product payloads with field errors', async () => {
    mockReadJsonBody.mockResolvedValue({
      ok: true,
      value: { efficiency_pct: 120 },
    })

    const existingRow = {
      id: '11111111-1111-4111-8111-111111111111',
      org_id: 'org-1',
      name: 'Super Paint',
      family: 'Paint',
      base: 'A',
      subtype: 'Interior',
      cost_per_unit: 30,
      coverage_sqft_per_gal_per_coat: 350,
      efficiency_pct: 90,
      default_coats: 2,
      default_sheen: 'Eggshell',
      default_scopes: ['Walls'],
      notes: '',
      status: 'Active',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    }

    mockFrom.mockReturnValueOnce({
      select: vi.fn(() => createSelectSingleChain({ data: existingRow, error: null })),
    })

    const response = await PATCH(new Request('http://localhost/api/estimates/v2/products/id'), {
      params: { id: '11111111-1111-4111-8111-111111111111' },
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Efficiency must be 100 or less.',
      fields: {
        efficiency_pct: 'Efficiency must be 100 or less.',
      },
    })
  })

  it('merges partial updates with the existing row before saving', async () => {
    mockReadJsonBody.mockResolvedValue({
      ok: true,
      value: { name: 'Super Paint Pro', notes: ' Updated ' },
    })

    const existingRow = {
      id: '11111111-1111-4111-8111-111111111111',
      org_id: 'org-1',
      name: 'Super Paint',
      family: 'Paint',
      base: 'A',
      subtype: 'Interior',
      cost_per_unit: 30,
      coverage_sqft_per_gal_per_coat: 350,
      efficiency_pct: 90,
      default_coats: 2,
      default_sheen: 'Eggshell',
      default_scopes: ['Walls'],
      notes: '',
      status: 'Active',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    }
    const savedRow = {
      ...existingRow,
      name: 'Super Paint Pro',
      notes: 'Updated',
    }

    const updateSpy = vi.fn(() => createUpdateChain({ data: savedRow, error: null }))

    mockFrom
      .mockReturnValueOnce({
        select: vi.fn(() => createSelectSingleChain({ data: existingRow, error: null })),
      })
      .mockReturnValueOnce({
        update: updateSpy,
      })

    const response = await PATCH(new Request('http://localhost/api/estimates/v2/products/id'), {
      params: { id: '11111111-1111-4111-8111-111111111111' },
    })

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Super Paint Pro',
        family: 'Paint',
        base: 'A',
        subtype: 'Interior',
        cost_per_unit: 30,
        coverage_sqft_per_gal_per_coat: 350,
        efficiency_pct: 90,
        default_coats: 2,
        default_sheen: 'Eggshell',
        default_scopes: ['Walls'],
        notes: 'Updated',
        status: 'Active',
        updated_at: expect.any(String),
      })
    )
    await expect(response.json()).resolves.toEqual({
      data: savedRow,
      notice: 'Product updated.',
    })
  })
})
