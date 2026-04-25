import { describe, expect, it } from 'vitest'
import {
  buildEstimateV2DetailsVm,
  applyCeilingGallonOverride,
  applyTrimGallonOverride,
  applyWallGroupGallonOverride,
  parseRollerCoverOptionsFromRatesFlags,
  parseRollerCoverOptionsStateFromRatesFlags,
} from '../estimateV2DetailsVm'
import type {
  EstimateV2CeilingScopeDraft,
  EstimateV2RoomDraft,
  EstimateV2TrimScopeDraft,
  EstimateV2WallScopeDraft,
} from '@/types/estimator/v2'

const rooms: EstimateV2RoomDraft[] = [
  {
    id: 'room-1',
    roomId: 'R001',
    roomName: 'Living',
    roomTypeId: '',
    lengthIn: '',
    widthIn: '',
    heightIn: '',
    wallComplexityId: '',
    notes: '',
    position: 0,
  },
]

function wallScope(patch: Partial<EstimateV2WallScopeDraft>): EstimateV2WallScopeDraft {
  return {
    id: 'wall-1',
    roomId: 'R001',
    position: 0,
    mode: 'RECT',
    include: 'Y',
    scopeName: '',
    colorId: 'COLOR1',
    paintProductId: 'P-WALL',
    primerProductId: '',
    primeMode: 'NONE',
    heightIn: '',
    perimeterIn: '',
    standardDoorCount: '',
    standardWindowCount: '',
    heightFactor: '1',
    complexityFactor: '1',
    wallFlagFactor: '1',
    cutInTopFactor: '1',
    cutInBottomFactor: '1',
    paintCoats: '2',
    primerCoats: '1',
    spotPrimePercent: '',
    overrideAreaSqFt: '',
    overridePaintHours: '',
    overridePrimerHours: '',
    overridePaintGallons: '',
    overridePrimerGallons: '',
    overrideSupplyCost: '',
    overrideTotal: '',
    notes: '',
    ...patch,
  }
}

function ceilingScope(patch: Partial<EstimateV2CeilingScopeDraft>): EstimateV2CeilingScopeDraft {
  return {
    id: 'ceil-1',
    roomId: 'R001',
    position: 0,
    mode: 'RECT',
    include: 'Y',
    scopeName: '',
    colorId: '',
    paintProductId: 'P-CEIL',
    primerProductId: '',
    primeMode: 'NONE',
    spotPrimePercent: '',
    ceilingTypeId: '',
    lengthIn: '',
    widthIn: '',
    areaSf: '',
    heightFactor: '1',
    complexityFactor: '1',
    ceilingFlagFactor: '1',
    paintCoats: '2',
    primerCoats: '1',
    overrideAreaSqFt: '',
    overridePaintHours: '',
    overridePrimerHours: '',
    overridePaintGallons: '',
    overridePrimerGallons: '',
    overrideSupplyCost: '',
    overrideTotal: '',
    notes: '',
    ...patch,
  }
}

function trimScope(patch: Partial<EstimateV2TrimScopeDraft>): EstimateV2TrimScopeDraft {
  return {
    id: 'trim-1',
    roomId: 'R001',
    position: 0,
    include: 'Y',
    scopeName: '',
    trimTypeId: '',
    trimFamily: '',
    unitType: 'LF',
    measurementMode: 'MANUAL',
    helperSource: '',
    measurementValue: '',
    helperValue: '',
    colorId: '',
    paintProductId: 'P-TRIM',
    primerProductId: '',
    paintEnabled: 'Y',
    primeMode: 'NONE',
    spotPrimePercent: '',
    productionRateId: '',
    prepFactor: '1',
    heightFactor: '1',
    profileFactor: '1',
    roomFlagFactor: '1',
    maskingFactor: '1',
    stairFactor: '1',
    difficultFinishFactor: '1',
    caulkFillFactor: '1',
    paintCoats: '2',
    primerCoats: '1',
    overrideMeasurement: '',
    overrideHours: '',
    overrideGallons: '',
    overrideSupplyCost: '',
    overrideTotal: '',
    overrideDescription: '',
    notes: '',
    ...patch,
  }
}

function buildVm(overrides = {}) {
  return buildEstimateV2DetailsVm({
    rooms,
    wallScopes: [wallScope({}), wallScope({ id: 'wall-2', colorId: 'COLOR2' })],
    ceilingScopes: [ceilingScope({})],
    trimScopes: [trimScope({})],
    wallCalculations: [
      { id: 'wall-1', effective_area_sf: 100, raw_paint_gallons: 1.2 },
      { id: 'wall-2', effective_area_sf: 50, raw_paint_gallons: 0.6 },
    ],
    ceilingCalculations: [{ id: 'ceil-1', effective_area_sf: 75, raw_paint_gallons: 0.7 }],
    trimCalculations: [{ id: 'trim-1', effective_measurement: 40, raw_paint_gallons: 0.2 }],
    pricingSummary: null,
    paintProductLabelById: new Map([
      ['P-WALL', 'Wall Paint'],
      ['P-CEIL', 'Ceiling Paint'],
      ['P-TRIM', 'Trim Paint'],
    ]),
    colorLabelById: new Map([
      ['COLOR1', 'Primary'],
      ['COLOR2', 'Accent'],
    ]),
    rollerOptions: [
      { id: 'WALL_9', label: 'Wall 9"', scope: 'Wall', sizeIn: 9, priceEach: 6 },
      { id: 'CEIL_14', label: 'Ceiling 14"', scope: 'Ceiling', sizeIn: 14, priceEach: 10 },
      { id: 'TRIM_4', label: 'Trim applicator 4"', scope: 'Trim', sizeIn: 4, priceEach: 4 },
    ],
    rollers: [],
    ...overrides,
  })
}

describe('estimate details VM', () => {
  it('aggregates wall rows by active color group', () => {
    const vm = buildVm()
    expect(vm.wallRows).toHaveLength(2)
    expect(vm.wallRows[0]).toMatchObject({
      label: 'Color 1',
      colorName: 'Primary',
      rooms: ['Living'],
      sqFt: 100,
      calculatedGallons: 1.2,
      roundedGallons: 2,
    })
  })

  it('validates missing required roller settings', () => {
    const vm = buildVm()
    expect(vm.validationIssues).toContain('Color 1 roller cover is required')
    expect(vm.validationIssues).toContain('Ceilings quantity is required')
    expect(vm.validationIssues).toContain('Trim & Baseboards applicator is required')
    expect(vm.canContinueToSummary).toBe(false)
    expect(vm.validationSummary).toMatchObject({
      status: 'blocked',
      title: 'Summary is blocked',
    })
  })

  it('does not ask users to select roller covers while options are unavailable', () => {
    const vm = buildVm({
      rollerOptions: [],
      rollerOptionsState: {
        status: 'unavailable',
        options: [],
        message: 'Roller and applicator options failed to load.',
      },
    })

    expect(vm.rollerOptionsState.status).toBe('unavailable')
    expect(vm.validationIssues).toContain('Roller and applicator options failed to load.')
    expect(vm.validationIssues).not.toContain('Color 1 roller cover is required')
    expect(vm.validationIssues).not.toContain('Trim & Baseboards applicator is required')
  })

  it('represents configured-but-empty roller options explicitly', () => {
    const vm = buildVm({
      rollerOptions: [],
      rollerOptionsState: {
        status: 'empty',
        options: [],
        message: 'No roller or applicator options are configured in rates and flags.',
      },
    })

    expect(vm.rollerOptionsState.status).toBe('empty')
    expect(vm.validationIssues).toContain('Wall roller cover options are not configured')
    expect(vm.validationIssues).toContain('Ceiling roller cover options are not configured')
    expect(vm.validationIssues).toContain('Trim applicator options are not configured')
    expect(vm.validationIssues).not.toContain('Color 1 roller cover is required')
  })

  it('validates invalid gallon overrides before summary navigation', () => {
    const vm = buildVm({
      wallScopes: [wallScope({ overridePaintGallons: '-1' })],
      ceilingScopes: [],
      trimScopes: [],
      rollers: [
        {
          id: 'roller-wall-1',
          scope: 'Wall',
          wallColorId: 'COLOR1',
          rollerSizeIn: '9',
          coversQty: '1',
          notes: '',
          position: 0,
        },
      ],
    })

    expect(vm.validationIssues).toContain('Color 1 override gallons must be a zero or positive number')
    expect(vm.canContinueToSummary).toBe(false)
    expect(vm.continueBlockedReason).toBe('Color 1 override gallons must be a zero or positive number')
  })

  it('reports active overrides without requiring saved override reasons', () => {
    const vm = buildVm({
      wallScopes: [wallScope({ overridePaintGallons: '4' })],
      ceilingScopes: [],
      trimScopes: [],
      rollers: [
        {
          id: 'roller-wall-1',
          scope: 'Wall',
          wallColorId: 'COLOR1',
          rollerSizeIn: '9',
          coversQty: '1',
          notes: '',
          position: 0,
        },
      ],
    })

    expect(vm.activeOverrides[0]).toMatchObject({ key: 'walls:COLOR1', newValue: 4 })
    expect(vm.wallRows[0].overrideOwnerScopeId).toBe('wall-1')
    expect(vm.validationIssues).not.toContain('Color 1 override requires a reason')
    expect(vm.canContinueToSummary).toBe(true)
  })

  it('blocks a wall group with two different saved gallon override values', () => {
    const vm = buildVm({
      wallScopes: [
        wallScope({ id: 'wall-1', colorId: 'COLOR1', overridePaintGallons: '4' }),
        wallScope({ id: 'wall-2', colorId: 'COLOR1', overridePaintGallons: '5' }),
      ],
      ceilingScopes: [],
      trimScopes: [],
      rollers: [
        {
          id: 'roller-wall-1',
          scope: 'Wall',
          wallColorId: 'COLOR1',
          rollerSizeIn: '9',
          coversQty: '1',
          notes: '',
          position: 0,
        },
      ],
    })

    expect(vm.wallRows).toHaveLength(1)
    expect(vm.wallRows[0]).toMatchObject({
      overrideGallons: '4',
      finalGallons: 4,
      overrideOwnerScopeId: 'wall-1',
    })
    expect(vm.validationIssues).toContain(
      'Color 1 has conflicting saved gallon overrides across grouped scopes; apply or clear the grouped override to normalize it to the first active scope.'
    )
    expect(vm.canContinueToSummary).toBe(false)
  })

  it('blocks a wall group with duplicate same saved gallon override values', () => {
    const vm = buildVm({
      wallScopes: [
        wallScope({ id: 'wall-1', colorId: 'COLOR1', overridePaintGallons: '4' }),
        wallScope({ id: 'wall-2', colorId: 'COLOR1', overridePaintGallons: '4' }),
      ],
      ceilingScopes: [],
      trimScopes: [],
      rollers: [
        {
          id: 'roller-wall-1',
          scope: 'Wall',
          wallColorId: 'COLOR1',
          rollerSizeIn: '9',
          coversQty: '1',
          notes: '',
          position: 0,
        },
      ],
    })

    expect(vm.wallRows[0]).toMatchObject({
      overrideGallons: '4',
      finalGallons: 4,
      overrideOwnerScopeId: 'wall-1',
    })
    expect(vm.validationIssues).toContain(
      'Color 1 has duplicate saved gallon overrides across grouped scopes; apply or clear the grouped override to normalize it to the first active scope.'
    )
    expect(vm.canContinueToSummary).toBe(false)
  })

  it('blocks ceiling aggregates with duplicate saved gallon overrides', () => {
    const vm = buildVm({
      wallScopes: [],
      ceilingScopes: [
        ceilingScope({ id: 'ceil-1', overridePaintGallons: '3' }),
        ceilingScope({ id: 'ceil-2', overridePaintGallons: '3' }),
      ],
      trimScopes: [],
      rollers: [
        {
          id: 'roller-ceiling-1',
          scope: 'Ceiling',
          wallColorId: '',
          rollerSizeIn: '14',
          coversQty: '1',
          notes: '',
          position: 0,
        },
      ],
    })

    expect(vm.ceilingRow).toMatchObject({
      overrideGallons: '3',
      finalGallons: 3,
      overrideOwnerScopeId: 'ceil-1',
    })
    expect(vm.validationIssues).toContain(
      'Ceilings has duplicate saved gallon overrides across grouped scopes; apply or clear the grouped override to normalize it to the first active scope.'
    )
    expect(vm.canContinueToSummary).toBe(false)
  })

  it('blocks trim aggregates with duplicate saved gallon overrides', () => {
    const vm = buildVm({
      wallScopes: [],
      ceilingScopes: [],
      trimScopes: [
        trimScope({ id: 'trim-1', overrideGallons: '2' }),
        trimScope({ id: 'trim-2', overrideGallons: '2' }),
      ],
      rollers: [
        {
          id: 'applicator-trim-1',
          scope: 'Trim',
          wallColorId: '',
          rollerSizeIn: '4',
          coversQty: '1',
          notes: '',
          position: 0,
        },
      ],
    })

    expect(vm.trimRow).toMatchObject({
      overrideGallons: '2',
      finalGallons: 2,
      overrideOwnerScopeId: 'trim-1',
    })
    expect(vm.validationIssues).toContain(
      'Trim & Baseboards has duplicate saved gallon overrides across grouped scopes; apply or clear the grouped override to normalize it to the first active scope.'
    )
    expect(vm.canContinueToSummary).toBe(false)
  })

  it('hydrates roller selections from persisted roller rows', () => {
    const vm = buildVm({
      rollers: [
        {
          id: 'roller-wall-1',
          scope: 'Wall',
          wallColorId: 'COLOR1',
          rollerSizeIn: '9',
          coversQty: '2',
          notes: 'Saved note',
          position: 0,
        },
        {
          id: 'roller-ceiling-1',
          scope: 'Ceiling',
          wallColorId: '',
          rollerSizeIn: '14',
          coversQty: '1',
          notes: '',
          position: 1,
        },
        {
          id: 'applicator-trim-1',
          scope: 'Trim',
          wallColorId: '',
          rollerSizeIn: '4',
          coversQty: '2',
          notes: 'Saved trim note',
          position: 2,
        },
      ],
    })

    expect(vm.wallRollerRows[0]).toMatchObject({
      coverId: 'WALL_9',
      quantity: '2',
      notes: 'Saved note',
      errors: [],
    })
    expect(vm.ceilingRollerRow).toMatchObject({
      coverId: 'CEIL_14',
      quantity: '1',
      errors: [],
    })
    expect(vm.trimApplicatorRow).toMatchObject({
      coverId: 'TRIM_4',
      quantity: '2',
      notes: 'Saved trim note',
      errors: [],
    })
  })

  it('blocks ambiguous wall roller hydration when active options share the saved size', () => {
    const vm = buildVm({
      rollerOptions: [
        { id: 'WALL_9_STANDARD', label: 'Wall standard 9"', scope: 'Wall', sizeIn: 9, priceEach: 6 },
        { id: 'WALL_9_PREMIUM', label: 'Wall premium 9"', scope: 'Wall', sizeIn: 9, priceEach: 8 },
        { id: 'CEIL_14', label: 'Ceiling 14"', scope: 'Ceiling', sizeIn: 14, priceEach: 10 },
        { id: 'TRIM_4', label: 'Trim applicator 4"', scope: 'Trim', sizeIn: 4, priceEach: 4 },
      ],
      rollers: [
        {
          id: 'roller-wall-1',
          scope: 'Wall',
          wallColorId: 'COLOR1',
          rollerSizeIn: '9',
          coversQty: '2',
          notes: 'Saved note',
          position: 0,
        },
        {
          id: 'roller-wall-2',
          scope: 'Wall',
          wallColorId: 'COLOR2',
          rollerSizeIn: '12',
          coversQty: '1',
          notes: '',
          position: 1,
        },
        {
          id: 'roller-ceiling-1',
          scope: 'Ceiling',
          wallColorId: '',
          rollerSizeIn: '14',
          coversQty: '1',
          notes: '',
          position: 2,
        },
        {
          id: 'applicator-trim-1',
          scope: 'Trim',
          wallColorId: '',
          rollerSizeIn: '4',
          coversQty: '1',
          notes: '',
          position: 3,
        },
      ],
    })

    expect(vm.wallRollerRows[0]).toMatchObject({
      coverId: '',
      quantity: '2',
      notes: 'Saved note',
    })
    expect(vm.validationIssues).toContain(
      'Color 1 saved wall roller cover size 9" matches multiple active options; make sizes unique before continuing.'
    )
    expect(vm.canContinueToSummary).toBe(false)
  })

  it('blocks ambiguous aggregate roller and applicator hydration when active options share saved sizes', () => {
    const vm = buildVm({
      wallScopes: [],
      rollerOptions: [
        { id: 'CEIL_14_STANDARD', label: 'Ceiling standard 14"', scope: 'Ceiling', sizeIn: 14, priceEach: 10 },
        { id: 'CEIL_14_WIDE', label: 'Ceiling wide 14"', scope: 'Ceiling', sizeIn: 14, priceEach: 12 },
        { id: 'TRIM_4_STANDARD', label: 'Trim standard 4"', scope: 'Trim', sizeIn: 4, priceEach: 4 },
        { id: 'TRIM_4_DETAIL', label: 'Trim detail 4"', scope: 'Trim', sizeIn: 4, priceEach: 5 },
      ],
      rollers: [
        {
          id: 'roller-ceiling-1',
          scope: 'Ceiling',
          wallColorId: '',
          rollerSizeIn: '14',
          coversQty: '1',
          notes: '',
          position: 0,
        },
        {
          id: 'applicator-trim-1',
          scope: 'Trim',
          wallColorId: '',
          rollerSizeIn: '4',
          coversQty: '1',
          notes: '',
          position: 1,
        },
      ],
    })

    expect(vm.ceilingRollerRow).toMatchObject({ coverId: '', quantity: '1' })
    expect(vm.trimApplicatorRow).toMatchObject({ coverId: '', quantity: '1' })
    expect(vm.validationIssues).toContain(
      'Ceilings saved ceiling roller cover size 14" matches multiple active options; make sizes unique before continuing.'
    )
    expect(vm.validationIssues).toContain(
      'Trim & Baseboards saved trim applicator size 4" matches multiple active options; make sizes unique before continuing.'
    )
    expect(vm.canContinueToSummary).toBe(false)
  })

  it('parses roller covers from the rates flags roller cover category', () => {
    const options = parseRollerCoverOptionsFromRatesFlags({
      categories: [
        {
          key: 'supply_rates_roller_covers',
          rows: [
            { id: 'WALL_9', display_name: 'Wall', scope: 'Wall', size_in: '9', price_each: '6', active: 'Y' },
            { id: 'CEIL_14', display_name: 'Ceiling', scope: 'Ceiling', size_in: '14', price_each: '10', active: 'Y' },
            { id: 'TRIM_4', display_name: 'Trim applicator', scope: 'Trim', size_in: '4', price_each: '4', active: 'Y' },
          ],
        },
      ],
    })

    expect(options).toEqual([
      { id: 'WALL_9', label: 'Wall 9"', scope: 'Wall', sizeIn: 9, priceEach: 6 },
      { id: 'CEIL_14', label: 'Ceiling 14"', scope: 'Ceiling', sizeIn: 14, priceEach: 10 },
      { id: 'TRIM_4', label: 'Trim applicator 4"', scope: 'Trim', sizeIn: 4, priceEach: 4 },
    ])
  })

  it('classifies malformed and empty roller cover payloads', () => {
    expect(parseRollerCoverOptionsStateFromRatesFlags({ categories: null })).toMatchObject({
      status: 'unavailable',
      options: [],
    })

    expect(
      parseRollerCoverOptionsStateFromRatesFlags({
        categories: [{ key: 'supply_rates_roller_covers', rows: [] }],
      })
    ).toMatchObject({
      status: 'empty',
      options: [],
    })
  })

  it('applies and clears wall grouped gallon overrides on the first active backing scope', () => {
    const scopes = [
      wallScope({ id: 'wall-inactive', colorId: 'COLOR1', include: 'N', overridePaintGallons: '9' }),
      wallScope({ id: 'wall-1', colorId: 'COLOR1', overridePaintGallons: '1' }),
      wallScope({ id: 'wall-2', colorId: 'COLOR1', overridePaintGallons: '2' }),
      wallScope({ id: 'wall-3', colorId: 'COLOR2', overridePaintGallons: '7' }),
    ]

    expect(
      applyWallGroupGallonOverride(scopes, 'COLOR1', '5').map((scope) => ({
        id: scope.id,
        overridePaintGallons: scope.overridePaintGallons,
      }))
    ).toEqual([
      { id: 'wall-inactive', overridePaintGallons: '9' },
      { id: 'wall-1', overridePaintGallons: '5' },
      { id: 'wall-2', overridePaintGallons: '' },
      { id: 'wall-3', overridePaintGallons: '7' },
    ])

    expect(
      applyWallGroupGallonOverride(scopes, 'COLOR1', '').map((scope) => ({
        id: scope.id,
        overridePaintGallons: scope.overridePaintGallons,
      }))
    ).toEqual([
      { id: 'wall-inactive', overridePaintGallons: '9' },
      { id: 'wall-1', overridePaintGallons: '' },
      { id: 'wall-2', overridePaintGallons: '' },
      { id: 'wall-3', overridePaintGallons: '7' },
    ])
  })

  it('applies and clears ceiling grouped gallon overrides on the first active backing scope', () => {
    const scopes = [
      ceilingScope({ id: 'ceil-inactive', include: 'N', overridePaintGallons: '9' }),
      ceilingScope({ id: 'ceil-1', overridePaintGallons: '1' }),
      ceilingScope({ id: 'ceil-2', overridePaintGallons: '2' }),
    ]

    expect(applyCeilingGallonOverride(scopes, '3').map((scope) => scope.overridePaintGallons)).toEqual([
      '9',
      '3',
      '',
    ])
    expect(applyCeilingGallonOverride(scopes, '').map((scope) => scope.overridePaintGallons)).toEqual([
      '9',
      '',
      '',
    ])
  })

  it('applies and clears trim grouped gallon overrides on the first active backing scope', () => {
    const scopes = [
      trimScope({ id: 'trim-inactive', include: 'N', overrideGallons: '9' }),
      trimScope({ id: 'trim-1', overrideGallons: '1' }),
      trimScope({ id: 'trim-2', overrideGallons: '2' }),
    ]

    expect(applyTrimGallonOverride(scopes, '2').map((scope) => scope.overrideGallons)).toEqual([
      '9',
      '2',
      '',
    ])
    expect(applyTrimGallonOverride(scopes, '').map((scope) => scope.overrideGallons)).toEqual([
      '9',
      '',
      '',
    ])
  })
})
