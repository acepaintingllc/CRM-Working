import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireSessionUserOrg: vi.fn(),
  readUuidParam: vi.fn(),
  readJsonBody: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/server/apiRoute', () => ({
  requireSessionUserOrg: mocks.requireSessionUserOrg,
  readUuidParam: mocks.readUuidParam,
  readJsonBody: mocks.readJsonBody,
  resolveParams: (context: { params: unknown }) => Promise.resolve(context.params),
  jsonError: (error: string, status: number) =>
    new Response(JSON.stringify({ error }), { status }),
}))

vi.mock('@/lib/server/org', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import {
  handleEstimateProductRouteDelete,
  handleEstimateProductRoutePatch,
  handleEstimateProductsRouteGet,
  handleEstimateProductsRoutePost,
} from '../estimateProductRoutes'

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

function createDeleteChain(result: unknown) {
  const chain = {
    eq: vi.fn(),
  }
  chain.eq.mockImplementation(() => {
    if (chain.eq.mock.calls.length >= 2) {
      return Promise.resolve(result)
    }
    return chain
  })
  return chain
}

function createListChain(result: unknown) {
  const chain = {
    eq: vi.fn(),
    or: vi.fn(),
    order: vi.fn().mockResolvedValue(result),
  }
  chain.eq.mockReturnValue(chain)
  chain.or.mockReturnValue(chain)
  return chain
}

function createInsertChain(result: unknown) {
  const chain = {
    select: vi.fn(),
    single: vi.fn().mockResolvedValue(result),
  }
  chain.select.mockReturnValue(chain)
  return chain
}

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

describe('estimate product routes', () => {
  beforeEach(() => {
    mocks.requireSessionUserOrg.mockReset()
    mocks.readUuidParam.mockReset()
    mocks.readJsonBody.mockReset()
    mocks.from.mockReset()

    mocks.requireSessionUserOrg.mockResolvedValue({
      ok: true,
      session: { orgId: 'org-1', userId: 'user-1' },
    })
    mocks.readUuidParam.mockReturnValue({
      ok: true,
      value: existingRow.id,
    })
  })

  it('filters active products by default and returns all statuses when requested', async () => {
    const activeChain = createListChain({
      data: [{ id: 'product-1', status: 'Active' }],
      error: null,
    })
    const allChain = createListChain({
      data: [
        { id: 'product-1', status: 'Active' },
        { id: 'product-2', status: 'Archived' },
      ],
      error: null,
    })

    mocks.from
      .mockReturnValueOnce({ select: vi.fn(() => activeChain) })
      .mockReturnValueOnce({ select: vi.fn(() => allChain) })

    const activeResponse = await handleEstimateProductsRouteGet(
      new Request('http://localhost/api/estimates/v2/products')
    )
    const allResponse = await handleEstimateProductsRouteGet(
      new Request('http://localhost/api/estimates/v2/products?status=all')
    )

    expect(activeChain.eq).toHaveBeenNthCalledWith(1, 'org_id', 'org-1')
    expect(activeChain.eq).toHaveBeenNthCalledWith(2, 'status', 'Active')
    expect(allChain.eq).toHaveBeenCalledTimes(1)
    await expect(activeResponse.json()).resolves.toEqual({
      data: [{ id: 'product-1', status: 'Active' }],
    })
    await expect(allResponse.json()).resolves.toEqual({
      data: [
        { id: 'product-1', status: 'Active' },
        { id: 'product-2', status: 'Archived' },
      ],
    })
  })

  it('applies family and search filters when requested', async () => {
    const filteredChain = createListChain({
      data: [{ id: 'product-1', family: 'Paint', name: 'Super Paint' }],
      error: null,
    })

    mocks.from.mockReturnValueOnce({ select: vi.fn(() => filteredChain) })

    const response = await handleEstimateProductsRouteGet(
      new Request(
        'http://localhost/api/estimates/v2/products?status=active&family=Paint&search=super'
      )
    )

    expect(filteredChain.eq).toHaveBeenNthCalledWith(1, 'org_id', 'org-1')
    expect(filteredChain.eq).toHaveBeenNthCalledWith(2, 'status', 'Active')
    expect(filteredChain.eq).toHaveBeenNthCalledWith(3, 'family', 'Paint')
    expect(filteredChain.or).toHaveBeenCalledWith(
      'name.ilike.%super%,base.ilike.%super%,subtype.ilike.%super%,notes.ilike.%super%,status.ilike.%super%'
    )
    await expect(response.json()).resolves.toEqual({
      data: [{ id: 'product-1', family: 'Paint', name: 'Super Paint' }],
    })
  })

  it('returns stable validation errors for invalid create payloads', async () => {
    mocks.readJsonBody.mockResolvedValue({
      ok: true,
      value: { efficiency_pct: 120 },
    })

    const response = await handleEstimateProductsRoutePost(
      new Request('http://localhost/api/estimates/v2/products', { method: 'POST' })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Product name is required.',
      fields: {
        name: 'Product name is required.',
        efficiency_pct: 'Efficiency must be 100 or less.',
      },
    })
  })

  it('creates products with the canonical mutation envelope', async () => {
    mocks.readJsonBody.mockResolvedValue({
      ok: true,
      value: {
        name: 'Super Paint',
        family: 'Paint',
        default_sheen: 'Eggshell',
        default_scopes: ['Walls'],
        status: 'Archived',
      },
    })

    const insertSpy = vi.fn(() =>
      createInsertChain({
        data: { ...existingRow, status: 'Archived' },
        error: null,
      })
    )
    mocks.from.mockReturnValueOnce({
      insert: insertSpy,
    })

    const response = await handleEstimateProductsRoutePost(
      new Request('http://localhost/api/estimates/v2/products', { method: 'POST' })
    )

    expect(insertSpy).toHaveBeenCalledWith([
      expect.objectContaining({
        org_id: 'org-1',
        name: 'Super Paint',
        status: 'Archived',
      }),
    ])
    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({
      data: { ...existingRow, status: 'Archived' },
      notice: 'Product created.',
    })
  })

  it('merges partial updates with the existing row before saving', async () => {
    mocks.readJsonBody.mockResolvedValue({
      ok: true,
      value: { name: 'Super Paint Pro', notes: ' Updated ' },
    })

    const updateSpy = vi.fn(() =>
      createUpdateChain({
        data: { ...existingRow, name: 'Super Paint Pro', notes: 'Updated' },
        error: null,
      })
    )

    mocks.from
      .mockReturnValueOnce({
        select: vi.fn(() => createSelectSingleChain({ data: existingRow, error: null })),
      })
      .mockReturnValueOnce({
        update: updateSpy,
      })

    const response = await handleEstimateProductRoutePatch(
      new Request('http://localhost/api/estimates/v2/products/id', { method: 'PATCH' }),
      {
        params: { id: existingRow.id },
      }
    )

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Super Paint Pro',
        family: 'Paint',
        notes: 'Updated',
        updated_at: expect.any(String),
      })
    )
    await expect(response.json()).resolves.toEqual({
      data: { ...existingRow, name: 'Super Paint Pro', notes: 'Updated' },
      notice: 'Product updated.',
    })
  })

  it('returns a stable not-found error when patching or deleting a missing row', async () => {
    mocks.readJsonBody.mockResolvedValue({
      ok: true,
      value: { name: 'Missing' },
    })

    mocks.from
      .mockReturnValueOnce({
        select: vi.fn(() =>
          createSelectSingleChain({ data: null, error: { message: 'not found' } })
        ),
      })
      .mockReturnValueOnce({
        select: vi.fn(() =>
          createSelectSingleChain({ data: null, error: { message: 'not found' } })
        ),
      })

    const patchResponse = await handleEstimateProductRoutePatch(
      new Request('http://localhost/api/estimates/v2/products/id', { method: 'PATCH' }),
      {
        params: { id: existingRow.id },
      }
    )
    const deleteResponse = await handleEstimateProductRouteDelete(
      new Request('http://localhost/api/estimates/v2/products/id', { method: 'DELETE' }),
      {
        params: { id: existingRow.id },
      }
    )

    expect(patchResponse.status).toBe(404)
    expect(deleteResponse.status).toBe(404)
    await expect(patchResponse.json()).resolves.toEqual({ error: 'Product not found' })
    await expect(deleteResponse.json()).resolves.toEqual({ error: 'Product not found' })
  })

  it('deletes products with the canonical mutation envelope', async () => {
    mocks.from
      .mockReturnValueOnce({
        select: vi.fn(() => createSelectSingleChain({ data: existingRow, error: null })),
      })
      .mockReturnValueOnce({
        delete: vi.fn(() => createDeleteChain({ error: null })),
      })

    const response = await handleEstimateProductRouteDelete(
      new Request('http://localhost/api/estimates/v2/products/id', { method: 'DELETE' }),
      {
        params: { id: existingRow.id },
      }
    )

    await expect(response.json()).resolves.toEqual({
      data: true,
      notice: 'Product deleted.',
    })
  })
})
