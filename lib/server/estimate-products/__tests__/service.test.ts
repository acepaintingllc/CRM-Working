import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createEstimateProductRecord: vi.fn(),
  deleteEstimateProductRecord: vi.fn(),
  listEstimateProductRecords: vi.fn(),
  loadEstimateProductRecord: vi.fn(),
  updateEstimateProductRecord: vi.fn(),
}))

vi.mock('../repository.ts', () => ({
  createEstimateProductRecord: mocks.createEstimateProductRecord,
  deleteEstimateProductRecord: mocks.deleteEstimateProductRecord,
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
        new URLSearchParams('status=bogus&family=Paint&search=%super_')
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

  it('propagates not-found reads and delete boundaries without duplicating rules', async () => {
    mocks.loadEstimateProductRecord
      .mockResolvedValueOnce({
        ok: false,
        kind: 'not_found',
        message: 'Product not found',
      })
      .mockResolvedValueOnce({
        ok: true,
        data: existingRow,
      })
    mocks.deleteEstimateProductRecord.mockResolvedValue({
      ok: true,
      data: true,
    })

    await expect(updateEstimateProduct('org-1', existingRow.id, { name: 'Missing' })).resolves.toEqual({
      ok: false,
      kind: 'not_found',
      message: 'Product not found',
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
})
