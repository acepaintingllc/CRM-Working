import assert from 'node:assert/strict'
import test from 'node:test'
import {
  emptyQuoteDefaults,
  parseQuoteDefaults,
  validateQuoteDefaults,
  type QuoteDefaultsProductReference,
} from '../defaultsForm.ts'

const products: QuoteDefaultsProductReference[] = [
  { id: 'paint-1', name: 'Active Paint', family: 'Paint', status: 'Active' },
  { id: 'primer-1', name: 'Active Primer', family: 'Primer', status: 'Active' },
  { id: 'paint-inactive', name: 'Inactive Paint', family: 'Paint', status: 'Inactive' },
  { id: 'paint-archived', name: 'Archived Paint', family: 'Paint', status: 'Archived' },
]

test('validateQuoteDefaults accepts active products with matching families', () => {
  const result = validateQuoteDefaults(
    {
      ...emptyQuoteDefaults,
      walls_paint_id: 'paint-1',
      walls_primer_id: 'primer-1',
      override_labor_rate: 10000,
    },
    { products }
  )

  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.value.walls_paint_id, 'paint-1')
    assert.equal(result.value.walls_primer_id, 'primer-1')
  }
})

test('validateQuoteDefaults rejects inactive and archived product defaults', () => {
  const inactive = validateQuoteDefaults(
    {
      ...emptyQuoteDefaults,
      walls_paint_id: 'paint-inactive',
    },
    { products }
  )
  const archived = validateQuoteDefaults(
    {
      ...emptyQuoteDefaults,
      walls_paint_id: 'paint-archived',
    },
    { products }
  )

  assert.equal(inactive.ok, false)
  assert.equal(archived.ok, false)
  if (!inactive.ok) {
    assert.match(inactive.error, /inactive/i)
    assert.equal(inactive.issues[0]?.code, 'inactive_product')
  }
  if (!archived.ok) {
    assert.match(archived.error, /archived/i)
    assert.equal(archived.issues[0]?.code, 'inactive_product')
  }
})

test('validateQuoteDefaults rejects missing and wrong-family product defaults', () => {
  const missing = validateQuoteDefaults(
    {
      ...emptyQuoteDefaults,
      walls_paint_id: 'deleted-paint',
    },
    { products }
  )
  const wrongFamily = validateQuoteDefaults(
    {
      ...emptyQuoteDefaults,
      walls_paint_id: 'primer-1',
    },
    { products }
  )

  assert.equal(missing.ok, false)
  assert.equal(wrongFamily.ok, false)
  if (!missing.ok) {
    assert.match(missing.error, /no longer exists/)
    assert.equal(missing.issues[0]?.code, 'missing_product')
  }
  if (!wrongFamily.ok) {
    assert.match(wrongFamily.error, /must use a paint product/)
    assert.equal(wrongFamily.issues[0]?.code, 'wrong_product_family')
  }
})

test('parseQuoteDefaults enforces the shared labor-rate range', () => {
  assert.deepEqual(
    parseQuoteDefaults({
      ...emptyQuoteDefaults,
      override_labor_rate: -1,
    }),
    {
      ok: false,
      error: 'Labor rate must be between 0 and 10000.',
      fields: {
        override_labor_rate: 'Labor rate must be between 0 and 10000.',
      },
      issues: [
        {
          code: 'invalid_labor_rate',
          field: 'override_labor_rate',
          message: 'Labor rate must be between 0 and 10000.',
        },
      ],
    }
  )

  assert.equal(
    parseQuoteDefaults({
      ...emptyQuoteDefaults,
      override_labor_rate: 10001,
    }).ok,
    false
  )
})
