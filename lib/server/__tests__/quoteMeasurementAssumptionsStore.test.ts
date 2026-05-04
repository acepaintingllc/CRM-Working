import assert from 'node:assert/strict'
import test from 'node:test'
import type { QuoteMeasurementAssumptions } from '../../settings/types.ts'
import type {
  EstimatorSettingSetSnapshot,
  EstimatorSettingValueRow,
} from '../estimate-feedback/settingSets.ts'
import {
  saveQuoteMeasurementAssumptions,
  type QuoteMeasurementAssumptionsStoreDeps,
} from '../settings/quoteMeasurementAssumptionsStore.ts'

const baseAssumptions: QuoteMeasurementAssumptions = {
  standard_door_deduction_sf: 21,
  standard_window_deduction_sf: 15,
  baseboard_opening_deduction_lf: 3,
}

test('saveQuoteMeasurementAssumptions updates scalar defaults through a new active setting set', async () => {
  const fake = createFakeSettingsDeps()

  const saved = await saveQuoteMeasurementAssumptions(
    'org-1',
    {
      standard_door_deduction_sf: 22,
      standard_window_deduction_sf: 16,
      baseboard_opening_deduction_lf: 4,
    },
    'user-1',
    fake.deps
  )

  assert.equal(saved.standard_door_deduction_sf, 22)
  assert.equal(saved.standard_window_deduction_sf, 16)
  assert.equal(saved.baseboard_opening_deduction_lf, 4)
  assert.equal(fake.upserts.length, 1)
  assert.equal(fake.settingSetOps.clonedWith?.userId, 'user-1')
  assert.equal(fake.settingSetOps.activatedWith?.source, 'measurement_assumptions_admin')
  assert.deepEqual(
    fake.settingSetOps.updatedValues.map((value) => [
      value.scalar_key,
      value.value_json,
    ]),
    [
      ['standard_door_deduction_sf', { value: 22 }],
      ['standard_window_deduction_sf', { value: 16 }],
      ['baseboard_opening_deduction_lf', { value: 4 }],
    ]
  )
})

test('saveQuoteMeasurementAssumptions rejects invalid assumptions before setting-set mutation', async () => {
  const fake = createFakeSettingsDeps()

  await assert.rejects(
    () =>
      saveQuoteMeasurementAssumptions(
        'org-1',
        {
          ...baseAssumptions,
          standard_door_deduction_sf: -1,
        },
        fake.deps
      ),
    /Measurement deductions cannot be negative/
  )

  assert.equal(fake.settingSetOps.clonedWith, null)
  assert.equal(fake.upserts.length, 0)
})

function createFakeSettingsDeps() {
  const upserts: Record<string, unknown>[] = []
  const settingSetOps = {
    clonedWith: null as { orgId: string; userId: string; notes?: string } | null,
    updatedValues: [] as Array<{
      category_key: string
      row_id?: string | null
      scalar_key?: string | null
      display_name?: string
      active?: boolean
      sort_order?: number
      value_json: Record<string, unknown>
    }>,
    activatedWith: null as {
      orgId: string
      settingSetId: string
      userId: string
      reason?: string
      source?: string
    } | null,
  }

  const deps: Partial<QuoteMeasurementAssumptionsStoreDeps> = {
    client: {
      from() {
        return createQuery(upserts)
      },
    },
    loadActiveSettingSet: async () => createSettingSetSnapshot('set-active', []),
    cloneActiveSettingSetAsDraft: async (params) => {
      settingSetOps.clonedWith = params
      return createSettingSetSnapshot('set-draft', [])
    },
    updateDraftSettingValues: async (params) => {
      settingSetOps.updatedValues = params.values
      return createSettingSetSnapshot(
        params.settingSetId,
        params.values.map((value, index) => ({
          id: `value-${index}`,
          org_id: params.orgId,
          setting_set_id: params.settingSetId,
          category_key: value.category_key,
          row_id: value.row_id ?? null,
          scalar_key: value.scalar_key ?? null,
          display_name: value.display_name ?? String(value.scalar_key ?? value.row_id),
          active: value.active ?? true,
          sort_order: value.sort_order ?? index,
          value_json: value.value_json,
        }))
      )
    },
    activateDraftSettingSet: async (params) => {
      settingSetOps.activatedWith = params
      return createSettingSetSnapshot(
        params.settingSetId,
        settingSetOps.updatedValues.map((value, index) => ({
          id: `activated-value-${index}`,
          org_id: params.orgId,
          setting_set_id: params.settingSetId,
          category_key: value.category_key,
          row_id: value.row_id ?? null,
          scalar_key: value.scalar_key ?? null,
          display_name: value.display_name ?? String(value.scalar_key ?? value.row_id),
          active: value.active ?? true,
          sort_order: value.sort_order ?? index,
          value_json: value.value_json,
        }))
      )
    },
  }

  return { deps, upserts, settingSetOps }
}

function createQuery(upserts: Record<string, unknown>[]) {
  let upsertPayload: Record<string, unknown> | null = null

  const query = {
    select() {
      return query
    },
    eq() {
      return query
    },
    upsert(payload: Record<string, unknown>) {
      upsertPayload = payload
      return query
    },
    async single() {
      if (!upsertPayload) {
        return { data: null, error: { message: 'Missing upsert payload' } }
      }
      upserts.push(upsertPayload)
      return { data: upsertPayload, error: null }
    },
    async maybeSingle() {
      return { data: null, error: null }
    },
  }

  return query
}

function createSettingSetSnapshot(
  settingSetId: string,
  values: EstimatorSettingValueRow[]
): EstimatorSettingSetSnapshot {
  return {
    set: {
      id: settingSetId,
      org_id: 'org-1',
      version_number: settingSetId === 'set-active' ? 1 : 2,
      status: settingSetId === 'set-active' ? 'active' : 'draft',
      source_set_id: settingSetId === 'set-active' ? null : 'set-active',
      created_by: null,
      activated_by: null,
      retired_by: null,
      activated_at: null,
      retired_at: null,
      notes: '',
      created_at: '2026-05-03T00:00:00.000Z',
      updated_at: '2026-05-03T00:00:00.000Z',
    },
    values,
  }
}
