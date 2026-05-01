import { describe, expect, it } from 'vitest'
import {
  addAccessFeeDraft,
  buildEstimateV2DetailsAccessFeesVm,
  removeAccessFeeDraft,
  updateAccessFeeDraft,
} from '../estimateV2DetailsAccessFees'

const rooms = [
  { roomId: 'R001', roomName: 'Living' },
  { roomId: 'R002', roomName: 'Kitchen' },
]

const catalog = [
  {
    id: 'LADDER',
    label: 'Ladder',
    access_group: 'ladders' as const,
    fee_type: 'Labor',
    amount: 75,
    unit: 'each',
    notes: null,
  },
  {
    id: 'SCAFFOLD',
    label: 'Scaffold',
    access_group: 'scaffolding' as const,
    fee_type: 'PassThrough',
    amount: 300,
    unit: 'each',
    notes: null,
  },
]

describe('buildEstimateV2DetailsAccessFeesVm', () => {
  it('groups catalog options and computes effective totals', () => {
    const vm = buildEstimateV2DetailsAccessFeesVm({
      accessFees: [
        {
          id: 'row-1',
          accessFeeId: 'LADDER',
          qty: '2',
          actualCostOverride: '',
          roomId: '',
          notes: '',
          position: 0,
        },
      ],
      catalog,
      rooms,
      pricingSummary: null,
    })

    expect(vm.total).toBe(150)
    expect(vm.rows[0]).toMatchObject({
      label: 'Ladder',
      roomLabel: 'Job level',
      effectiveTotal: 150,
    })
    expect(vm.optionGroups.map((group) => group.key)).toEqual(['ladders', 'scaffolding'])
  })

  it('exposes optional room context labels without making fees room-scoped', () => {
    const vm = buildEstimateV2DetailsAccessFeesVm({
      accessFees: [
        {
          id: 'row-1',
          accessFeeId: 'SCAFFOLD',
          qty: '1',
          actualCostOverride: '425',
          roomId: 'R002',
          notes: '',
          position: 0,
        },
      ],
      catalog,
      rooms,
      pricingSummary: {
        accessFeeAllocation: { walls: 300, ceilings: 125, trim: 0, unallocated: 0, warning: null },
      },
    })

    expect(vm.rows[0].roomLabel).toBe('Kitchen')
    expect(vm.rows[0].effectiveTotal).toBe(425)
    expect(vm.rows[0].overridden).toBe(true)
    expect(vm.allocation?.ceilings).toBe(125)
  })
})

describe('access fee draft mutations', () => {
  it('adds, updates, and removes drafts immutably', () => {
    const added = addAccessFeeDraft([], () => 'new-id')
    expect(added).toEqual([
      {
        id: 'new-id',
        roomId: '',
        accessFeeId: '',
        qty: '1',
        actualCostOverride: '',
        notes: '',
        position: 0,
      },
    ])

    const updated = updateAccessFeeDraft(added, 'new-id', { accessFeeId: 'SCAFFOLD', qty: '3' })
    expect(updated[0].accessFeeId).toBe('SCAFFOLD')
    expect(updated[0].qty).toBe('3')
    expect(added[0].accessFeeId).toBe('')

    expect(removeAccessFeeDraft(updated, 'new-id')).toEqual([])
  })
})
