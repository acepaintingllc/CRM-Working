import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  loadActiveSettingSet: vi.fn(),
  loadEstimateSettingSet: vi.fn(),
  loadSettingSetById: vi.fn(),
}))

vi.mock('@/lib/server/org', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

vi.mock('@/lib/server/estimate-feedback/settingSets', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/server/estimate-feedback/settingSets')>()
  return {
    ...actual,
    loadActiveSettingSet: mocks.loadActiveSettingSet,
    loadEstimateSettingSet: mocks.loadEstimateSettingSet,
    loadSettingSetById: mocks.loadSettingSetById,
  }
})

function createProductsQuery() {
  const promise = Promise.resolve({ data: [], error: null })
  const chain = {
    eq: vi.fn(),
    order: vi.fn(),
    select: vi.fn(),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  }
  chain.eq.mockReturnValue(chain)
  chain.order.mockReturnValue(chain)
  chain.select.mockReturnValue(chain)
  return chain
}

function snapshot(id: string, label: string, multiplier: string) {
  return {
    set: {
      id,
      org_id: 'org-1',
      version_number: id === 'active' ? 4 : 2,
      status: id === 'active' ? 'active' : 'retired',
      source_set_id: null,
      created_by: null,
      activated_by: null,
      retired_by: null,
      activated_at: '2026-04-01T00:00:00.000Z',
      retired_at: null,
      notes: '',
      created_at: '2026-04-01T00:00:00.000Z',
      updated_at: '2026-04-01T00:00:00.000Z',
    },
    values: [
      {
        id: `${id}-value`,
        org_id: 'org-1',
        setting_set_id: id,
        category_key: 'ceiling_types',
        row_id: 'SMOOTH',
        scalar_key: null,
        display_name: label,
        active: true,
        sort_order: 0,
        value_json: {
          id: 'SMOOTH',
          display_name: label,
          primary_value: multiplier,
          area_factor: '1',
          secondary_value: '0',
        },
      },
    ],
  }
}

describe('getEstimateCatalogs setting-set resolution', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.from.mockReset()
    mocks.loadActiveSettingSet.mockReset()
    mocks.loadEstimateSettingSet.mockReset()
    mocks.loadSettingSetById.mockReset()
    mocks.from.mockReturnValue(createProductsQuery())
  })

  it('returns historical estimate catalogs instead of the current active set', async () => {
    mocks.loadEstimateSettingSet.mockResolvedValue(snapshot('historical', 'Historical smooth', '1.25'))
    mocks.loadActiveSettingSet.mockResolvedValue(snapshot('active', 'Active smooth', '1.75'))

    const { getEstimateCatalogs } = await import('../../estimateCatalogs')
    const result = await getEstimateCatalogs({
      origin: 'http://localhost',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
    })

    expect(result.catalogs.ceiling_types).toEqual([
      expect.objectContaining({
        id: 'SMOOTH',
        label: 'Historical smooth',
        labor_mult: 1.25,
      }),
    ])
    expect(mocks.loadEstimateSettingSet).toHaveBeenCalledWith({
      orgId: 'org-1',
      estimateId: 'estimate-1',
    })
    expect(mocks.loadActiveSettingSet).not.toHaveBeenCalled()
  })

  it('keeps quote and estimate aliases on the same catalog resolver contract', async () => {
    mocks.loadEstimateSettingSet.mockResolvedValue(snapshot('historical', 'Alias smooth', '1.1'))
    const { getEstimateCatalogs } = await import('../../estimateCatalogs')

    const estimateResult = await getEstimateCatalogs({
      origin: 'http://localhost',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'shared-estimate-id',
    })
    const quoteAliasResult = await getEstimateCatalogs({
      origin: 'http://localhost',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'shared-estimate-id',
    })

    expect(quoteAliasResult).toEqual(estimateResult)
    expect(mocks.loadEstimateSettingSet).toHaveBeenCalledTimes(2)
  })
})
