import assert from 'node:assert/strict'
import test from 'node:test'
import type { QuoteDefaults } from '../../settings/types.ts'
import {
  QuoteDefaultsValidationError,
  saveQuoteDefaults,
  type QuoteDefaultsStoreDeps,
} from '../settings/quoteDefaultsStore.ts'

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
    fake.deps
  )

  assert.equal(saved.walls_paint_id, 'paint-1')
  assert.equal(fake.upserts.length, 1)
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

  const deps: Partial<QuoteDefaultsStoreDeps> = {
    client: {
      from(relation: string) {
        return createQuery(relation, products, upserts)
      },
    },
  }

  return { deps, upserts }
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
