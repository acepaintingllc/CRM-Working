import assert from 'node:assert/strict'
import test from 'node:test'
import type { QuoteDefaults } from '../../settings/types.ts'
import {
  QuoteDefaultsValidationError,
  saveQuoteDefaults,
  type QuoteDefaultsStoreDeps,
} from '../settings/quoteDefaultsStore.ts'
import type {
  EstimatorSettingSetSnapshot,
  EstimatorSettingValueRow,
} from '../estimate-feedback/settingSets.ts'

type ProductRow = {
  id: string
  name: string
  family: string
  status: string
}

const baseDefaults: QuoteDefaults = {
  walls_paint_id: null,
  walls_primer_id: null,
  ceiling_paint_id: null,
  ceiling_primer_id: null,
  trim_paint_id: null,
  trim_primer_id: null,
  override_labor_rate: 65,
}

test('saveQuoteDefaults saves active product IDs with matching families', async () => {
  const fake = createFakeSettingsClient([
    { id: 'paint-1', name: 'Paint', family: 'Paint', status: 'Active' },
    { id: 'primer-1', name: 'Primer', family: 'Primer', status: 'Active' },
  ])

  const saved = await saveQuoteDefaults(
    'org-1',
    {
      ...baseDefaults,
      walls_paint_id: 'paint-1',
      walls_primer_id: 'primer-1',
    },
    'user-1',
    fake.deps
  )

  assert.equal(saved.walls_paint_id, 'paint-1')
  assert.equal(fake.upserts.length, 1)
  assert.equal(fake.settingSetOps.clonedWith?.userId, 'user-1')
  assert.equal(fake.settingSetOps.activatedWith?.source, 'quote_defaults_admin')
  assert.deepEqual(
    fake.settingSetOps.updatedValues.map((value) => [
      value.scalar_key,
      value.value_json,
    ]),
    [
      ['walls_paint_id', { value: 'paint-1' }],
      ['walls_primer_id', { value: 'primer-1' }],
      ['ceiling_paint_id', { value: null }],
      ['ceiling_primer_id', { value: null }],
      ['trim_paint_id', { value: null }],
      ['trim_primer_id', { value: null }],
      ['override_labor_rate', { value: 65 }],
    ]
  )
})

test('saveQuoteDefaults rejects inactive, archived, missing, and wrong-family product IDs', async () => {
  const cases: Array<{
    name: string
    defaults: QuoteDefaults
    products: ProductRow[]
    message: RegExp
  }> = [
    {
      name: 'inactive',
      defaults: { ...baseDefaults, walls_paint_id: 'paint-inactive' },
      products: [
        { id: 'paint-inactive', name: 'Old Paint', family: 'Paint', status: 'Inactive' },
      ],
      message: /inactive/i,
    },
    {
      name: 'archived',
      defaults: { ...baseDefaults, walls_paint_id: 'paint-archived' },
      products: [
        { id: 'paint-archived', name: 'Archived Paint', family: 'Paint', status: 'Archived' },
      ],
      message: /archived/i,
    },
    {
      name: 'missing',
      defaults: { ...baseDefaults, walls_paint_id: 'deleted-paint' },
      products: [],
      message: /no longer exists/,
    },
    {
      name: 'wrong family',
      defaults: { ...baseDefaults, walls_paint_id: 'primer-1' },
      products: [{ id: 'primer-1', name: 'Primer', family: 'Primer', status: 'Active' }],
      message: /must use a paint product/,
    },
  ]

  for (const scenario of cases) {
    const fake = createFakeSettingsClient(scenario.products)

    await assert.rejects(
      () => saveQuoteDefaults('org-1', scenario.defaults, fake.deps),
      (error: unknown) => {
        assert.equal(error instanceof QuoteDefaultsValidationError, true, scenario.name)
        assert.match((error as Error).message, scenario.message)
        return true
      }
    )
    assert.equal(fake.upserts.length, 0, scenario.name)
  }
})

test('saveQuoteDefaults rejects invalid labor rates before preserving product defaults', async () => {
  const fake = createFakeSettingsClient([
    { id: 'paint-1', name: 'Paint', family: 'Paint', status: 'Active' },
  ])

  await assert.rejects(
    () =>
      saveQuoteDefaults(
        'org-1',
        {
          ...baseDefaults,
          walls_paint_id: 'paint-1',
          override_labor_rate: 10001,
        },
        fake.deps
      ),
    /Labor rate must be between 0 and 10000/
  )
  assert.equal(fake.upserts.length, 0)
})

function createFakeSettingsClient(products: ProductRow[]) {
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
  const draft = createSettingSetSnapshot('set-draft', [])

  const deps: Partial<QuoteDefaultsStoreDeps> = {
    client: {
      from(relation: string) {
        return createQuery(relation, products, upserts)
      },
    },
    loadActiveSettingSet: async () => createSettingSetSnapshot('set-active', []),
    cloneActiveSettingSetAsDraft: async (params) => {
      settingSetOps.clonedWith = params
      return draft
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

function createQuery(
  relation: string,
  products: ProductRow[],
  upserts: Record<string, unknown>[]
) {
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
    async in(_column: string, values: string[]) {
      assert.equal(relation, 'v2_products')
      return {
        data: products.filter((product) => values.includes(product.id)),
        error: null,
      }
    },
  }

  return query
}
