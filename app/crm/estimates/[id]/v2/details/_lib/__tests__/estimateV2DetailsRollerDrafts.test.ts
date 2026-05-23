import { describe, expect, it } from 'vitest'
import type { EstimateV2RollerDraft } from '@/types/estimator/v2Rooms'
import { applyDetailsRollerRowPatch } from '../estimateV2DetailsRollerDrafts'
import {
  createAggregateDetailsRollerRowTarget,
  createWallDetailsRollerRowTarget,
  detailsRollerRowId,
  findDetailsRollerDraftForRowId,
  parseDetailsRollerRowId,
} from '../estimateV2DetailsRollerIdentity'
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
    expect(parseDetailsRollerRowId('WALL:color1')).toEqual({
      scope: 'Wall',
      wallColorId: 'COLOR1',
    })
    expect(parseDetailsRollerRowId('wall:scope:wall-unassigned')).toEqual({
      scope: 'Wall',
      wallColorId: 'scope:wall-unassigned',
    })
    expect(parseDetailsRollerRowId('wall:SCOPE:wall-unassigned')).toEqual({
      scope: 'Wall',
      wallColorId: 'scope:wall-unassigned',
    })
    expect(parseDetailsRollerRowId('ceiling')).toEqual({
      scope: 'Ceiling',
      wallColorId: '',
    })
    expect(parseDetailsRollerRowId('trim')).toEqual({
      scope: 'Trim',
      wallColorId: '',
    })
    expect(parseDetailsRollerRowId(' TRIM ')).toEqual({
      scope: 'Trim',
      wallColorId: '',
    })
  })

  it('creates visible details row ids from centralized targets', () => {
    expect(detailsRollerRowId(createWallDetailsRollerRowTarget('color1'))).toBe('wall:COLOR1')
    expect(detailsRollerRowId(createWallDetailsRollerRowTarget('SCOPE:wall-unassigned'))).toBe(
      'wall:scope:wall-unassigned'
    )
    expect(detailsRollerRowId(createAggregateDetailsRollerRowTarget('Ceiling'))).toBe('ceiling')
    expect(detailsRollerRowId(createAggregateDetailsRollerRowTarget('Trim'))).toBe('trim')
  })

  it('degrades stale or malformed row ids into normalized wall targets predictably', () => {
    expect(parseDetailsRollerRowId('legacy-color-id')).toEqual({
      scope: 'Wall',
      wallColorId: 'LEGACY-COLOR-ID',
    })
    expect(parseDetailsRollerRowId('wall:')).toEqual({
      scope: 'Wall',
      wallColorId: '',
    })
    expect(parseDetailsRollerRowId('ceiling:COLOR1')).toEqual({
      scope: 'Wall',
      wallColorId: 'CEILING:COLOR1',
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
        selectedOptionId: 'WALL_9',
        rollerSizeIn: '9',
        coversQty: '3',
        notes: 'Changed from details page',
        position: 0,
      },
    ])
  })

  it('creates a persisted unassigned wall roller draft from the stable scope key', () => {
    const result = applyDetailsRollerRowPatch({
      rollers: [],
      rowId: 'wall:scope:wall-unassigned',
      patch: {
        coverId: 'WALL_9',
        quantity: '1',
      },
      rollerOptions,
      createId: () => 'roller-unassigned',
    })

    expect(result[0]).toMatchObject({
      id: 'roller-unassigned',
      scope: 'Wall',
      wallColorId: 'scope:wall-unassigned',
      selectedOptionId: 'WALL_9',
      rollerSizeIn: '9',
      coversQty: '1',
    })
  })

  it('matches existing unassigned wall roller drafts with shared scope identity rules', () => {
    const result = applyDetailsRollerRowPatch({
      rollers: [
        {
          id: 'roller-unassigned',
          scope: 'Wall',
          wallColorId: 'scope:WALL-UNASSIGNED',
          selectedOptionId: 'WALL_9',
          rollerSizeIn: '9',
          coversQty: '1',
          notes: '',
          position: 0,
        },
      ],
      rowId: 'wall:SCOPE:wall-unassigned',
      patch: {
        quantity: '2',
        notes: 'Still the same row',
      },
      rollerOptions,
      createId: () => 'roller-duplicate',
    })

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'roller-unassigned',
      wallColorId: 'scope:wall-unassigned',
      coversQty: '2',
      notes: 'Still the same row',
    })
  })

  it('matches existing wall color drafts case-insensitively without creating duplicates', () => {
    const result = applyDetailsRollerRowPatch({
      rollers: [
        {
          id: 'roller-color',
          scope: 'Wall',
          wallColorId: 'color1',
          selectedOptionId: 'WALL_9',
          rollerSizeIn: '9',
          coversQty: '1',
          notes: '',
          position: 0,
        },
      ],
      rowId: 'wall:COLOR1',
      patch: {
        quantity: '4',
      },
      rollerOptions,
      createId: () => 'roller-duplicate',
    })

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'roller-color',
      wallColorId: 'COLOR1',
      coversQty: '4',
    })
  })

  it('finds persisted drafts through centralized row id matching', () => {
    const rollers: EstimateV2RollerDraft[] = [
      {
        id: 'roller-unassigned',
        scope: 'Wall',
        wallColorId: 'SCOPE:Wall-Unassigned',
        selectedOptionId: 'WALL_9',
        rollerSizeIn: '9',
        coversQty: '1',
        notes: '',
        position: 0,
      },
    ]

    expect(findDetailsRollerDraftForRowId({ rollers, rowId: 'wall:scope:wall-unassigned' })).toBe(
      rollers[0]
    )
  })

  it('updates existing ceiling and trim aggregate drafts', () => {
    const rollers: EstimateV2RollerDraft[] = [
      {
        id: 'roller-ceiling',
        scope: 'Ceiling',
        wallColorId: 'COLOR1',
        rollerSizeIn: '12',
        coversQty: '1',
        notes: '',
        position: 0,
      },
      {
        id: 'applicator-trim',
        scope: 'Trim',
        wallColorId: 'COLOR2',
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
        selectedOptionId: 'CEIL_14',
        rollerSizeIn: '14',
        coversQty: '2',
        notes: '',
        position: 0,
      },
      {
        id: 'applicator-trim',
        scope: 'Trim',
        wallColorId: '',
        selectedOptionId: 'TRIM_4',
        rollerSizeIn: '4',
        coversQty: '1',
        notes: 'Trim applicator',
        position: 1,
      },
    ])
  })

  it('rejects cover option ids from the wrong scope', () => {
    const result = applyDetailsRollerRowPatch({
      rollers: [],
      rowId: 'wall:COLOR1',
      patch: {
        coverId: 'CEIL_14',
        quantity: '2',
      },
      rollerOptions,
      createId: () => 'roller-wall',
    })

    expect(result).toEqual([
      {
        id: 'roller-wall',
        scope: 'Wall',
        wallColorId: 'COLOR1',
        selectedOptionId: '',
        rollerSizeIn: '',
        coversQty: '2',
        notes: '',
        position: 0,
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
      selectedOptionId: '',
      rollerSizeIn: '9',
      coversQty: '4',
      notes: 'More covers',
    })
  })

  it('normalizes patched quantity with the canonical roller quantity rules', () => {
    const trimmed = applyDetailsRollerRowPatch({
      rollers: [],
      rowId: 'wall:COLOR1',
      patch: { coverId: 'WALL_9', quantity: ' 3 ' },
      rollerOptions,
      createId: () => 'roller-trimmed',
    })
    const malformed = applyDetailsRollerRowPatch({
      rollers: trimmed,
      rowId: 'wall:COLOR1',
      patch: { quantity: ' 1.5 ' },
      rollerOptions,
    })

    expect(trimmed[0]).toMatchObject({
      coversQty: '3',
    })
    expect(malformed[0]).toMatchObject({
      coversQty: '1.5',
    })
  })

  it('returns the previous collection when a normalized patch does not change an existing row', () => {
    const rollers: EstimateV2RollerDraft[] = [
      {
        id: 'roller-wall',
        scope: 'Wall',
        wallColorId: 'COLOR1',
        selectedOptionId: 'WALL_9',
        rollerSizeIn: '9',
        coversQty: '3',
        notes: 'Existing note',
        position: 0,
      },
    ]

    const result = applyDetailsRollerRowPatch({
      rollers,
      rowId: 'wall:COLOR1',
      patch: {
        coverId: 'WALL_9',
        quantity: ' 3 ',
        notes: 'Existing note',
      },
      rollerOptions,
      createId: () => 'unused',
    })

    expect(result).toBe(rollers)
  })

  it('removes an empty existing row when the selected option is cleared', () => {
    const rollers: EstimateV2RollerDraft[] = [
      {
        id: 'roller-wall',
        scope: 'Wall',
        wallColorId: 'COLOR1',
        rollerSizeIn: '',
        coversQty: '',
        notes: '',
        position: 0,
      },
    ]
    const options = [
      ...rollerOptions,
      { id: 'OPT-1', label: 'Wall option 1"', scope: 'Wall' as const, sizeIn: 1, priceEach: 2 },
    ]

    const emptySelection = applyDetailsRollerRowPatch({
      rollers,
      rowId: 'wall:COLOR1',
      patch: { coverId: '' },
      rollerOptions: options,
      createId: () => 'unused',
    })
    const selectedOption = applyDetailsRollerRowPatch({
      rollers,
      rowId: 'wall:COLOR1',
      patch: { coverId: 'OPT-1' },
      rollerOptions: options,
      createId: () => 'unused',
    })

    expect(emptySelection).toEqual([])
    expect(selectedOption).not.toBe(rollers)
    expect(selectedOption[0]).toMatchObject({
      id: 'roller-wall',
      selectedOptionId: 'OPT-1',
      rollerSizeIn: '1',
    })
  })

  it('does not create a persisted row for an empty aggregate roller patch', () => {
    const rollers: EstimateV2RollerDraft[] = []

    const result = applyDetailsRollerRowPatch({
      rollers,
      rowId: 'ceiling',
      patch: {
        coverId: '',
        quantity: ' ',
        notes: '',
      },
      rollerOptions,
      createId: () => 'unused',
    })

    expect(result).toBe(rollers)
  })

  it('removes an existing row when all persisted fields are cleared', () => {
    const rollers: EstimateV2RollerDraft[] = [
      {
        id: 'roller-wall',
        scope: 'Wall',
        wallColorId: 'COLOR1',
        selectedOptionId: 'WALL_9',
        rollerSizeIn: '9',
        coversQty: '3',
        notes: 'Existing',
        position: 0,
      },
    ]

    const result = applyDetailsRollerRowPatch({
      rollers,
      rowId: 'wall:COLOR1',
      patch: {
        coverId: '',
        quantity: '',
        notes: '',
      },
      rollerOptions,
    })

    expect(result).toEqual([])
  })
})
