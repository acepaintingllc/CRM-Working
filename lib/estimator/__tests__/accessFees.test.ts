import assert from 'node:assert/strict'
import test from 'node:test'
import {
  allocateAccessFeesByEligibleScope,
  calculateAccessFeeRows,
  hasCrownTrimAccessEligibility,
} from '../accessFees.ts'
import type { EstimateV2AccessFeeOption } from '@/types/estimator/v2Catalogs'

const ladderAccessFee: EstimateV2AccessFeeOption = {
  id: 'LADDER',
  label: 'Ladder',
  access_group: 'ladders',
  fee_type: null,
  amount: 50,
  unit: null,
  notes: null,
}

function accessFeeDraft(overrides: Partial<{
  id: string
  roomId: string
  accessFeeId: string
  qty: string
  actualCostOverride: string
  notes: string
  position: number
}> = {}) {
  return {
    id: 'draft-1',
    roomId: 'ROOM-1',
    accessFeeId: 'ladder',
    qty: '1',
    actualCostOverride: '',
    notes: '',
    position: 0,
    ...overrides,
  }
}

test('calculateAccessFeeRows uses catalog amount times quantity', () => {
  const result = calculateAccessFeeRows({
    drafts: [accessFeeDraft({ accessFeeId: ' ladder ', qty: '3' })],
    catalog: [ladderAccessFee],
  })

  assert.equal(result.total, 150)
  assert.equal(result.rows[0].accessFeeId, 'LADDER')
  assert.equal(result.rows[0].label, 'Ladder')
  assert.equal(result.rows[0].group, 'ladders')
  assert.equal(result.rows[0].quantity, 3)
  assert.equal(result.rows[0].total, 150)
  assert.equal(result.rows[0].overridden, false)
})

test('calculateAccessFeeRows lets actual cost override replace computed total', () => {
  const result = calculateAccessFeeRows({
    drafts: [accessFeeDraft({
      accessFeeId: 'scaffold',
      qty: '3',
      actualCostOverride: '425',
    })],
    catalog: [{
      id: 'SCAFFOLD',
      label: 'Scaffold',
      access_group: 'scaffolding',
      fee_type: null,
      amount: 50,
      unit: null,
      notes: null,
    }],
  })

  assert.equal(result.total, 425)
  assert.equal(result.rows[0].total, 425)
  assert.equal(result.rows[0].overridden, true)
})

test('calculateAccessFeeRows ignores whitespace-only actual cost override', () => {
  const result = calculateAccessFeeRows({
    drafts: [accessFeeDraft({
      accessFeeId: 'ladder',
      qty: '2',
      actualCostOverride: '   ',
    })],
    catalog: [ladderAccessFee],
  })

  assert.equal(result.total, 100)
  assert.equal(result.rows[0].calculatedTotal, 100)
  assert.equal(result.rows[0].total, 100)
  assert.equal(result.rows[0].overridden, false)
})

test('calculateAccessFeeRows ignores drafts with blank access fee ids', () => {
  const result = calculateAccessFeeRows({
    drafts: [accessFeeDraft({ accessFeeId: '   ', qty: '3' })],
    catalog: [ladderAccessFee],
  })

  assert.deepEqual(result.rows, [])
  assert.equal(result.total, 0)
})

test('calculateAccessFeeRows preserves explicit zero quantity but defaults invalid or negative quantities to one', () => {
  const result = calculateAccessFeeRows({
    drafts: [
      accessFeeDraft({ id: 'blank-qty', qty: '' }),
      accessFeeDraft({ id: 'zero-qty', qty: '0' }),
      accessFeeDraft({ id: 'negative-qty', qty: '-4' }),
      accessFeeDraft({ id: 'text-qty', qty: 'many' }),
    ],
    catalog: [ladderAccessFee],
  })

  assert.deepEqual(result.rows.map((row) => row.quantity), [1, 0, 1, 1])
  assert.deepEqual(result.rows.map((row) => row.total), [50, 0, 50, 50])
  assert.equal(result.total, 150)
})

test('calculateAccessFeeRows rounds row and aggregate totals to two decimals', () => {
  const result = calculateAccessFeeRows({
    drafts: [
      accessFeeDraft({ id: 'first', qty: '3' }),
      accessFeeDraft({ id: 'second', qty: '2' }),
    ],
    catalog: [{ ...ladderAccessFee, amount: 10.005 }],
  })

  assert.deepEqual(result.rows.map((row) => row.calculatedTotal), [30.02, 20.01])
  assert.deepEqual(result.rows.map((row) => row.total), [30.02, 20.01])
  assert.equal(result.total, 50.03)
})

test('hasCrownTrimAccessEligibility only returns true for included crown trim', () => {
  const activeCrown = {
    id: 'trim-1',
    roomId: 'ROOM-1',
    position: 0,
    include: 'Y' as const,
    scopeName: '',
    trimTypeId: 'crown-molding',
    trimFamily: '',
    unitType: 'LF' as const,
    measurementMode: 'MANUAL' as const,
    helperSource: '' as const,
    measurementValue: '',
    helperValue: '',
    baseboardOpeningCount: '',
    colorId: '',
    paintProductId: '',
    primerProductId: '',
    paintEnabled: 'Y' as const,
    primeMode: 'NONE' as const,
    spotPrimePercent: '',
    productionRateId: '',
    prepFactor: '',
    heightFactor: '',
    profileFactor: '',
    roomFlagFactor: '',
    maskingFactor: '',
    stairFactor: '',
    difficultFinishFactor: '',
    caulkFillFactor: '',
    paintCoats: '',
    primerCoats: '',
    overrideMeasurement: '',
    overrideHours: '',
    overrideGallons: '',
    overrideSupplyCost: '',
    overrideTotal: '',
    overrideDescription: '',
    notes: '',
  }
  const activeBase = { ...activeCrown, id: 'trim-2', trimTypeId: 'base', trimFamily: 'base' }
  const inactiveCrown = { ...activeCrown, id: 'trim-3', include: 'N' as const }
  const activeCrownFamily = { ...activeCrown, id: 'trim-4', trimTypeId: 'chair-rail', trimFamily: 'CROWN' }
  const activeMixedCaseCrown = { ...activeCrown, id: 'trim-5', trimTypeId: 'CrOwN-molding' }

  assert.equal(hasCrownTrimAccessEligibility([activeCrown]), true)
  assert.equal(hasCrownTrimAccessEligibility([activeCrownFamily]), true)
  assert.equal(hasCrownTrimAccessEligibility([activeMixedCaseCrown]), true)
  assert.equal(hasCrownTrimAccessEligibility([activeBase]), false)
  assert.equal(hasCrownTrimAccessEligibility([inactiveCrown]), false)
})

test('allocateAccessFeesByEligibleScope allocates proportionally by eligible subtotal', () => {
  const result = allocateAccessFeesByEligibleScope({
    accessFeeTotal: 500,
    scopes: [
      { key: 'walls', eligible: true, preAccessSubtotal: 3000 },
      { key: 'ceilings', eligible: true, preAccessSubtotal: 1000 },
      { key: 'trim', eligible: true, preAccessSubtotal: 1000 },
    ],
  })

  assert.deepEqual(result.allocations, { walls: 300, ceilings: 100, trim: 100, doors: 0, drywall: 0, other: 0 })
  assert.equal(result.unallocated, 0)
  assert.equal(result.warning, null)
})

test('allocateAccessFeesByEligibleScope aggregates duplicate scope keys before allocation', () => {
  const result = allocateAccessFeesByEligibleScope({
    accessFeeTotal: 300,
    scopes: [
      { key: 'walls', eligible: true, preAccessSubtotal: 1000 },
      { key: 'walls', eligible: true, preAccessSubtotal: 2000 },
      { key: 'ceilings', eligible: true, preAccessSubtotal: 1000 },
      { key: 'trim', eligible: false, preAccessSubtotal: 1000 },
    ],
  })

  assert.deepEqual(result.allocations, { walls: 225, ceilings: 75, trim: 0, doors: 0, drywall: 0, other: 0 })
  assert.equal(
    Object.values(result.allocations).reduce((sum, allocation) => sum + allocation, 0),
    300,
  )
  assert.equal(result.unallocated, 0)
  assert.equal(result.warning, null)
})

test('allocateAccessFeesByEligibleScope assigns remainder to last eligible scope', () => {
  const result = allocateAccessFeesByEligibleScope({
    accessFeeTotal: 100,
    scopes: [
      { key: 'walls', eligible: true, preAccessSubtotal: 1 },
      { key: 'ceilings', eligible: true, preAccessSubtotal: 1 },
      { key: 'trim', eligible: true, preAccessSubtotal: 1 },
    ],
  })

  assert.deepEqual(result.allocations, { walls: 33.33, ceilings: 33.33, trim: 33.34, doors: 0, drywall: 0, other: 0 })
  assert.equal(result.unallocated, 0)
  assert.equal(result.warning, null)
})

test('allocateAccessFeesByEligibleScope leaves access fees unallocated when no eligible base exists', () => {
  const result = allocateAccessFeesByEligibleScope({
    accessFeeTotal: 125,
    scopes: [
      { key: 'walls', eligible: false, preAccessSubtotal: 3000 },
      { key: 'ceilings', eligible: true, preAccessSubtotal: 0 },
      { key: 'trim', eligible: false, preAccessSubtotal: 0 },
    ],
  })

  assert.deepEqual(result.allocations, { walls: 0, ceilings: 0, trim: 0, doors: 0, drywall: 0, other: 0 })
  assert.equal(result.unallocated, 125)
  assert.equal(
    result.warning,
    'Access fees are present but no eligible active scope subtotal exists for allocation.',
  )
})

test('allocateAccessFeesByEligibleScope allocates door-only jobs with positive subtotals', () => {
  const result = allocateAccessFeesByEligibleScope({
    accessFeeTotal: 125,
    scopes: [
      { key: 'doors', eligible: true, preAccessSubtotal: 500 },
    ],
  })

  assert.deepEqual(result.allocations, { walls: 0, ceilings: 0, trim: 0, doors: 125, drywall: 0, other: 0 })
  assert.equal(result.unallocated, 0)
  assert.equal(result.warning, null)
})

test('allocateAccessFeesByEligibleScope allocates drywall-only jobs with positive subtotals', () => {
  const result = allocateAccessFeesByEligibleScope({
    accessFeeTotal: 125,
    scopes: [
      { key: 'drywall', eligible: true, preAccessSubtotal: 500 },
    ],
  })

  assert.deepEqual(result.allocations, { walls: 0, ceilings: 0, trim: 0, doors: 0, drywall: 125, other: 0 })
  assert.equal(result.unallocated, 0)
  assert.equal(result.warning, null)
})

test('allocateAccessFeesByEligibleScope allocates other-only jobs when the item is billable', () => {
  const result = allocateAccessFeesByEligibleScope({
    accessFeeTotal: 125,
    scopes: [
      { key: 'other', eligible: true, preAccessSubtotal: 500 },
    ],
  })

  assert.deepEqual(result.allocations, { walls: 0, ceilings: 0, trim: 0, doors: 0, drywall: 0, other: 125 })
  assert.equal(result.unallocated, 0)
  assert.equal(result.warning, null)
})

test('allocateAccessFeesByEligibleScope leaves all-excluded or zero-subtotal scopes unallocated with a warning', () => {
  const result = allocateAccessFeesByEligibleScope({
    accessFeeTotal: 125,
    scopes: [
      { key: 'walls', eligible: false, preAccessSubtotal: 300 },
      { key: 'ceilings', eligible: true, preAccessSubtotal: 0 },
      { key: 'trim', eligible: false, preAccessSubtotal: 300 },
      { key: 'doors', eligible: false, preAccessSubtotal: 300 },
      { key: 'drywall', eligible: true, preAccessSubtotal: 0 },
      { key: 'other', eligible: false, preAccessSubtotal: 300 },
    ],
  })

  assert.deepEqual(result.allocations, { walls: 0, ceilings: 0, trim: 0, doors: 0, drywall: 0, other: 0 })
  assert.equal(result.unallocated, 125)
  assert.equal(
    result.warning,
    'Access fees are present but no eligible active scope subtotal exists for allocation.',
  )
})

test('allocateAccessFeesByEligibleScope allocates mixed billable scopes proportionally and sums to access fee total', () => {
  const result = allocateAccessFeesByEligibleScope({
    accessFeeTotal: 123.45,
    scopes: [
      { key: 'walls', eligible: true, preAccessSubtotal: 300 },
      { key: 'ceilings', eligible: true, preAccessSubtotal: 100 },
      { key: 'trim', eligible: true, preAccessSubtotal: 100 },
      { key: 'doors', eligible: true, preAccessSubtotal: 200 },
      { key: 'drywall', eligible: true, preAccessSubtotal: 200 },
      { key: 'other', eligible: true, preAccessSubtotal: 100 },
    ],
  })

  assert.deepEqual(result.allocations, {
    walls: 37.03,
    ceilings: 12.35,
    trim: 12.35,
    doors: 24.69,
    drywall: 24.69,
    other: 12.34,
  })
  assert.equal(
    Object.values(result.allocations).reduce((sum, allocation) => Math.round((sum + allocation) * 100) / 100, 0),
    123.45,
  )
  assert.equal(result.unallocated, 0)
  assert.equal(result.warning, null)
})

test('allocateAccessFeesByEligibleScope returns zero allocations for non-positive access fee totals', () => {
  for (const accessFeeTotal of [0, -25]) {
    const result = allocateAccessFeesByEligibleScope({
      accessFeeTotal,
      scopes: [
        { key: 'walls', eligible: true, preAccessSubtotal: 3000 },
        { key: 'ceilings', eligible: true, preAccessSubtotal: 1000 },
        { key: 'trim', eligible: true, preAccessSubtotal: 1000 },
      ],
    })

    assert.deepEqual(result.allocations, { walls: 0, ceilings: 0, trim: 0, doors: 0, drywall: 0, other: 0 })
    assert.equal(result.unallocated, 0)
    assert.equal(result.warning, null)
  }
})
