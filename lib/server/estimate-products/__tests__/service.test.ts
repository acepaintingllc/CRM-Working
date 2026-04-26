import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  archiveEstimateProductRecord: vi.fn(),
  createEstimateProductRecord: vi.fn(),
  deleteEstimateProductRecord: vi.fn(),
  findEstimateProductReferences: vi.fn(),
  listEstimateProductRecords: vi.fn(),
  loadEstimateProductRecord: vi.fn(),
  updateEstimateProductRecord: vi.fn(),
}))

vi.mock('../repository.ts', () => ({
  archiveEstimateProductRecord: mocks.archiveEstimateProductRecord,
  createEstimateProductRecord: mocks.createEstimateProductRecord,
  deleteEstimateProductRecord: mocks.deleteEstimateProductRecord,
  findEstimateProductReferences: mocks.findEstimateProductReferences,
  listEstimateProductRecords: mocks.listEstimateProductRecords,
  loadEstimateProductRecord: mocks.loadEstimateProductRecord,
  updateEstimateProductRecord: mocks.updateEstimateProductRecord,
}))

import {
  createEstimateProduct,
  deleteEstimateProduct,
  listEstimateProducts,
  updateEstimateProduct,
} from '../service.ts'

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

describe('estimate product service', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
  })

  it('normalizes list filters before delegating to the repository', async () => {
    mocks.listEstimateProductRecords.mockResolvedValue({
      ok: true,
      data: [existingRow],
    })

    await expect(
      listEstimateProducts(
        'org-1',
        new URLSearchParams('status=bogus&family=Paint&scope=Walls&search=%super_')
      )
    ).resolves.toEqual({
      ok: true,
      data: [existingRow],
    })

    expect(mocks.listEstimateProductRecords).toHaveBeenCalledWith(
      'org-1',
      {
        status: 'active',
        family: 'Paint',
        scope: 'Walls',
        search: '%super_',
      },
      {}
    )
  })

  it('returns structured validation failures for invalid create payloads', async () => {
    await expect(createEstimateProduct('org-1', { efficiency_pct: 120 })).resolves.toEqual({
      ok: false,
      kind: 'invalid_input',
      message: 'Product name is required.',
      fields: {
        name: 'Product name is required.',
        efficiency_pct: 'Efficiency must be 100 or less.',
      },
    })

    expect(mocks.createEstimateProductRecord).not.toHaveBeenCalled()
  })

  it('creates validated products through the repository boundary', async () => {
    mocks.createEstimateProductRecord.mockResolvedValue({
      ok: true,
      data: existingRow,
    })

    await expect(
      createEstimateProduct('org-1', {
        name: 'Super Paint',
        family: 'Paint',
        default_sheen: 'Eggshell',
        default_scopes: ['Walls'],
        status: 'Archived',
      })
    ).resolves.toEqual({
      ok: true,
      data: existingRow,
    })

    expect(mocks.createEstimateProductRecord).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({
        name: 'Super Paint',
        family: 'Paint',
        default_sheen: 'Eggshell',
        default_scopes: ['Walls'],
        status: 'Archived',
      }),
      {}
    )
  })

  it('merges partial updates with the existing row before saving', async () => {
    mocks.loadEstimateProductRecord.mockResolvedValue({
      ok: true,
      data: existingRow,
    })
    mocks.updateEstimateProductRecord.mockResolvedValue({
      ok: true,
      data: { ...existingRow, name: 'Super Paint Pro', notes: 'Updated' },
    })

    await expect(
      updateEstimateProduct('org-1', existingRow.id, {
        name: 'Super Paint Pro',
        notes: ' Updated ',
      })
    ).resolves.toEqual({
      ok: true,
      data: { ...existingRow, name: 'Super Paint Pro', notes: 'Updated' },
    })

    expect(mocks.updateEstimateProductRecord).toHaveBeenCalledWith(
      'org-1',
      existingRow.id,
      expect.objectContaining({
        name: 'Super Paint Pro',
        family: 'Paint',
        notes: 'Updated',
      }),
      {}
    )
  })

  it('returns validation failures for invalid updates without calling the write repository', async () => {
    mocks.loadEstimateProductRecord.mockResolvedValue({
      ok: true,
      data: existingRow,
    })

    await expect(
      updateEstimateProduct('org-1', existingRow.id, {
        name: '   ',
        efficiency_pct: 120,
      })
    ).resolves.toEqual({
      ok: false,
      kind: 'invalid_input',
      message: 'Product name is required.',
      fields: {
        name: 'Product name is required.',
        efficiency_pct: 'Efficiency must be 100 or less.',
      },
    })

    expect(mocks.updateEstimateProductRecord).not.toHaveBeenCalled()
  })

  it('archives status-only update patches through the status-only repository path', async () => {
    mocks.loadEstimateProductRecord.mockResolvedValue({
      ok: true,
      data: existingRow,
    })
    mocks.archiveEstimateProductRecord.mockResolvedValue({
      ok: true,
      data: { ...existingRow, status: 'Archived' },
    })

    await expect(updateEstimateProduct('org-1', existingRow.id, { status: 'Archived' })).resolves.toEqual({
      ok: true,
      data: { ...existingRow, status: 'Archived' },
    })

    expect(mocks.archiveEstimateProductRecord).toHaveBeenCalledWith(
      'org-1',
      existingRow.id,
      {}
    )
  })

  it('returns an already archived row from status-only update patches without writing again', async () => {
    mocks.loadEstimateProductRecord.mockResolvedValue({
      ok: true,
      data: { ...existingRow, status: 'Archived' },
    })

    await expect(updateEstimateProduct('org-1', existingRow.id, { status: 'Archived' })).resolves.toEqual({
      ok: true,
      data: { ...existingRow, status: 'Archived' },
    })

    expect(mocks.archiveEstimateProductRecord).not.toHaveBeenCalled()
  })

  it('prevents hard delete when quote defaults or estimate references still point at the product', async () => {
    mocks.loadEstimateProductRecord.mockResolvedValue({
      ok: true,
      data: existingRow,
    })
    mocks.findEstimateProductReferences.mockResolvedValue({
      ok: true,
      data: [
        { source: 'quote_defaults', label: 'quote defaults' },
        { source: 'wall_scopes', label: 'wall scope product selections' },
      ],
    })

    await expect(deleteEstimateProduct('org-1', existingRow.id)).resolves.toEqual({
      ok: false,
      kind: 'conflict',
      message:
        'Product is still referenced by quote defaults, wall scope product selections. Archive the product instead to keep quote defaults and historical estimates intact.',
    })

    expect(mocks.deleteEstimateProductRecord).not.toHaveBeenCalled()
  })

  it('allows hard delete when reference checks prove the product is unused', async () => {
    mocks.loadEstimateProductRecord.mockResolvedValue({
      ok: true,
      data: existingRow,
    })
    mocks.findEstimateProductReferences.mockResolvedValue({
      ok: true,
      data: [],
    })
    mocks.deleteEstimateProductRecord.mockResolvedValue({
      ok: true,
      data: true,
    })

    await expect(deleteEstimateProduct('org-1', existingRow.id)).resolves.toEqual({
      ok: true,
      data: true,
    })

    expect(mocks.deleteEstimateProductRecord).toHaveBeenCalledWith(
      'org-1',
      existingRow.id,
      {}
    )
  })

  it('propagates not-found reads without duplicating rules', async () => {
    mocks.loadEstimateProductRecord
      .mockResolvedValueOnce({
        ok: false,
        kind: 'not_found',
        message: 'Product not found',
      })
      .mockResolvedValueOnce({
        ok: false,
        kind: 'not_found',
        message: 'Product not found',
      })

    await expect(updateEstimateProduct('org-1', existingRow.id, { name: 'Missing' })).resolves.toEqual({
      ok: false,
      kind: 'not_found',
      message: 'Product not found',
    })
    await expect(deleteEstimateProduct('org-1', existingRow.id)).resolves.toEqual({
      ok: false,
      kind: 'not_found',
      message: 'Product not found',
    })

    expect(mocks.findEstimateProductReferences).not.toHaveBeenCalled()
    expect(mocks.deleteEstimateProductRecord).not.toHaveBeenCalled()
  })
})
