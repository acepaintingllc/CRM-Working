import { describe, expect, it } from 'vitest'
import {
  buildEstimateV2MaterialPlanningVm,
  buildEstimateV2RollerPlanningVm,
  buildEstimateV2TotalsVm,
  buildEstimateV2ValidationVm,
  applyCeilingGallonOverride,
  applyTrimGallonOverride,
  applyWallGroupGallonOverride,
  extractEstimateV2DetailsCalculationRows,
  parseRollerCoverOptionsFromRatesFlags,
  parseRollerCoverOptionsStateFromRatesFlags,
} from '../estimateV2DetailsVm'
import {
  createWallRows,
} from '../estimateV2DetailsMaterials'
import {
  applyGroupedMaterialOverridePersistencePolicy,
  resolveGroupedOverride,
} from '../estimateV2DetailsMaterialOverrides'
import { calculationRowsById } from '../estimateV2DetailsMaterialCalculations'
import { resolveRollerRowState, validateRollerRow } from '../estimateV2DetailsRollers'
import { formatDetailsNumber } from '../estimateV2DetailsShared'
import {
  createMaterialCards,
  createValidationIssues,
  createValidationSummary,
  getBlockingValidationIssues,
} from '../estimateV2DetailsValidation'
import {
  buildVm,
  buildVmParams,
  ceilingCalculationRow,
  ceilingScope,
  rooms,
  testIssue,
  trimCalculationRow,
  trimScope,
  validationIds,
  validationMessages,
  wallCalculationRow,
  wallScope,
} from './estimateV2DetailsVm.testUtils'
import type {
  EstimateV2WallScopeDraft,
} from '@/types/estimator/v2'

type DetailsVm = ReturnType<typeof buildVm>

describe('estimate details VM materials', () => {

  it('creates material rows from the focused material helper', () => {
    const rows = createWallRows({
      rooms,
      wallScopes: [wallScope({}), wallScope({ id: 'wall-2', colorId: 'COLOR1' })],
      ceilingScopes: [],
      trimScopes: [],
      wallCalculations: [
        wallCalculationRow({ id: 'wall-1', effectiveAreaSf: 100, rawPaintGallons: 1.2 }),
        wallCalculationRow({ id: 'wall-2', effectiveAreaSf: 50, rawPaintGallons: 0.6 }),
      ],
      ceilingCalculations: [],
      trimCalculations: [],
      pricingSummary: null,
      paintProductLabelById: new Map([['P-WALL', 'Wall Paint']]),
      colorLabelById: new Map([['COLOR1', 'Primary']]),
      rollerOptions: [],
      rollers: [],
    })

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: 'COLOR1',
      colorName: 'Primary',
      sqFt: 150,
      calculatedGallons: 1.8,
      roundedGallons: 2,
      finalGallons: 2,
      calculationStatus: 'available' as const,
    })
  })


  it('builds the material planning VM as an isolated pure planning step', () => {
    const materialPlanning = buildEstimateV2MaterialPlanningVm(buildVmParams({
      wallScopes: [wallScope({ overridePaintGallons: '4' })],
      ceilingScopes: [ceilingScope({ overridePaintGallons: '3' })],
      trimScopes: [],
    }))

    expect(materialPlanning.wallRows).toHaveLength(1)
    expect(materialPlanning.ceilingRow).toMatchObject({ id: 'ceilings', finalGallons: 3 })
    expect(materialPlanning.trimRow).toBeNull()
    expect(materialPlanning.hasCeilings).toBe(true)
    expect(materialPlanning.hasTrim).toBe(false)
    expect(materialPlanning.activeOverrides.map((override) => override.key)).toEqual([
      'walls:color:COLOR1',
      'ceilings',
    ])
    expect(materialPlanning.materialPlanningSections.walls.description).toBe(
      '1 active wall color group.'
    )
    expect(materialPlanning.materialPlanningSections.trim.description).toBe(
      'No active trim scopes.'
    )
  })


  it('blocks missing wall calculation rows instead of silently treating them as usable zeroes', () => {
    const vm = buildVm({
      wallCalculations: [
        wallCalculationRow({ id: 'wall-1', effectiveAreaSf: 100, rawPaintGallons: 1.2 }),
      ],
    })
    const accent = vm.wallRows.find((row) => row.id === 'COLOR2')

    expect(accent).toMatchObject({
      label: 'Accent',
      calculationStatus: 'unavailable',
      calculationMessage: 'Calculation data unavailable',
      calculatedGallons: 0,
      finalGallons: 0,
    })
    expect(validationIds(vm)).toContain('material:COLOR2:calculation:missing')
    expect(validationMessages(vm)).toContain(
      'Accent calculation data is unavailable; reopen the estimate calculator before continuing.'
    )
    expect(vm.canContinueToSummary).toBe(false)
  })


  it('blocks missing ceiling and trim calculation rows', () => {
    const vm = buildVm({
      ceilingCalculations: [],
      trimCalculations: [],
    })

    expect(vm.ceilingRow).toMatchObject({
      calculationStatus: 'unavailable',
      calculationMessage: 'Calculation data unavailable',
    })
    expect(vm.trimRow).toMatchObject({
      calculationStatus: 'unavailable',
      calculationMessage: 'Calculation data unavailable',
    })
    expect(validationIds(vm)).toEqual(
      expect.arrayContaining([
        'material:ceilings:calculation:missing',
        'material:trim:calculation:missing',
      ])
    )
    expect(validationMessages(vm)).toEqual(
      expect.arrayContaining([
        'Ceilings calculation data is unavailable; reopen the estimate calculator before continuing.',
        'Trim & Baseboards calculation data is unavailable; reopen the estimate calculator before continuing.',
      ])
    )
    expect(vm.canContinueToSummary).toBe(false)
  })


  it('extracts valid calculation scope rows for details materials', () => {
    const rows = extractEstimateV2DetailsCalculationRows({
      wallCalculations: {
        scopes: [
          { id: 'wall-1', effective_area_sf: 100, raw_paint_gallons: 1.2 },
          { id: 'wall-2', effective_area_sf: 50, raw_paint_gallons: 0.6 },
        ],
      },
      ceilingCalculations: {
        scopes: [{ id: 'ceil-1', effective_area_sf: 75, raw_paint_gallons: 0.7 }],
      },
      trimCalculations: {
        scopes: [{ id: 'trim-1', effective_measurement: 40, raw_paint_gallons: 0.2 }],
      },
    })
    const vm = buildVm({
      wallCalculations: rows.wallCalculationRows,
      ceilingCalculations: rows.ceilingCalculationRows,
      trimCalculations: rows.trimCalculationRows,
    })

    expect(rows).toEqual({
      wallCalculationRows: [
        { id: 'wall-1', effectiveAreaSf: 100, rawPaintGallons: 1.2 },
        { id: 'wall-2', effectiveAreaSf: 50, rawPaintGallons: 0.6 },
      ],
      ceilingCalculationRows: [
        { id: 'ceil-1', effectiveAreaSf: 75, rawPaintGallons: 0.7 },
      ],
      trimCalculationRows: [
        { id: 'trim-1', effectiveMeasurement: 40, rawPaintGallons: 0.2 },
      ],
    })
    expect(vm.wallRows.map((row) => row.calculationStatus)).toEqual(['available', 'available'])
    expect(vm.ceilingRow?.calculationStatus).toBe('available')
    expect(vm.trimRow?.calculationStatus).toBe('available')
    expect(validationIds(vm)).not.toEqual(
      expect.arrayContaining([
        'material:COLOR1:calculation:missing',
        'material:COLOR2:calculation:missing',
        'material:ceilings:calculation:missing',
        'material:trim:calculation:missing',
      ])
    )
  })


  it('indexes material calculation rows by stable scope id', () => {
    const byId = calculationRowsById([
      wallCalculationRow({ id: 'wall-b', effectiveAreaSf: 50, rawPaintGallons: 0.6 }),
      wallCalculationRow({ id: 'wall-a', effectiveAreaSf: 100, rawPaintGallons: 1.2 }),
    ])

    expect(byId.get('wall-a')).toEqual({
      id: 'wall-a',
      effectiveAreaSf: 100,
      rawPaintGallons: 1.2,
    })
    expect(byId.get('missing')).toBeUndefined()
  })


  it('degrades malformed calculation payloads to missing calculation rows consistently', () => {
    const rows = extractEstimateV2DetailsCalculationRows({
      wallCalculations: { scopes: 'not-an-array' },
      ceilingCalculations: 'not-an-object',
      trimCalculations: { scopes: [null, 'bad-row'] },
    })
    const vm = buildVm({
      wallCalculations: rows.wallCalculationRows,
      ceilingCalculations: rows.ceilingCalculationRows,
      trimCalculations: rows.trimCalculationRows,
    })

    expect(rows).toEqual({
      wallCalculationRows: null,
      ceilingCalculationRows: null,
      trimCalculationRows: [],
    })
    expect(vm.wallRows.map((row) => row.calculationStatus)).toEqual(['unavailable', 'unavailable'])
    expect(vm.ceilingRow?.calculationStatus).toBe('unavailable')
    expect(vm.trimRow?.calculationStatus).toBe('unavailable')
    expect(validationIds(vm)).toEqual(
      expect.arrayContaining([
        'material:COLOR1:calculation:missing',
        'material:COLOR2:calculation:missing',
        'material:ceilings:calculation:missing',
        'material:trim:calculation:missing',
      ])
    )
  })


  it('surfaces missing product catalog labels consistently without blocking summary', () => {
    const vm = buildVm({
      paintProductLabelById: new Map([['P-CEIL', 'Ceiling Paint']]),
      rollers: [
        {
          id: 'roller-wall-1',
          scope: 'Wall',
          wallColorId: 'COLOR1',
          selectedOptionId: 'WALL_9',
          rollerSizeIn: '',
          coversQty: '1',
          notes: '',
          position: 0,
        },
        {
          id: 'roller-wall-2',
          scope: 'Wall',
          wallColorId: 'COLOR2',
          selectedOptionId: 'WALL_9',
          rollerSizeIn: '',
          coversQty: '1',
          notes: '',
          position: 1,
        },
        {
          id: 'roller-ceiling',
          scope: 'Ceiling',
          wallColorId: '',
          selectedOptionId: 'CEIL_14',
          rollerSizeIn: '',
          coversQty: '1',
          notes: '',
          position: 2,
        },
        {
          id: 'roller-trim',
          scope: 'Trim',
          wallColorId: '',
          selectedOptionId: 'TRIM_4',
          rollerSizeIn: '',
          coversQty: '1',
          notes: '',
          position: 3,
        },
      ],
    })

    expect(vm.wallRows[0]).toMatchObject({
      product: 'P-WALL',
      productWarning: 'P-WALL is not in the loaded catalog',
    })
    expect(vm.trimRow).toMatchObject({
      product: 'P-TRIM',
      productWarning: 'P-TRIM is not in the loaded catalog',
    })
    expect(validationIds(vm)).toEqual(
      expect.arrayContaining([
        'material:COLOR1:paintProductId:missing-catalog-label',
        'material:COLOR2:paintProductId:missing-catalog-label',
        'material:trim:paintProductId:missing-catalog-label',
      ])
    )
    expect(validationMessages(vm)).toContain(
      'Primary product P-WALL is not in the loaded catalog.'
    )
    expect(vm.validationIssues.filter((issue) => issue.severity === 'blocking')).toEqual([])
    expect(vm.canContinueToSummary).toBe(true)
  })


  it('aggregates wall rows by active color group', () => {
    const vm = buildVm()
    expect(vm.wallRows).toHaveLength(2)
    expect(vm.wallRows[0]).toMatchObject({
      label: 'Primary',
      colorName: 'Primary',
      rooms: ['Living'],
      sqFt: 100,
      calculatedGallons: 1.2,
      roundedGallons: 2,
    })
  })


  it('omits a wall color group when all scopes in that color are inactive', () => {
    const materialPlanning = buildEstimateV2MaterialPlanningVm(buildVmParams({
      wallScopes: [
        wallScope({ id: 'wall-color1-a', colorId: 'COLOR1', include: 'N' }),
        wallScope({ id: 'wall-color1-b', colorId: 'COLOR1', include: 'N' }),
        wallScope({ id: 'wall-color2-active', colorId: 'COLOR2', include: 'Y' }),
      ],
      ceilingScopes: [],
      trimScopes: [],
      wallCalculations: [
        wallCalculationRow({ id: 'wall-color1-a', effectiveAreaSf: 100, rawPaintGallons: 1.2 }),
        wallCalculationRow({ id: 'wall-color1-b', effectiveAreaSf: 80, rawPaintGallons: 0.8 }),
        wallCalculationRow({ id: 'wall-color2-active', effectiveAreaSf: 50, rawPaintGallons: 0.6 }),
      ],
    }))

    expect(materialPlanning.wallRows).toHaveLength(1)
    expect(materialPlanning.wallRows[0]).toMatchObject({
      id: 'COLOR2',
      label: 'Accent',
      colorName: 'Accent',
    })
    expect(materialPlanning.wallRows.some((row) => row.id === 'COLOR1')).toBe(false)
  })


  it('keeps wall group labels and override keys stable when scopes are reordered', () => {
    const original = buildVm({
      wallScopes: [
        wallScope({ id: 'wall-1', colorId: 'COLOR1', overridePaintGallons: '4' }),
        wallScope({ id: 'wall-2', colorId: 'COLOR2' }),
      ],
      ceilingScopes: [],
      trimScopes: [],
    })
    const reordered = buildVm({
      wallScopes: [
        wallScope({ id: 'wall-2', colorId: 'COLOR2' }),
        wallScope({ id: 'wall-1', colorId: 'COLOR1', overridePaintGallons: '4' }),
      ],
      ceilingScopes: [],
      trimScopes: [],
    })

    expect(original.wallRows.find((row) => row.id === 'COLOR1')).toMatchObject({
      label: 'Primary',
      colorName: 'Primary',
      overrideKey: 'walls:color:COLOR1',
    })
    expect(reordered.wallRows.find((row) => row.id === 'COLOR1')).toMatchObject({
      label: 'Primary',
      colorName: 'Primary',
      overrideKey: 'walls:color:COLOR1',
    })
    expect(original.activeOverrides.find((override) => override.key === 'walls:color:COLOR1')).toMatchObject({
      key: 'walls:color:COLOR1',
      itemName: 'Primary',
    })
    expect(reordered.activeOverrides.find((override) => override.key === 'walls:color:COLOR1')).toMatchObject({
      key: 'walls:color:COLOR1',
      itemName: 'Primary',
    })
  })


  it('uses deterministic fallback identity for walls without a color selection', () => {
    const vm = buildVm({
      wallScopes: [
        wallScope({
          id: 'wall-unassigned',
          colorId: '',
          scopeName: 'Powder bath walls',
          overridePaintGallons: '2',
        }),
      ],
      ceilingScopes: [],
      trimScopes: [],
      wallCalculations: [
        wallCalculationRow({
          id: 'wall-unassigned',
          effectiveAreaSf: 80,
          rawPaintGallons: 0.9,
        }),
      ],
      rollers: [
        {
          id: 'roller-wall-unassigned',
          scope: 'Wall',
          wallColorId: 'scope:wall-unassigned',
          rollerSizeIn: '9',
          coversQty: '1',
          notes: '',
          position: 0,
        },
      ],
    })

    expect(vm.wallRows[0]).toMatchObject({
      id: 'scope:wall-unassigned',
      label: 'Powder bath walls',
      colorName: 'Unassigned',
      overrideKey: 'walls:scope:wall-unassigned',
    })
    expect(vm.wallRollerRows[0]).toMatchObject({
      id: 'wall:scope:wall-unassigned',
      label: 'Powder bath walls',
      errors: [],
    })
    expect(vm.activeOverrides[0]).toMatchObject({
      key: 'walls:scope:wall-unassigned',
      itemName: 'Powder bath walls',
    })
  })

})
