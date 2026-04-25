import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildQuoteDefaultsFormState,
  emptyQuoteDefaults,
  formatQuoteDefaultsProductOptionLabel,
  parseQuoteDefaults,
  quoteDefaultsFormSections,
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

test('buildQuoteDefaultsFormState derives product options from active matching products', () => {
  const state = buildQuoteDefaultsFormState(emptyQuoteDefaults, { products })

  assert.deepEqual(state.productDefaultFields[0]?.options, [
    { id: 'paint-1', name: 'Active Paint', family: 'Paint', status: 'Active' },
  ])
  assert.deepEqual(state.productDefaultFields[1]?.options, [
    { id: 'primer-1', name: 'Active Primer', family: 'Primer', status: 'Active' },
  ])
  assert.equal(state.canSave, true)
  assert.deepEqual(state.fieldErrors, {})
})

test('buildQuoteDefaultsFormState keeps inactive and wrong-family selected products visible', () => {
  const state = buildQuoteDefaultsFormState(
    {
      ...emptyQuoteDefaults,
      walls_paint_id: 'paint-inactive',
      walls_primer_id: 'paint-1',
    },
    { products }
  )

  assert.equal(state.canSave, false)
  assert.equal(state.productDefaultFields[0]?.options[0]?.id, 'paint-inactive')
  assert.equal(state.productDefaultFields[1]?.options[0]?.id, 'paint-1')
  assert.match(state.fieldErrors.walls_paint_id ?? '', /inactive/i)
  assert.match(state.fieldErrors.walls_primer_id ?? '', /must use a primer product/)
})

test('buildQuoteDefaultsFormState creates a missing option for deleted selected products', () => {
  const state = buildQuoteDefaultsFormState(
    {
      ...emptyQuoteDefaults,
      walls_paint_id: 'deleted-paint',
    },
    { products }
  )

  assert.equal(state.canSave, false)
  assert.deepEqual(state.productDefaultFields[0]?.options[0], {
    id: 'deleted-paint',
    name: 'Missing product (deleted-paint)',
    family: null,
    status: 'Missing',
    missing: true,
  })
  assert.match(state.fieldErrors.walls_paint_id ?? '', /no longer exists/)
})

test('quote defaults form metadata defines product and labor extension sections', () => {
  assert.deepEqual(
    quoteDefaultsFormSections.map((section) => [section.key, section.kind]),
    [
      ['product_defaults', 'product_defaults'],
      ['labor_rate', 'labor_rate'],
    ]
  )
})

test('formatQuoteDefaultsProductOptionLabel decorates inactive, wrong-family, and missing options', () => {
  assert.equal(
    formatQuoteDefaultsProductOptionLabel(
      { id: 'paint-inactive', name: 'Inactive Paint', family: 'Paint', status: 'Inactive' },
      'Paint'
    ),
    'Inactive Paint (Inactive)'
  )
  assert.equal(
    formatQuoteDefaultsProductOptionLabel(
      { id: 'primer-1', name: 'Primer', family: 'Primer', status: 'Active' },
      'Paint'
    ),
    'Primer (Primer)'
  )
  assert.equal(
    formatQuoteDefaultsProductOptionLabel(
      {
        id: 'deleted-paint',
        name: 'Missing product (deleted-paint)',
        family: null,
        status: 'Missing',
        missing: true,
      },
      'Paint'
    ),
    'Missing product (deleted-paint)'
  )
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
