import assert from 'node:assert/strict'
import test from 'node:test'
import { allocateHiddenCustomerFees } from '../hiddenFeeAllocation.ts'

test('allocateHiddenCustomerFees targets same-room visible rows before global rows', () => {
  const result = allocateHiddenCustomerFees({
    rows: [
      {
        id: 'walls-r1',
        key: 'walls',
        roomId: 'R001',
        sourceKind: 'walls',
        preFeePrice: 100,
        included: true,
      },
      {
        id: 'trim-r2',
        key: 'trim',
        roomId: 'R002',
        sourceKind: 'trim',
        preFeePrice: 300,
        included: true,
      },
    ],
    fees: [
      {
        id: 'access-r1',
        kind: 'access_fee',
        roomId: 'R001',
        amount: 75,
      },
    ],
  })

  assert.equal(result.sectionAdjustments.walls, 75)
  assert.equal(result.sectionAdjustments.trim, 0)
  assert.deepEqual(result.allocations, [
    {
      feeId: 'access-r1',
      feeKind: 'access_fee',
      targetRowId: 'walls-r1',
      targetSectionKey: 'walls',
      amount: 75,
    },
  ])
})

test('allocateHiddenCustomerFees distributes job-level fees by visible row price', () => {
  const result = allocateHiddenCustomerFees({
    rows: [
      {
        id: 'walls',
        key: 'walls',
        roomId: 'R001',
        sourceKind: 'walls',
        preFeePrice: 100,
        included: true,
      },
      {
        id: 'trim',
        key: 'trim',
        roomId: 'R002',
        sourceKind: 'trim',
        preFeePrice: 300,
        included: true,
      },
    ],
    fees: [
      {
        id: 'prejob',
        kind: 'prejob_trip',
        roomId: null,
        amount: 100,
      },
    ],
  })

  assert.equal(result.sectionAdjustments.walls, 25)
  assert.equal(result.sectionAdjustments.trim, 75)
  assert.equal(result.fallbackAdditionalWorkAmount, 0)
})

test('allocateHiddenCustomerFees targets same-room drywall rows first for prejob trips', () => {
  const result = allocateHiddenCustomerFees({
    rows: [
      {
        id: 'walls-r1',
        key: 'walls',
        roomId: 'R001',
        sourceKind: 'walls',
        preFeePrice: 400,
        included: true,
      },
      {
        id: 'drywall-r1',
        key: 'drywall',
        roomId: 'R001',
        sourceKind: 'drywall',
        preFeePrice: 100,
        included: true,
      },
      {
        id: 'drywall-r2',
        key: 'drywall',
        roomId: 'R002',
        sourceKind: 'drywall',
        preFeePrice: 500,
        included: true,
      },
    ],
    fees: [
      {
        id: 'prejob-r1',
        kind: 'prejob_trip',
        roomId: 'R001',
        amount: 80,
      },
    ],
  })

  assert.equal(result.sectionAdjustments.walls, 0)
  assert.equal(result.sectionAdjustments.drywall, 80)
  assert.deepEqual(result.allocations, [
    {
      feeId: 'prejob-r1',
      feeKind: 'prejob_trip',
      targetRowId: 'drywall-r1',
      targetSectionKey: 'drywall',
      amount: 80,
    },
  ])
})

test('allocateHiddenCustomerFees falls back to same-room rows for prejob trips without drywall', () => {
  const result = allocateHiddenCustomerFees({
    rows: [
      {
        id: 'walls-r1',
        key: 'walls',
        roomId: 'R001',
        sourceKind: 'walls',
        preFeePrice: 100,
        included: true,
      },
      {
        id: 'trim-r1',
        key: 'trim',
        roomId: 'R001',
        sourceKind: 'trim',
        preFeePrice: 300,
        included: true,
      },
      {
        id: 'walls-r2',
        key: 'walls',
        roomId: 'R002',
        sourceKind: 'walls',
        preFeePrice: 600,
        included: true,
      },
    ],
    fees: [
      {
        id: 'prejob-r1',
        kind: 'prejob_trip',
        roomId: 'R001',
        amount: 100,
      },
    ],
  })

  assert.equal(result.sectionAdjustments.walls, 25)
  assert.equal(result.sectionAdjustments.trim, 75)
  assert.deepEqual(result.allocations.map((allocation) => allocation.targetRowId), [
    'walls-r1',
    'trim-r1',
  ])
})

test('allocateHiddenCustomerFees prefers same-room and preferred-scope rows', () => {
  const result = allocateHiddenCustomerFees({
    rows: [
      {
        id: 'walls-r1',
        key: 'walls',
        roomId: 'R001',
        sourceKind: 'walls',
        preFeePrice: 200,
        included: true,
      },
      {
        id: 'trim-r1',
        key: 'trim',
        roomId: 'R001',
        sourceKind: 'trim',
        preFeePrice: 100,
        included: true,
      },
      {
        id: 'trim-r2',
        key: 'trim',
        roomId: 'R002',
        sourceKind: 'trim',
        preFeePrice: 400,
        included: true,
      },
    ],
    fees: [
      {
        id: 'access-trim-r1',
        kind: 'access_fee',
        roomId: 'R001',
        preferredScopeKey: 'trim',
        amount: 60,
      },
    ],
  })

  assert.equal(result.sectionAdjustments.walls, 0)
  assert.equal(result.sectionAdjustments.trim, 60)
  assert.deepEqual(result.allocations, [
    {
      feeId: 'access-trim-r1',
      feeKind: 'access_fee',
      targetRowId: 'trim-r1',
      targetSectionKey: 'trim',
      amount: 60,
    },
  ])
})

test('allocateHiddenCustomerFees is deterministic regardless of input row order', () => {
  const rows = [
    {
      id: 'trim-b',
      key: 'trim' as const,
      roomId: 'B',
      sourceKind: 'trim' as const,
      preFeePrice: 100,
      included: true,
    },
    {
      id: 'walls-a',
      key: 'walls' as const,
      roomId: 'A',
      sourceKind: 'walls' as const,
      preFeePrice: 100,
      included: true,
    },
    {
      id: 'ceilings-a',
      key: 'ceilings' as const,
      roomId: 'A',
      sourceKind: 'ceilings' as const,
      preFeePrice: 100,
      included: true,
    },
  ]
  const fees = [
    {
      id: 'rounding-sensitive-fee',
      kind: 'internal_manual_adjustment' as const,
      roomId: null,
      amount: 0.05,
    },
  ]

  const first = allocateHiddenCustomerFees({ rows, fees })
  const second = allocateHiddenCustomerFees({ rows: [...rows].reverse(), fees })

  assert.deepEqual(second, first)
  assert.deepEqual(first.allocations, [
    {
      feeId: 'rounding-sensitive-fee',
      feeKind: 'internal_manual_adjustment',
      targetRowId: 'walls-a',
      targetSectionKey: 'walls',
      amount: 0.02,
    },
    {
      feeId: 'rounding-sensitive-fee',
      feeKind: 'internal_manual_adjustment',
      targetRowId: 'ceilings-a',
      targetSectionKey: 'ceilings',
      amount: 0.02,
    },
    {
      feeId: 'rounding-sensitive-fee',
      feeKind: 'internal_manual_adjustment',
      targetRowId: 'trim-b',
      targetSectionKey: 'trim',
      amount: 0.01,
    },
  ])
})

test('allocateHiddenCustomerFees falls back to generic additional work when there are no visible rows', () => {
  const result = allocateHiddenCustomerFees({
    rows: [],
    fees: [
      {
        id: 'access',
        kind: 'access_fee',
        roomId: null,
        amount: 50,
      },
    ],
  })

  assert.equal(result.fallbackAdditionalWorkAmount, 50)
  assert.equal(result.sectionAdjustments.other, 0)
  assert.deepEqual(result.allocations, [
    {
      feeId: 'access',
      feeKind: 'access_fee',
      targetRowId: null,
      targetSectionKey: 'other',
      amount: 50,
    },
  ])
})
