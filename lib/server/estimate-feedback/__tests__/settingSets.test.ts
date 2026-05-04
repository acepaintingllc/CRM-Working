import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/server/org', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}))

import {
  _test,
  activateDraftSettingSet,
  cloneActiveSettingSetAsDraft,
  loadActiveSettingSet,
  loadLatestDraftSettingSet,
  loadEstimateSettingSet,
  settingValuesToEstimateTemplateSettings,
  settingValuesToTemplateRows,
  updateDraftSettingRowValue,
  type EstimatorSettingSetRow,
  type EstimatorSettingValueRow,
} from '../settingSets'

type QueryResult<T> = {
  data: T | null
  error: { message: string } | null
}

function createMaybeSingleChain<T>(result: QueryResult<T>) {
  const chain = {
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    order: vi.fn(),
    limit: vi.fn(),
    select: vi.fn(),
  }
  chain.eq.mockReturnValue(chain)
  chain.order.mockReturnValue(chain)
  chain.limit.mockReturnValue(chain)
  chain.select.mockReturnValue(chain)
  return chain
}

function createCollectionChain<T>(result: QueryResult<T[]>) {
  const promise = Promise.resolve(result)
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

const historicalSet: EstimatorSettingSetRow = {
  id: 'set-historical',
  org_id: 'org-1',
  version_number: 2,
  status: 'retired',
  source_set_id: null,
  created_by: null,
  activated_by: null,
  retired_by: null,
  activated_at: '2026-04-01T00:00:00.000Z',
  retired_at: null,
  notes: '',
  created_at: '2026-04-01T00:00:00.000Z',
  updated_at: '2026-04-01T00:00:00.000Z',
}

const activeSet: EstimatorSettingSetRow = {
  ...historicalSet,
  id: 'set-active',
  version_number: 3,
  status: 'active',
}

const historicalValues: EstimatorSettingValueRow[] = [
  {
    id: 'value-row-1',
    org_id: 'org-1',
    setting_set_id: 'set-historical',
    category_key: 'ceiling_types',
    row_id: 'SMOOTH',
    scalar_key: null,
    display_name: 'Smooth historical',
    active: true,
    sort_order: 1,
    value_json: { id: 'SMOOTH', display_name: 'Smooth historical', primary_value: '1.15' },
  },
  {
    id: 'value-scalar-1',
    org_id: 'org-1',
    setting_set_id: 'set-historical',
    category_key: 'scalar_defaults',
    row_id: null,
    scalar_key: 'override_labor_rate',
    display_name: 'Override Labor Rate',
    active: true,
    sort_order: 2,
    value_json: { value: 88 },
  },
]

describe('estimator setting sets', () => {
  afterEach(() => {
    _test.setSettingSetsSupabaseAdminProvider(null)
  })

  it('loads an estimate historical setting set before the active set', async () => {
    const setById = createMaybeSingleChain({ data: historicalSet, error: null })
    const values = createCollectionChain({ data: historicalValues, error: null })
    const active = createMaybeSingleChain({ data: activeSet, error: null })

    const from = vi.fn((table: string) => {
      if (table === 'estimates') {
        return createMaybeSingleChain({
          data: { id: 'estimate-1', setting_set_id_used: 'set-historical' },
          error: null,
        })
      }
      if (table === 'estimator_setting_set') {
        return setById
      }
      if (table === 'estimator_setting_value') {
        return values
      }
      throw new Error(`Unexpected table ${table}`)
    })
    _test.setSettingSetsSupabaseAdminProvider(async () => ({ from }))

    const snapshot = await loadEstimateSettingSet({
      orgId: 'org-1',
      estimateId: 'estimate-1',
    })

    expect(snapshot?.set.id).toBe('set-historical')
    expect(active.maybeSingle).not.toHaveBeenCalled()
    expect(settingValuesToTemplateRows(snapshot!).map((row) => row.active)).toEqual(['Y'])
    expect(settingValuesToEstimateTemplateSettings(snapshot!).override_labor_rate).toBe(88)
  })

  it('falls back to the active setting set for legacy estimates', async () => {
    const active = createMaybeSingleChain({ data: activeSet, error: null })
    const values = createCollectionChain({ data: [], error: null })
    const from = vi.fn((table: string) => {
      if (table === 'estimates') {
        return createMaybeSingleChain({
          data: { id: 'estimate-legacy', setting_set_id_used: null },
          error: null,
        })
      }
      if (table === 'estimator_setting_set') {
        return active
      }
      if (table === 'estimator_setting_value') {
        return values
      }
      throw new Error(`Unexpected table ${table}`)
    })
    _test.setSettingSetsSupabaseAdminProvider(async () => ({ from }))

    const snapshot = await loadEstimateSettingSet({
      orgId: 'org-1',
      estimateId: 'estimate-legacy',
    })

    expect(snapshot?.set.id).toBe('set-active')
  })

  it('clones active values into a draft, mutates the draft, activates it, and leaves historical estimates unchanged', async () => {
    const state = {
      sets: [
        {
          ...activeSet,
          id: 'set-active',
          version_number: 3,
          status: 'active' as const,
        },
      ] as EstimatorSettingSetRow[],
      values: [
        {
          id: 'value-active-wall',
          org_id: 'org-1',
          setting_set_id: 'set-active',
          category_key: 'production_rates_walls',
          row_id: 'WALL_STD',
          scalar_key: null,
          display_name: 'Active walls',
          active: true,
          sort_order: 0,
          value_json: {
            id: 'WALL_STD',
            display_name: 'Active walls',
            sqft_per_hr: '120',
          },
        },
      ] as EstimatorSettingValueRow[],
      estimates: [
        {
          id: 'estimate-old',
          org_id: 'org-1',
          setting_set_id_used: 'set-active',
        },
      ],
      logs: [] as Record<string, unknown>[],
      nextSet: 1,
      nextValue: 1,
    }

    function rowsFor(table: string) {
      if (table === 'estimator_setting_set') return state.sets
      if (table === 'estimator_setting_value') return state.values
      if (table === 'estimates') return state.estimates
      if (table === 'setting_change_log') return state.logs
      throw new Error(`Unexpected table ${table}`)
    }

    function createQuery(table: string) {
      const filters: Array<[string, unknown]> = []
      let limitCount: number | null = null
      let inserted: unknown = null
      let updated: Record<string, unknown> | null = null

      function filteredRows() {
        let rows = [...rowsFor(table)]
        for (const [key, value] of filters) {
          rows = rows.filter((row) => Reflect.get(row, key) === value)
        }
        rows.sort((a, b) => {
          const av = Number(Reflect.get(a, 'version_number') ?? Reflect.get(a, 'sort_order') ?? 0)
          const bv = Number(Reflect.get(b, 'version_number') ?? Reflect.get(b, 'sort_order') ?? 0)
          return bv - av
        })
        return limitCount == null ? rows : rows.slice(0, limitCount)
      }

      function applyInsert() {
        const payloads = Array.isArray(inserted) ? inserted : [inserted]
        const target = rowsFor(table)
        const created = payloads.map((payload) => {
          const row = { ...(payload as Record<string, unknown>) }
          if (!row.id) {
            row.id =
              table === 'estimator_setting_set'
                ? `set-draft-${state.nextSet++}`
                : `value-draft-${state.nextValue++}`
          }
          if (table === 'estimator_setting_set') {
            row.created_at ??= '2026-05-01T00:00:00.000Z'
            row.updated_at ??= '2026-05-01T00:00:00.000Z'
            row.activated_at ??= null
            row.retired_at ??= null
            row.activated_by ??= null
            row.retired_by ??= null
          }
          ;(target as Record<string, unknown>[]).push(row)
          return row
        })
        return created
      }

      function execute() {
        if (inserted !== null) return { data: applyInsert(), error: null }
        if (updated) {
          for (const row of filteredRows()) {
            Object.assign(row, updated)
          }
          return { data: null, error: null }
        }
        return { data: filteredRows(), error: null }
      }

      const query = {
        select: vi.fn(() => query),
        eq: vi.fn((key: string, value: unknown) => {
          filters.push([key, value])
          return query
        }),
        order: vi.fn(() => query),
        limit: vi.fn((count: number) => {
          limitCount = count
          return query
        }),
        maybeSingle: vi.fn(async () => {
          const result = execute()
          return { data: Array.isArray(result.data) ? result.data[0] ?? null : result.data, error: null }
        }),
        single: vi.fn(async () => {
          const result = execute()
          return { data: Array.isArray(result.data) ? result.data[0] ?? null : result.data, error: null }
        }),
        insert: vi.fn((payload: unknown) => {
          inserted = payload
          return query
        }),
        update: vi.fn((payload: Record<string, unknown>) => {
          updated = payload
          return query
        }),
        then: (resolve: (value: { data: unknown; error: null }) => unknown) => resolve(execute()),
      }
      return query
    }

    _test.setSettingSetsSupabaseAdminProvider(async () => ({
      from: (table: string) => createQuery(table),
      rpc: vi.fn(async (name: string, payload: Record<string, unknown>) => {
        if (name !== 'activate_estimator_setting_set') {
          return { data: null, error: { message: `Unexpected rpc ${name}` } }
        }
        const orgId = String(payload.p_org_id)
        const settingSetId = String(payload.p_setting_set_id)
        const actorId = String(payload.p_actor_id)
        const draft = state.sets.find(
          (set) => set.org_id === orgId && set.id === settingSetId
        )
        if (!draft) return { data: null, error: { message: 'Setting set not found.' } }
        if (draft.status !== 'draft') {
          return {
            data: null,
            error: { message: 'Only draft setting sets can be activated.' },
          }
        }
        const active = state.sets.find(
          (set) => set.org_id === orgId && set.status === 'active'
        )
        if (active) {
          active.status = 'retired'
          active.retired_by = actorId
          active.retired_at = '2026-05-01T00:00:00.000Z'
        }
        draft.status = 'active'
        draft.activated_by = actorId
        draft.activated_at = '2026-05-01T00:00:00.000Z'
        state.logs.push({
          org_id: orgId,
          previous_setting_set_id: active?.id ?? null,
          new_setting_set_id: settingSetId,
          target_key: 'setting_set.activation',
          source: payload.p_source,
          reason: payload.p_reason,
          actor_id: actorId,
        })
        return { data: draft, error: null }
      }),
    }))

    const draft = await cloneActiveSettingSetAsDraft({
      orgId: 'org-1',
      userId: 'user-1',
      notes: 'Rates draft',
    })

    expect(draft?.set.status).toBe('draft')
    expect(draft?.set.source_set_id).toBe('set-active')
    expect(draft?.values[0]?.value_json).toMatchObject({ sqft_per_hr: '120' })

    await updateDraftSettingRowValue({
      orgId: 'org-1',
      settingSetId: draft!.set.id,
      categoryKey: 'production_rates_walls',
      originalRowId: 'WALL_STD',
      rowId: 'WALL_STD',
      displayName: 'Draft walls',
      active: true,
      sortOrder: 0,
      valueJson: {
        id: 'WALL_STD',
        display_name: 'Draft walls',
        sqft_per_hr: '155',
      },
    })

    const stillActive = await loadActiveSettingSet({ orgId: 'org-1' })
    expect(stillActive?.values[0]?.display_name).toBe('Active walls')
    expect(stillActive?.values[0]?.value_json).toMatchObject({ sqft_per_hr: '120' })

    await activateDraftSettingSet({
      orgId: 'org-1',
      settingSetId: draft!.set.id,
      userId: 'user-1',
      reason: 'publish test',
      source: 'rates_flags_admin',
    })

    const nextActive = await loadActiveSettingSet({ orgId: 'org-1' })
    expect(nextActive?.set.id).toBe(draft?.set.id)
    expect(nextActive?.values[0]?.display_name).toBe('Draft walls')
    expect(await loadLatestDraftSettingSet({ orgId: 'org-1' })).toBeNull()
    expect(state.logs).toEqual([
      expect.objectContaining({
        previous_setting_set_id: 'set-active',
        new_setting_set_id: draft?.set.id,
        target_key: 'setting_set.activation',
      }),
    ])

    const historical = await loadEstimateSettingSet({
      orgId: 'org-1',
      estimateId: 'estimate-old',
    })
    expect(historical?.set.id).toBe('set-active')
    expect(settingValuesToTemplateRows(historical!).map((row) => row.display_name)).toEqual([
      'Active walls',
    ])
  })
})
