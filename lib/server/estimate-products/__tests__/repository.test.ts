import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createEstimateProductRecord,
  deleteEstimateProductRecord,
  listEstimateProductRecords,
  loadEstimateProductRecord,
  updateEstimateProductRecord,
} from '../repository.ts'

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

function createSelectSingleChain(result: unknown) {
  const chain = {
    eq: vi.fn(),
    single: vi.fn().mockResolvedValue(result),
  }
  chain.eq.mockReturnValue(chain)
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

describe('estimate product repository', () => {
  const createDepsFromMock = (mock: (relation: string) => unknown) => ({ from: mock })
  let fromMock: ReturnType<typeof vi.fn>
  let client: ReturnType<typeof createDepsFromMock>

  beforeEach(() => {
    fromMock = vi.fn()
    client = createDepsFromMock(fromMock as (relation: string) => unknown)
  })

  it('applies org, status, family, and search filters to the list query', async () => {
    const listChain = createListChain({
      data: [existingRow],
      error: null,
    })
    fromMock.mockReturnValue({ select: vi.fn(() => listChain) })

    await expect(
      listEstimateProductRecords(
        'org-1',
        { status: 'active', family: 'Paint', search: '%super_' },
        { client }
      )
    ).resolves.toEqual({
      ok: true,
      data: [existingRow],
    })

    expect(listChain.eq).toHaveBeenNthCalledWith(1, 'org_id', 'org-1')
    expect(listChain.eq).toHaveBeenNthCalledWith(2, 'status', 'Active')
    expect(listChain.eq).toHaveBeenNthCalledWith(3, 'family', 'Paint')
    expect(listChain.or).toHaveBeenCalledWith(
      'name.ilike.%super%,base.ilike.%super%,subtype.ilike.%super%,notes.ilike.%super%,status.ilike.%super%'
    )
  })

  it('does not add a search clause when sanitizing removes all wildcard-only input', async () => {
    const listChain = createListChain({
      data: [existingRow],
      error: null,
    })
    fromMock.mockReturnValue({ select: vi.fn(() => listChain) })

    await expect(
      listEstimateProductRecords(
        'org-1',
        { status: 'all', family: null, search: '%__,' },
        { client }
      )
    ).resolves.toEqual({
      ok: true,
      data: [existingRow],
    })

    expect(listChain.or).not.toHaveBeenCalled()
    expect(listChain.eq).toHaveBeenCalledWith('org_id', 'org-1')
  })

  it('maps missing scoped rows to a stable not-found service result', async () => {
    fromMock.mockReturnValue({
      select: vi.fn(() =>
        createSelectSingleChain({ data: null, error: { message: 'not found' } })
      ),
    })

    await expect(loadEstimateProductRecord('org-1', existingRow.id, { client })).resolves.toEqual({
      ok: false,
      kind: 'not_found',
      message: 'Product not found',
    })
  })

  it('persists create, update, and delete mutations through the org-scoped table boundary', async () => {
    const insertSpy = vi.fn(() =>
      createInsertChain({
        data: existingRow,
        error: null,
      })
    )
    const updateSpy = vi.fn(() =>
      createUpdateChain({
        data: { ...existingRow, name: 'Super Paint Pro' },
        error: null,
      })
    )
    const deleteSpy = vi.fn(() => createDeleteChain({ error: null }))

    fromMock
      .mockReturnValueOnce({ insert: insertSpy })
      .mockReturnValueOnce({ update: updateSpy })
      .mockReturnValueOnce({ delete: deleteSpy })

    await expect(
      createEstimateProductRecord(
        'org-1',
        {
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
          notes: null,
          status: 'Active',
        },
        { client }
      )
    ).resolves.toEqual({
      ok: true,
      data: existingRow,
    })

    await expect(
      updateEstimateProductRecord(
        'org-1',
        existingRow.id,
        {
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
          notes: null,
          status: 'Active',
        },
        { client }
      )
    ).resolves.toEqual({
      ok: true,
      data: { ...existingRow, name: 'Super Paint Pro' },
    })

    await expect(deleteEstimateProductRecord('org-1', existingRow.id, { client })).resolves.toEqual({
      ok: true,
      data: true,
    })

    expect(insertSpy).toHaveBeenCalledWith([
      expect.objectContaining({
        org_id: 'org-1',
        name: 'Super Paint',
      }),
    ])
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Super Paint Pro',
        updated_at: expect.any(String),
      })
    )
    const deleteChain = deleteSpy.mock.results[0]?.value
    expect(deleteChain.eq).toHaveBeenNthCalledWith(1, 'id', existingRow.id)
    expect(deleteChain.eq).toHaveBeenNthCalledWith(2, 'org_id', 'org-1')
  })
})
