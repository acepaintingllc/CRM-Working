import { describe, expect, it } from 'vitest'
import type { EstimateV2RollerDraft } from '@/types/estimator/v2'
import {
  applyDetailsRollerRowPatch,
  parseDetailsRollerRowId,
} from '../estimateV2DetailsRollerDrafts'
import type { DetailsRollerCoverOption } from '../estimateV2DetailsVm'

const rollerOptions: DetailsRollerCoverOption[] = [
  { id: 'WALL_9', label: 'Wall 9"', scope: 'Wall', sizeIn: 9, priceEach: 6 },
  { id: 'CEIL_14', label: 'Ceiling 14"', scope: 'Ceiling', sizeIn: 14, priceEach: 10 },
  { id: 'TRIM_4', label: 'Trim applicator 4"', scope: 'Trim', sizeIn: 4, priceEach: 4 },
]

describe('estimate details roller draft helpers', () => {
  it('parses visible details row ids into persisted roller targets', () => {
    expect(parseDetailsRollerRowId('wall:color1')).toEqual({
      scope: 'Wall',
      wallColorId: 'COLOR1',
    })
    expect(parseDetailsRollerRowId('ceiling')).toEqual({
      scope: 'Ceiling',
      wallColorId: '',
    })
    expect(parseDetailsRollerRowId('trim')).toEqual({
      scope: 'Trim',
      wallColorId: '',
    })
  })

  it('creates a persisted wall roller draft from selected option identity', () => {
    const result = applyDetailsRollerRowPatch({
      rollers: [],
      rowId: 'wall:color1',
      patch: {
        coverId: 'WALL_9',
        quantity: '3',
        notes: 'Changed from details page',
      },
      rollerOptions,
      createId: () => 'roller-new',
    })

    expect(result).toEqual([
      {
        id: 'roller-new',
        scope: 'Wall',
        wallColorId: 'COLOR1',
        rollerSizeIn: '9',
        coversQty: '3',
        notes: 'Changed from details page',
        position: 0,
      },
    ])
  })

  it('updates existing ceiling and trim aggregate drafts without wall color ids', () => {
    const rollers: EstimateV2RollerDraft[] = [
      {
        id: 'roller-ceiling',
        scope: 'Ceiling',
        wallColorId: '',
        rollerSizeIn: '12',
        coversQty: '1',
        notes: '',
        position: 0,
      },
      {
        id: 'applicator-trim',
        scope: 'Trim',
        wallColorId: '',
        rollerSizeIn: '2',
        coversQty: '1',
        notes: '',
        position: 1,
      },
    ]

    const withCeiling = applyDetailsRollerRowPatch({
      rollers,
      rowId: 'ceiling',
      patch: { coverId: 'CEIL_14', quantity: '2' },
      rollerOptions,
    })
    const withTrim = applyDetailsRollerRowPatch({
      rollers: withCeiling,
      rowId: 'trim',
      patch: { coverId: 'TRIM_4', notes: 'Trim applicator' },
      rollerOptions,
    })

    expect(withTrim).toEqual([
      {
        id: 'roller-ceiling',
        scope: 'Ceiling',
        wallColorId: '',
        rollerSizeIn: '14',
        coversQty: '2',
        notes: '',
        position: 0,
      },
      {
        id: 'applicator-trim',
        scope: 'Trim',
        wallColorId: '',
        rollerSizeIn: '4',
        coversQty: '1',
        notes: 'Trim applicator',
        position: 1,
      },
    ])
  })

  it('preserves persisted size when patching quantity or notes only', () => {
    const result = applyDetailsRollerRowPatch({
      rollers: [
        {
          id: 'roller-wall',
          scope: 'Wall',
          wallColorId: 'COLOR1',
          rollerSizeIn: '9',
          coversQty: '1',
          notes: '',
          position: 0,
        },
      ],
      rowId: 'wall:COLOR1',
      patch: { quantity: '4', notes: 'More covers' },
      rollerOptions,
    })

    expect(result[0]).toMatchObject({
      id: 'roller-wall',
      rollerSizeIn: '9',
      coversQty: '4',
      notes: 'More covers',
    })
  })
})
