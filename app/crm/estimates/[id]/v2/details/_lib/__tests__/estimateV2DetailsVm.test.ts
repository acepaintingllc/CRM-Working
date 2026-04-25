import { describe, expect, it } from 'vitest'
import {
  buildEstimateV2DetailsVm,
  applyCeilingGallonOverride,
  applyTrimGallonOverride,
  applyWallGroupGallonOverride,
  parseRollerCoverOptionsFromRatesFlags,
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
    rollerOptions: [],
    rollerState: {},
    overrideReasons: {},
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
  })

  it('validates missing override reasons', () => {
    const vm = buildVm({
      wallScopes: [wallScope({ overridePaintGallons: '4' })],
      rollerState: {
        'wall:COLOR1': { coverId: 'WALL_9', quantity: '1', notes: '' },
      },
    })

    expect(vm.activeOverrides[0]).toMatchObject({ key: 'walls:COLOR1', newValue: 4 })
    expect(vm.validationIssues).toContain('Color 1 override requires a reason')
  })

  it('parses roller covers from the rates flags roller cover category', () => {
    const options = parseRollerCoverOptionsFromRatesFlags({
      categories: [
        {
          key: 'supply_rates_roller_covers',
          rows: [
            { id: 'WALL_9', display_name: 'Wall', scope: 'Wall', size_in: '9', price_each: '6', active: 'Y' },
            { id: 'CEIL_14', display_name: 'Ceiling', scope: 'Ceiling', size_in: '14', price_each: '10', active: 'Y' },
          ],
        },
      ],
    })

    expect(options).toEqual([
      { id: 'WALL_9', label: 'Wall 9"', scope: 'Wall', sizeIn: 9, priceEach: 6 },
      { id: 'CEIL_14', label: 'Ceiling 14"', scope: 'Ceiling', sizeIn: 14, priceEach: 10 },
    ])
  })

  it('maps gallon override actions to existing wall ceiling and trim fields', () => {
    expect(
      applyWallGroupGallonOverride(
        [wallScope({ id: 'wall-1', colorId: 'COLOR1' }), wallScope({ id: 'wall-2', colorId: 'COLOR1' })],
        'COLOR1',
        '5'
      ).map((scope) => scope.overridePaintGallons)
    ).toEqual(['5', ''])

    expect(applyCeilingGallonOverride([ceilingScope({})], '3')[0].overridePaintGallons).toBe('3')
    expect(applyTrimGallonOverride([trimScope({})], '2')[0].overrideGallons).toBe('2')
  })
})
