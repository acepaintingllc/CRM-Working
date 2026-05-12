import assert from 'node:assert/strict'
import test from 'node:test'
import {
  _test,
  parseRatesFlagsBatchPublishRequest,
  publishRatesFlagsBatch,
  readRatesFlagsPayload,
} from '../rates-flags/index.ts'
import type {
  EstimatorSettingSetRow,
  EstimatorSettingValueRow,
} from '../estimate-feedback/settingSets.ts'

type MutableEstimateRow = {
  id: string
  org_id: string
  version_state: string
  setting_set_id_used: string | null
  accepted_at?: string | null
  accepted_public_version_id?: string | null
  updated_at?: string | null
}

type MutableState = {
  sets: EstimatorSettingSetRow[]
  values: EstimatorSettingValueRow[]
  estimates: MutableEstimateRow[]
  logs: Record<string, unknown>[]
  nextSet: number
  nextValue: number
}

const baseTimestamp = '2026-05-01T00:00:00.000Z'

function activeSet(overrides: Partial<EstimatorSettingSetRow> = {}): EstimatorSettingSetRow {
  return {
    id: 'set-active',
    org_id: 'org-1',
    version_number: 1,
    status: 'active',
    source_set_id: null,
    created_by: null,
    activated_by: 'user-seed',
    retired_by: null,
    activated_at: baseTimestamp,
    retired_at: null,
    notes: '',
    created_at: baseTimestamp,
    updated_at: baseTimestamp,
    ...overrides,
  }
}

function activeValues(): EstimatorSettingValueRow[] {
  return [
    {
      id: 'value-wall',
      org_id: 'org-1',
      setting_set_id: 'set-active',
      category_key: 'production_rates_walls',
      row_id: 'WALL_STD',
      scalar_key: null,
      display_name: 'Walls Standard',
      active: true,
      sort_order: 0,
      value_json: {
        id: 'WALL_STD',
        production_scope: 'walls',
        scope_id: 'WALLS',
        display_name: 'Walls Standard',
        surface_type: 'Drywall',
        condition: 'Std',
        prep_sqft_per_hr: '95',
        sqft_per_hr: '120',
        primer_sqft_per_hr: '110',
        notes: '',
      },
    },
    {
      id: 'value-ladder',
      org_id: 'org-1',
      setting_set_id: 'set-active',
      category_key: 'access_fees_ladders',
      row_id: 'LADDER',
      scalar_key: null,
      display_name: 'Ladder',
      active: true,
      sort_order: 1,
      value_json: {
        access_group: 'ladders',
        id: 'LADDER',
        display_name: 'Ladder',
        fee_type: 'Labor',
        amount: '100',
        unit: 'once',
        notes: '',
      },
    },
  ]
}

function createState(): MutableState {
  return {
    sets: [activeSet()],
    values: activeValues(),
    estimates: [
      {
        id: 'draft-estimate',
        org_id: 'org-1',
        version_state: 'draft',
        setting_set_id_used: 'set-active',
      },
      {
        id: 'sent-estimate',
        org_id: 'org-1',
        version_state: 'sent',
        setting_set_id_used: 'set-active',
      },
      {
        id: 'live-estimate',
        org_id: 'org-1',
        version_state: 'live',
        setting_set_id_used: 'set-active',
      },
      {
        id: 'accepted-estimate',
        org_id: 'org-1',
        version_state: 'live',
        accepted_at: baseTimestamp,
        accepted_public_version_id: 'public-version-1',
        setting_set_id_used: 'set-active',
      },
      {
        id: 'archived-estimate',
        org_id: 'org-1',
        version_state: 'archived',
        setting_set_id_used: 'set-active',
      },
      {
        id: 'completed-estimate',
        org_id: 'org-1',
        version_state: 'completed',
        setting_set_id_used: 'set-active',
      },
    ],
    logs: [],
    nextSet: 1,
    nextValue: 1,
  }
}

function rowsFor(state: MutableState, table: string) {
  if (table === 'estimator_setting_set') return state.sets
  if (table === 'estimator_setting_value') return state.values
  if (table === 'estimates') return state.estimates
  if (table === 'setting_change_log') return state.logs
  throw new Error(`Unexpected table ${table}`)
}

function createQuery(state: MutableState, table: string) {
  const filters: Array<[string, unknown]> = []
  let limitCount: number | null = null
  let inserted: unknown = null
  let updated: Record<string, unknown> | null = null

  function filteredRows() {
    let rows = [...rowsFor(state, table)]
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
    const target = rowsFor(state, table) as Record<string, unknown>[]
    const created = payloads.map((payload) => {
      const row = { ...(payload as Record<string, unknown>) }
      if (!row.id) {
        row.id =
          table === 'estimator_setting_set'
            ? `set-draft-${state.nextSet++}`
            : `value-draft-${state.nextValue++}`
      }
      row.created_at ??= baseTimestamp
      row.updated_at ??= baseTimestamp
      row.activated_at ??= null
      row.retired_at ??= null
      row.activated_by ??= null
      row.retired_by ??= null
      target.push(row)
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
    select: () => query,
    eq: (key: string, value: unknown) => {
      filters.push([key, value])
      return query
    },
    order: () => query,
    limit: (count: number) => {
      limitCount = count
      return query
    },
    maybeSingle: async () => {
      const result = execute()
      return {
        data: Array.isArray(result.data) ? result.data[0] ?? null : result.data,
        error: null,
      }
    },
    single: async () => {
      const result = execute()
      return {
        data: Array.isArray(result.data) ? result.data[0] ?? null : result.data,
        error: null,
      }
    },
    insert: (payload: unknown) => {
      inserted = payload
      return query
    },
    update: (payload: Record<string, unknown>) => {
      updated = payload
      return query
    },
    then: (resolve: (value: { data: unknown; error: null }) => unknown) => resolve(execute()),
  }
  return query
}

function installFakeSettingStore(state: MutableState) {
  _test.setSettingSetsSupabaseAdminProvider(async () => ({
    from: (table: string) => createQuery(state, table),
    rpc: async (name: string, payload: Record<string, unknown>) => {
      if (name === 'publish_estimator_rates_flags_batch') {
        const orgId = String(payload.p_org_id)
        const actorId = String(payload.p_actor_id)
        const mutations = payload.p_mutations as Array<Record<string, unknown>>
        const active = state.sets.find((set) => set.org_id === orgId && set.status === 'active')
        if (!active) {
          return { data: null, error: { message: 'No active estimator setting set found.' } }
        }

        const rowIds = new Map<string, Set<string>>()
        for (const value of state.values.filter((value) => value.setting_set_id === active.id)) {
          if (!value.row_id) continue
          const ids = rowIds.get(value.category_key) ?? new Set<string>()
          ids.add(value.row_id)
          rowIds.set(value.category_key, ids)
        }

        for (const mutation of mutations) {
          const category = String(mutation.category)
          const action = String(mutation.action)
          const ids = rowIds.get(category) ?? new Set<string>()
          rowIds.set(category, ids)

          if (action === 'archive' || action === 'reactivate') {
            const rowId = String(mutation.rowId)
            if (!ids.has(rowId)) return { data: null, error: { message: 'Row not found.' } }
            continue
          }

          const values = mutation.values as Record<string, unknown>
          const nextId = String(values.id)
          const originalId = String(mutation.original_id ?? values.id)
          if (action === 'create') {
            if (ids.has(nextId)) {
              return { data: null, error: { message: `Row '${nextId}' already exists.` } }
            }
            ids.add(nextId)
            continue
          }
          if (!ids.has(originalId)) return { data: null, error: { message: 'Row not found.' } }
          if (nextId !== originalId && ids.has(nextId)) {
            return { data: null, error: { message: `Row '${nextId}' already exists.` } }
          }
          ids.delete(originalId)
          ids.add(nextId)
        }

        const nextVersion =
          Math.max(...state.sets.filter((set) => set.org_id === orgId).map((set) => set.version_number)) + 1
        const draft: EstimatorSettingSetRow = {
          ...activeSet({
            id: `set-draft-${state.nextSet++}`,
            org_id: orgId,
            version_number: nextVersion,
            status: 'draft',
            source_set_id: active.id,
            created_by: actorId,
            activated_by: null,
            activated_at: null,
            notes: 'Rates/Flags batch publish',
          }),
        }
        state.sets.push(draft)
        for (const value of state.values.filter((value) => value.setting_set_id === active.id)) {
          state.values.push({
            ...value,
            id: `value-draft-${state.nextValue++}`,
            setting_set_id: draft.id,
          })
        }

        for (const mutation of mutations) {
          const category = String(mutation.category)
          const action = String(mutation.action)
          if (action === 'archive' || action === 'reactivate') {
            const row = state.values.find(
              (value) =>
                value.setting_set_id === draft.id &&
                value.category_key === category &&
                value.row_id === String(mutation.rowId)
            )
            if (row) row.active = action === 'reactivate'
            continue
          }

          const values = mutation.values as Record<string, unknown>
          const nextId = String(values.id)
          const originalId = String(mutation.original_id ?? values.id)
          const activeValue = String(values.active ?? 'N').toUpperCase() === 'Y'
          const valueJson = { ...values }
          delete valueJson.active

          if (action === 'create') {
            state.values.push({
              id: `value-draft-${state.nextValue++}`,
              org_id: orgId,
              setting_set_id: draft.id,
              category_key: category,
              row_id: nextId,
              scalar_key: null,
              display_name: String(values.display_name ?? nextId),
              active: activeValue,
              sort_order:
                Math.max(
                  -1,
                  ...state.values
                    .filter((value) => value.setting_set_id === draft.id && value.category_key === category)
                    .map((value) => value.sort_order)
                ) + 1,
              value_json: valueJson,
            })
            continue
          }

          const row = state.values.find(
            (value) =>
              value.setting_set_id === draft.id &&
              value.category_key === category &&
              value.row_id === originalId
          )
          if (row) {
            row.row_id = nextId
            row.display_name = String(values.display_name ?? nextId)
            row.active = activeValue
            row.value_json = valueJson
          }
        }

        active.status = 'retired'
        active.retired_by = actorId
        active.retired_at = baseTimestamp
        draft.status = 'active'
        draft.activated_by = actorId
        draft.activated_at = baseTimestamp

        let draftEstimatesUpdated = 0
        for (const estimate of state.estimates) {
          if (estimate.org_id !== orgId || estimate.version_state !== 'draft') continue
          if (estimate.setting_set_id_used === draft.id) continue
          estimate.setting_set_id_used = draft.id
          estimate.updated_at = baseTimestamp
          draftEstimatesUpdated += 1
        }

        state.logs.push({
          org_id: orgId,
          previous_setting_set_id: active.id,
          new_setting_set_id: draft.id,
          target_key: 'setting_set.activation',
          source: payload.p_source,
          reason: payload.p_reason,
          actor_id: actorId,
          draft_estimates_updated: draftEstimatesUpdated,
        })

        return {
          data: {
            setting_set_id: draft.id,
            version_number: draft.version_number,
            draft_estimates_updated: draftEstimatesUpdated,
          },
          error: null,
        }
      }

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

      const previousActive = state.sets.find(
        (set) => set.org_id === orgId && set.status === 'active' && set.id !== settingSetId
      )
      if (previousActive) {
        previousActive.status = 'retired'
        previousActive.retired_by = actorId
        previousActive.retired_at = baseTimestamp
      }

      draft.status = 'active'
      draft.activated_by = actorId
      draft.activated_at = baseTimestamp

      let draftEstimatesUpdated = 0
      for (const estimate of state.estimates) {
        if (estimate.org_id !== orgId || estimate.version_state !== 'draft') continue
        if (estimate.setting_set_id_used === settingSetId) continue
        estimate.setting_set_id_used = settingSetId
        estimate.updated_at = baseTimestamp
        draftEstimatesUpdated += 1
      }

      state.logs.push({
        org_id: orgId,
        previous_setting_set_id: previousActive?.id ?? null,
        new_setting_set_id: settingSetId,
        target_key: 'setting_set.activation',
        source: payload.p_source,
        reason: payload.p_reason,
        actor_id: actorId,
        draft_estimates_updated: draftEstimatesUpdated,
      })

      return {
        data: {
          setting_set: draft,
          draft_estimates_updated: draftEstimatesUpdated,
        },
        error: null,
      }
    },
  }))
}

test.afterEach(() => {
  _test.setSettingSetsSupabaseAdminProvider(null)
})

test('rates editor reads active global settings even when an older draft exists', async () => {
  const state = createState()
  state.sets.push(
    activeSet({
      id: 'set-old-draft',
      version_number: 2,
      status: 'draft',
      source_set_id: 'set-active',
      created_by: 'user-1',
      activated_by: null,
      activated_at: null,
      notes: 'Stale draft',
    })
  )
  state.values.push(
    ...activeValues().map((value) => ({
      ...value,
      id: `${value.id}-draft`,
      setting_set_id: 'set-old-draft',
      display_name: value.row_id === 'WALL_STD' ? 'Draft Walls' : value.display_name,
      value_json:
        value.row_id === 'WALL_STD'
          ? { ...value.value_json, display_name: 'Draft Walls' }
          : value.value_json,
    }))
  )
  installFakeSettingStore(state)

  const payload = await readRatesFlagsPayload({
    origin: 'http://localhost',
    orgId: 'org-1',
    userId: 'user-1',
  })

  assert.equal(payload.active_setting_set?.id, 'set-active')
  assert.equal(payload.draft_setting_set, null)
  assert.equal(payload.editing_setting_set?.id, 'set-active')
  const wallCategory = payload.categories.find(
    (category) => category.key === 'production_rates_walls'
  )
  assert.equal(wallCategory?.rows.find((row) => row.id === 'WALL_STD')?.display_name, 'Walls Standard')
})

test('batch publish creates one new active settings version for multiple row changes', async () => {
  const state = createState()
  installFakeSettingStore(state)

  const result = await publishRatesFlagsBatch({
    origin: 'http://localhost',
    orgId: 'org-1',
    userId: 'user-1',
    mutations: [
      {
        category: 'production_rates_walls',
        action: 'update',
        original_id: 'WALL_STD',
        values: {
          production_scope: 'walls',
          id: 'WALL_STD',
          scope_id: 'WALLS',
          display_name: 'Walls Faster',
          surface_type: 'Drywall',
          condition: 'Std',
          prep_sqft_per_hr: '95',
          sqft_per_hr: '150',
          primer_sqft_per_hr: '110',
          notes: '',
          active: 'Y',
        },
      },
      {
        category: 'access_fees_ladders',
        action: 'create',
        values: {
          access_group: 'ladders',
          id: 'TALL_LADDER',
          display_name: 'Tall Ladder',
          fee_type: 'Labor',
          amount: '250',
          unit: 'once',
          notes: '',
          active: 'Y',
        },
      },
    ],
  })

  assert.equal(result.ok, true)
  assert.equal(state.sets.length, 2)
  assert.equal(state.sets.filter((set) => set.status === 'active').length, 1)
  assert.equal(state.sets.filter((set) => set.status === 'retired').length, 1)
  assert.equal(state.sets.find((set) => set.status === 'active')?.version_number, 2)
  assert.equal(state.logs.length, 1)

  const active = state.sets.find((set) => set.status === 'active')
  assert.ok(active)
  const activeValues = state.values.filter((value) => value.setting_set_id === active.id)
  assert.equal(
    activeValues.find((value) => value.row_id === 'WALL_STD')?.display_name,
    'Walls Faster'
  )
  assert.equal(
    activeValues.find((value) => value.row_id === 'TALL_LADDER')?.display_name,
    'Tall Ladder'
  )
  if (result.ok) {
    assert.equal(result.data.setting_set_id, active.id)
    assert.equal(result.data.payload.active_setting_set?.id, active.id)
    assert.equal(result.data.payload.draft_setting_set, null)
    assert.equal(result.data.payload.editing_setting_set?.status, 'active')
  }
})

test('batch publish moves only draft estimates to the newest setting set', async () => {
  const state = createState()
  installFakeSettingStore(state)

  const result = await publishRatesFlagsBatch({
    origin: 'http://localhost',
    orgId: 'org-1',
    userId: 'user-1',
    mutations: [
      {
        category: 'access_fees_ladders',
        action: 'archive',
        rowId: 'LADDER',
      },
    ],
  })

  assert.equal(result.ok, true)
  const active = state.sets.find((set) => set.status === 'active')
  assert.ok(active)

  assert.equal(
    state.estimates.find((estimate) => estimate.id === 'draft-estimate')?.setting_set_id_used,
    active.id
  )
  for (const estimateId of [
    'sent-estimate',
    'live-estimate',
    'accepted-estimate',
    'archived-estimate',
    'completed-estimate',
  ]) {
    assert.equal(
      state.estimates.find((estimate) => estimate.id === estimateId)?.setting_set_id_used,
      'set-active',
      estimateId
    )
  }
})

test('batch validation failure does not clone, mutate, or publish settings', async () => {
  const state = createState()
  installFakeSettingStore(state)

  const result = await publishRatesFlagsBatch({
    origin: 'http://localhost',
    orgId: 'org-1',
    userId: 'user-1',
    mutations: [
      {
        category: 'access_fees_ladders',
        action: 'create',
        values: {
          access_group: 'ladders',
          id: 'LADDER',
          display_name: 'Duplicate Ladder',
          fee_type: 'Labor',
          amount: '125',
          unit: 'once',
          notes: '',
          active: 'Y',
        },
      },
    ],
  })

  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.status, 409)
    assert.match(result.error, /already exists/i)
  }
  assert.equal(state.sets.length, 1)
  assert.equal(state.sets[0].status, 'active')
  assert.equal(state.values.length, 2)
  assert.equal(state.logs.length, 0)
  assert.equal(
    state.estimates.find((estimate) => estimate.id === 'draft-estimate')?.setting_set_id_used,
    'set-active'
  )
})

test('batch publish request parser validates the full mutation list before service work', () => {
  const parsed = parseRatesFlagsBatchPublishRequest({
    mutations: [
      {
        category: 'access_fees_ladders',
        action: 'archive',
        rowId: 'LADDER',
      },
      {
        category: 'access_fees_ladders',
        action: 'create',
        values: {
          access_group: 'ladders',
          id: 'bad-id',
          display_name: 'Broken',
          fee_type: 'Labor',
          amount: '100',
          unit: 'once',
          notes: '',
          active: 'Y',
        },
      },
    ],
  })

  assert.equal(parsed.ok, false)
  if (!parsed.ok) {
    assert.match(parsed.error, /Mutation 2/i)
    assert.match(parsed.error, /uppercase snake-case/i)
  }
})
