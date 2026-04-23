import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  requireSessionUserOrg: vi.fn(),
  readUuidParam: vi.fn(),
  readJsonBody: vi.fn(),
  createEstimateProduct: vi.fn(),
  deleteEstimateProduct: vi.fn(),
  listEstimateProducts: vi.fn(),
  updateEstimateProduct: vi.fn(),
}))

vi.mock('../apiRoute.ts', () => ({
  requireSessionUserOrg: mocks.requireSessionUserOrg,
  readUuidParam: mocks.readUuidParam,
  readJsonBody: mocks.readJsonBody,
  resolveParams: (context: { params: unknown }) => Promise.resolve(context.params),
  jsonError: (error: string, status: number) =>
    new Response(JSON.stringify({ error }), { status }),
}))

vi.mock('../estimate-products/service.ts', () => ({
  createEstimateProduct: mocks.createEstimateProduct,
  deleteEstimateProduct: mocks.deleteEstimateProduct,
  isEstimateProductValidationFailure: (
    result: { ok: boolean; fields?: Record<string, string> }
  ) => !result.ok && Boolean(result.fields),
  listEstimateProducts: mocks.listEstimateProducts,
  updateEstimateProduct: mocks.updateEstimateProduct,
}))

import {
  handleEstimateProductRouteDelete,
  handleEstimateProductRoutePatch,
  handleEstimateProductsRouteGet,
  handleEstimateProductsRoutePost,
} from '../estimateProductRoutes.ts'

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
    mocks.createEstimateProduct.mockReset()
    mocks.deleteEstimateProduct.mockReset()
    mocks.listEstimateProducts.mockReset()
    mocks.updateEstimateProduct.mockReset()

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
    mocks.listEstimateProducts
      .mockResolvedValueOnce({
        ok: true,
        data: [{ id: 'product-1', status: 'Active' }],
      })
      .mockResolvedValueOnce({
        ok: true,
        data: [
          { id: 'product-1', status: 'Active' },
          { id: 'product-2', status: 'Archived' },
        ],
      })

    const activeResponse = await handleEstimateProductsRouteGet(
      new Request('http://localhost/api/estimates/v2/products')
    )
    const allResponse = await handleEstimateProductsRouteGet(
      new Request('http://localhost/api/estimates/v2/products?status=all')
    )

    expect(mocks.listEstimateProducts).toHaveBeenNthCalledWith(
      1,
      'org-1',
      expect.any(URLSearchParams)
    )
    expect(mocks.listEstimateProducts).toHaveBeenNthCalledWith(
      2,
      'org-1',
      expect.any(URLSearchParams)
    )
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
    mocks.listEstimateProducts.mockResolvedValueOnce({
      ok: true,
      data: [{ id: 'product-1', family: 'Paint', name: 'Super Paint' }],
    })

    const response = await handleEstimateProductsRouteGet(
      new Request(
        'http://localhost/api/estimates/v2/products?status=active&family=Paint&search=super'
      )
    )

    expect(mocks.listEstimateProducts).toHaveBeenCalledWith(
      'org-1',
      expect.any(URLSearchParams)
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
    mocks.createEstimateProduct.mockResolvedValue({
      ok: false,
      kind: 'invalid_input',
      message: 'Product name is required.',
      fields: {
        name: 'Product name is required.',
        efficiency_pct: 'Efficiency must be 100 or less.',
      },
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
    mocks.createEstimateProduct.mockResolvedValue({
      ok: true,
      data: { ...existingRow, status: 'Archived' },
    })

    const response = await handleEstimateProductsRoutePost(
      new Request('http://localhost/api/estimates/v2/products', { method: 'POST' })
    )

    expect(mocks.createEstimateProduct).toHaveBeenCalledWith('org-1', {
      name: 'Super Paint',
      family: 'Paint',
      default_sheen: 'Eggshell',
      default_scopes: ['Walls'],
      status: 'Archived',
    })
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
    mocks.updateEstimateProduct.mockResolvedValue({
      ok: true,
      data: { ...existingRow, name: 'Super Paint Pro', notes: 'Updated' },
    })

    const response = await handleEstimateProductRoutePatch(
      new Request('http://localhost/api/estimates/v2/products/id', { method: 'PATCH' }),
      {
        params: { id: existingRow.id },
      }
    )

    expect(mocks.updateEstimateProduct).toHaveBeenCalledWith(
      'org-1',
      existingRow.id,
      {
        name: 'Super Paint Pro',
        notes: ' Updated ',
      }
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
    mocks.updateEstimateProduct.mockResolvedValue({
      ok: false,
      kind: 'not_found',
      message: 'Product not found',
    })
    mocks.deleteEstimateProduct.mockResolvedValue({
      ok: false,
      kind: 'not_found',
      message: 'Product not found',
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
    mocks.deleteEstimateProduct.mockResolvedValue({
      ok: true,
      data: true,
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
