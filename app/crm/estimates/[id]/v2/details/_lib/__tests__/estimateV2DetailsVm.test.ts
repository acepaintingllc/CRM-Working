import { describe, expect, it } from 'vitest'
import {
  buildEstimateV2DetailsVm,
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
  type BuildDetailsVmParams,
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
import type {
  EstimateV2CeilingScopeDraft,
  EstimateV2RoomDraft,
  EstimateV2TrimScopeDraft,
  EstimateV2WallScopeDraft,
} from '@/types/estimator/v2'

type DetailsVm = ReturnType<typeof buildEstimateV2DetailsVm>

function validationMessages(vm: DetailsVm) {
  return vm.validationIssues.map((issue) => issue.message)
}

function validationIds(vm: DetailsVm) {
  return vm.validationIssues.map((issue) => issue.id)
}

function testIssue(patch: {
  id?: string
  message: string
  section?: 'material' | 'rollers' | 'rates' | 'save' | 'unknown'
  targetId?: string
  field?: string
  severity?: 'blocking' | 'warning'
}) {
  return {
    id: patch.id ?? `test:${patch.message}`,
    section: patch.section ?? 'unknown',
    targetId: patch.targetId ?? 'test',
    field: patch.field,
    severity: patch.severity ?? 'blocking',
    message: patch.message,
  }
}

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
    baseboardOpeningCount: '',
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

function wallCalculationRow(params: {
  id: string
  effectiveAreaSf: number | null
  rawPaintGallons: number | null
}) {
  return params
}

function ceilingCalculationRow(params: {
  id: string
  effectiveAreaSf: number | null
  rawPaintGallons: number | null
}) {
  return params
}

function trimCalculationRow(params: {
  id: string
  effectiveMeasurement: number | null
  rawPaintGallons: number | null
}) {
  return params
}

function buildVmParams(overrides: Partial<BuildDetailsVmParams> = {}): BuildDetailsVmParams {
  return {
    rooms,
    wallScopes: [wallScope({}), wallScope({ id: 'wall-2', colorId: 'COLOR2' })],
    ceilingScopes: [ceilingScope({})],
    trimScopes: [trimScope({})],
    wallCalculations: [
      wallCalculationRow({ id: 'wall-1', effectiveAreaSf: 100, rawPaintGallons: 1.2 }),
      wallCalculationRow({ id: 'wall-2', effectiveAreaSf: 50, rawPaintGallons: 0.6 }),
    ],
    ceilingCalculations: [
      ceilingCalculationRow({ id: 'ceil-1', effectiveAreaSf: 75, rawPaintGallons: 0.7 }),
    ],
    trimCalculations: [
      trimCalculationRow({ id: 'trim-1', effectiveMeasurement: 40, rawPaintGallons: 0.2 }),
    ],
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
  }
}

function buildVm(overrides: Partial<BuildDetailsVmParams> = {}) {
  return buildEstimateV2DetailsVm(buildVmParams(overrides))
}

describe('estimate details VM', () => {
  it('formats details display numbers with the shared one-decimal formatter', () => {
    expect(formatDetailsNumber(1234.56)).toBe('1,234.6')
    expect(formatDetailsNumber(2)).toBe('2')
  })

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

  it('builds the roller planning VM from material rows and scoped option pools', () => {
    const params = buildVmParams({
      rollers: [
        {
          id: 'roller-wall-1',
          scope: 'Wall',
          wallColorId: 'COLOR1',
          selectedOptionId: 'WALL_9',
          rollerSizeIn: '9',
          coversQty: '2',
          notes: '',
          position: 0,
        },
      ],
    })
    const materialPlanning = buildEstimateV2MaterialPlanningVm(params)
    const rollerPlanning = buildEstimateV2RollerPlanningVm({
      materialPlanning,
      rollerOptions: params.rollerOptions,
      rollers: params.rollers,
    })

    expect(rollerPlanning.wallRollerOptions.map((option) => option.id)).toEqual(['WALL_9'])
    expect(rollerPlanning.ceilingRollerOptions.map((option) => option.id)).toEqual(['CEIL_14'])
    expect(rollerPlanning.trimApplicatorOptions.map((option) => option.id)).toEqual(['TRIM_4'])
    expect(rollerPlanning.wallRollerRows.find((row) => row.id === 'wall:COLOR1')).toMatchObject({
      coverId: 'WALL_9',
      quantity: '2',
    })
    expect(rollerPlanning.ceilingRollerRow).toMatchObject({ id: 'ceiling' })
    expect(rollerPlanning.trimApplicatorRow).toBeNull()
  })

  it('builds validation and totals VMs from focused orchestration helpers', () => {
    const params = buildVmParams({
      pricingSummary: {
        rawLaborHours: 0,
        rawLaborDays: 0,
        effectiveLaborDays: 0,
        effectiveLaborHours: 0,
        laborCost: 0,
        wallPaintMaterialCost: 60,
        ceilingPaintMaterialCost: 10,
        trimPaintMaterialCost: 5,
        paintMaterialCost: 75,
        primerMaterialCost: 0,
        supplyCost: 12,
        prePolicyTotal: 0,
        postLaborPolicyTotal: 0,
        minimumAdjustmentAmount: 0,
        finalTotal: 0,
        rooms: [],
        trimPaint: null,
      },
    })
    const materialPlanning = buildEstimateV2MaterialPlanningVm(params)
    const rollerPlanning = buildEstimateV2RollerPlanningVm({
      materialPlanning,
      rollerOptions: params.rollerOptions,
      rollers: params.rollers,
    })
    const validation = buildEstimateV2ValidationVm({ materialPlanning, rollerPlanning })
    const totals = buildEstimateV2TotalsVm({
      materialPlanning,
      pricingSummary: params.pricingSummary,
    })

    expect(validation.canContinueToSummary).toBe(false)
    expect(validation.continueBlockedReason).toBe('Primary roller cover is required')
    expect(validation.validationSummary).toMatchObject({
      status: 'blocked',
      title: 'Summary is blocked',
    })
    expect(totals.gallonsByScope).toEqual({ walls: 3, ceilings: 1, trim: 1, total: 5 })
    expect(totals.materialCards).toContainEqual({
      label: 'Current Calculated Material Cost',
      finalValue: '$87',
      calculatedValue: 'Pricing summary paint + supplies',
      overridden: false,
    })
  })

  it('blocks summary with clear empty states when no material scopes are active', () => {
    const vm = buildVm({
      wallScopes: [wallScope({ include: 'N' })],
      ceilingScopes: [ceilingScope({ include: 'N' })],
      trimScopes: [trimScope({ include: 'N' })],
      wallCalculations: [],
      ceilingCalculations: [],
      trimCalculations: [],
    })

    expect(vm.wallRows).toEqual([])
    expect(vm.ceilingRow).toBeNull()
    expect(vm.trimRow).toBeNull()
    expect(vm.materialPlanningSections.walls.emptyMessage).toBe(
      'There are no active wall scopes to plan paint or roller covers for.'
    )
    expect(vm.materialPlanningSections.ceilings.description).toBe('No active ceiling scopes.')
    expect(vm.materialPlanningSections.trim.description).toBe('No active trim scopes.')
    expect(validationIds(vm)).toContain('material:active-scopes:empty')
    expect(validationMessages(vm)).toContain(
      'Add at least one active wall, ceiling, or trim scope before continuing.'
    )
    expect(vm.canContinueToSummary).toBe(false)
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

  it('detects grouped override conflicts from the focused material helper', () => {
    expect(
      resolveGroupedOverride({
        label: 'Primary',
        targetId: 'COLOR1',
        scopes: [{ id: 'wall-1' }, { id: 'wall-2' }],
        valuesByScopeId: new Map([
          ['wall-1', '4'],
          ['wall-2', '5'],
        ]),
      })
    ).toMatchObject({
      overrideGallons: '4',
      ownerScopeId: 'wall-1',
      errors: [
        {
          id: 'material:COLOR1:overrideGallons:conflicting-saved-values',
          section: 'material',
          targetId: 'COLOR1',
          field: 'overrideGallons',
          severity: 'blocking',
          message:
            'Primary has conflicting saved gallon overrides across grouped scopes; apply or clear the grouped override to normalize it to the first active scope.',
        },
      ],
    })
  })

  it('resolves grouped override owners deterministically when scope order changes', () => {
    const scopes = [{ id: 'wall-b' }, { id: 'wall-a' }]

    expect(
      resolveGroupedOverride({
        label: 'Primary',
        targetId: 'COLOR1',
        scopes,
        valuesByScopeId: new Map([['wall-a', '4']]),
      })
    ).toMatchObject({
      overrideGallons: '4',
      ownerScopeId: 'wall-a',
    })

    expect(
      resolveGroupedOverride({
        label: 'Primary',
        targetId: 'COLOR1',
        scopes,
        valuesByScopeId: new Map(),
      })
    ).toMatchObject({
      overrideGallons: '',
      ownerScopeId: 'wall-a',
    })
  })

  it('hydrates roller state from the focused roller helper', () => {
    expect(
      resolveRollerRowState({
        label: 'Primary',
        targetId: 'wall:COLOR1',
        draft: {
          id: 'roller-wall-1',
          scope: 'Wall',
          wallColorId: 'COLOR1',
          rollerSizeIn: '9',
          coversQty: '2',
          notes: 'Saved note',
          position: 0,
        },
        options: [{ id: 'WALL_9', label: 'Wall 9"', scope: 'Wall', sizeIn: 9, priceEach: 6 }],
        scope: 'Wall',
      })
    ).toEqual({
      coverId: 'WALL_9',
      quantity: '2',
      notes: 'Saved note',
      hydrationErrors: [],
    })
  })

  it('hydrates roller state by saved active selected option id before size fallback', () => {
    expect(
      resolveRollerRowState({
        label: 'Primary',
        targetId: 'wall:COLOR1',
        draft: {
          id: 'roller-wall-1',
          scope: 'Wall',
          wallColorId: 'COLOR1',
          selectedOptionId: 'WALL_9_PREMIUM',
          rollerSizeIn: '9',
          coversQty: '2',
          notes: 'Saved premium',
          position: 0,
        },
        options: [
          { id: 'WALL_9_STANDARD', label: 'Wall standard 9"', scope: 'Wall', sizeIn: 9, priceEach: 6 },
          { id: 'WALL_9_PREMIUM', label: 'Wall premium 9"', scope: 'Wall', sizeIn: 9, priceEach: 8 },
        ],
        scope: 'Wall',
      })
    ).toEqual({
      coverId: 'WALL_9_PREMIUM',
      quantity: '2',
      notes: 'Saved premium',
      hydrationErrors: [],
    })
  })

  it('falls back to a unique saved size when saved selected option id is stale', () => {
    expect(
      resolveRollerRowState({
        label: 'Primary',
        targetId: 'wall:COLOR1',
        draft: {
          id: 'roller-wall-1',
          scope: 'Wall',
          wallColorId: 'COLOR1',
          selectedOptionId: 'WALL_9_ARCHIVED',
          rollerSizeIn: '9',
          coversQty: '2',
          notes: 'Saved stale id',
          position: 0,
        },
        options: [
          { id: 'WALL_9_REPLACEMENT', label: 'Wall replacement 9"', scope: 'Wall', sizeIn: 9, priceEach: 6 },
          { id: 'WALL_12', label: 'Wall 12"', scope: 'Wall', sizeIn: 12, priceEach: 7 },
        ],
        scope: 'Wall',
      })
    ).toEqual({
      coverId: 'WALL_9_REPLACEMENT',
      quantity: '2',
      notes: 'Saved stale id',
      hydrationErrors: [],
    })
  })

  it('blocks stale saved selected option id when no safe saved-size fallback exists', () => {
    expect(
      resolveRollerRowState({
        label: 'Primary',
        targetId: 'wall:COLOR1',
        draft: {
          id: 'roller-wall-1',
          scope: 'Wall',
          wallColorId: 'COLOR1',
          selectedOptionId: 'WALL_9_ARCHIVED',
          rollerSizeIn: '9',
          coversQty: '2',
          notes: 'Saved stale id',
          position: 0,
        },
        options: [{ id: 'WALL_12', label: 'Wall 12"', scope: 'Wall', sizeIn: 12, priceEach: 7 }],
        scope: 'Wall',
      })
    ).toEqual({
      coverId: '',
      quantity: '2',
      notes: 'Saved stale id',
      hydrationErrors: [
        {
          id: 'rollers:wall:COLOR1:coverId:stale-option',
          section: 'rollers',
          targetId: 'wall:COLOR1',
          field: 'coverId',
          severity: 'blocking',
          message:
            'Primary saved wall roller cover option WALL_9_ARCHIVED is no longer active; select an active option before continuing.',
        },
      ],
    })
  })

  it('keeps saved-size ambiguity blocking when saved selected option id is stale', () => {
    const state = resolveRollerRowState({
      label: 'Primary',
      targetId: 'wall:COLOR1',
      draft: {
        id: 'roller-wall-1',
        scope: 'Wall',
        wallColorId: 'COLOR1',
        selectedOptionId: 'WALL_9_ARCHIVED',
        rollerSizeIn: '9',
        coversQty: '2',
        notes: 'Saved stale id',
        position: 0,
      },
      options: [
        { id: 'WALL_9_STANDARD', label: 'Wall standard 9"', scope: 'Wall', sizeIn: 9, priceEach: 6 },
        { id: 'WALL_9_PREMIUM', label: 'Wall premium 9"', scope: 'Wall', sizeIn: 9, priceEach: 8 },
      ],
      scope: 'Wall',
    })

    expect(state).toMatchObject({
      coverId: '',
      quantity: '2',
      notes: 'Saved stale id',
    })
    expect(state.hydrationErrors).toEqual([
      {
        id: 'rollers:wall:COLOR1:coverId:ambiguous-size',
        section: 'rollers',
        targetId: 'wall:COLOR1',
        field: 'coverId',
        severity: 'blocking',
        message:
          'Primary saved wall roller cover size 9" matches multiple active options; make sizes unique before continuing.',
      },
    ])
  })

  it('maps roller quantity normalization reasons to specific validation issues', () => {
    const option = { id: 'WALL_9', label: 'Wall 9"', scope: 'Wall' as const, sizeIn: 9, priceEach: 6 }
    const optionsState = { status: 'loaded' as const, options: [option], message: null }
    const baseRow = {
      id: 'wall:COLOR1',
      label: 'Primary',
      sublabel: 'Primary',
      sqFt: 100,
      product: 'Wall Paint',
      coverId: 'WALL_9',
      notes: '',
      errors: [],
    }
    const cases = [
      ['', 'rollers:wall:COLOR1:quantity:required', 'Primary quantity is required'],
      ['abc', 'rollers:wall:COLOR1:quantity:invalid-number', 'Primary quantity must be a number'],
      ['1.5', 'rollers:wall:COLOR1:quantity:whole-number', 'Primary quantity must be a whole number'],
      ['0', 'rollers:wall:COLOR1:quantity:positive-number', 'Primary quantity must be greater than zero'],
      ['-1', 'rollers:wall:COLOR1:quantity:positive-number', 'Primary quantity must be greater than zero'],
    ] as const

    for (const [quantity, id, message] of cases) {
      const issues = validateRollerRow(
        { ...baseRow, quantity },
        optionsState,
        [option]
      )
      expect(issues).toContainEqual({
        id,
        section: 'rollers',
        targetId: 'wall:COLOR1',
        field: 'quantity',
        severity: 'blocking',
        message,
      })
    }

    expect(validateRollerRow({ ...baseRow, quantity: ' 2 ' }, optionsState, [option])).toEqual([])
  })

  it('builds validation summary and material cards from focused validation helpers', () => {
    const blocked = createValidationSummary([
      testIssue({ message: 'Primary roller cover is required' }),
    ])
    const ready = createValidationSummary([])

    expect(blocked).toMatchObject({
      status: 'blocked',
      title: 'Summary is blocked',
      message: '1 required item need attention before continuing.',
    })
    expect(ready).toMatchObject({
      status: 'ready',
      title: 'Ready to continue',
    })

    const wallRows = createWallRows({
      rooms,
      wallScopes: [wallScope({ overridePaintGallons: '4' })],
      ceilingScopes: [],
      trimScopes: [],
      wallCalculations: [
        wallCalculationRow({ id: 'wall-1', effectiveAreaSf: 100, rawPaintGallons: 1.2 }),
      ],
      ceilingCalculations: [],
      trimCalculations: [],
      pricingSummary: null,
      paintProductLabelById: new Map([['P-WALL', 'Wall Paint']]),
      colorLabelById: new Map([['COLOR1', 'Primary']]),
      rollerOptions: [],
      rollers: [],
    })

    expect(
      createMaterialCards({
        wallRows,
        ceilingRow: null,
        trimRow: null,
        activeOverrides: [{ key: 'walls:color:COLOR1', itemName: 'Primary', originalValue: 2, newValue: 4 }],
        estimatedMaterialCost: 12.3,
      })
    ).toEqual([
      { label: 'Wall Paint', finalValue: '4 gal', calculatedValue: '2 rounded', overridden: true },
      { label: 'Ceiling Paint', finalValue: '0 gal', calculatedValue: '0 rounded', overridden: false },
      { label: 'Trim Paint', finalValue: '0 gal', calculatedValue: '0 rounded', overridden: false },
      { label: 'Total Paint', finalValue: '4 gal', calculatedValue: '1.2 calc', overridden: true },
      {
        label: 'Current Calculated Material Cost',
        finalValue: '$12',
        calculatedValue: 'Pricing summary paint + supplies',
        overridden: false,
      },
    ])
  })

  it('keeps current calculated material cost separate from wall override planning gallons', () => {
    const vm = buildVm({
      wallScopes: [wallScope({ overridePaintGallons: '4' })],
      ceilingScopes: [],
      trimScopes: [],
      pricingSummary: {
        rawLaborHours: 0,
        rawLaborDays: 0,
        effectiveLaborDays: 0,
        effectiveLaborHours: 0,
        laborCost: 0,
        wallPaintMaterialCost: 90,
        ceilingPaintMaterialCost: 0,
        trimPaintMaterialCost: 0,
        paintMaterialCost: 90,
        primerMaterialCost: 0,
        supplyCost: 12,
        prePolicyTotal: 0,
        postLaborPolicyTotal: 0,
        minimumAdjustmentAmount: 0,
        finalTotal: 0,
        rooms: [],
        trimPaint: null,
      },
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

    expect(vm.gallonsByScope).toMatchObject({ walls: 4, ceilings: 0, trim: 0, total: 4 })
    expect(vm.materialCards).toContainEqual({
      label: 'Wall Paint',
      finalValue: '4 gal',
      calculatedValue: '2 rounded',
      overridden: true,
    })
    expect(vm.materialCards).toContainEqual({
      label: 'Current Calculated Material Cost',
      finalValue: '$102',
      calculatedValue: 'Pricing summary paint + supplies',
      overridden: false,
    })
  })

  it('keeps current calculated material cost separate from ceiling override planning gallons', () => {
    const vm = buildVm({
      wallScopes: [],
      ceilingScopes: [ceilingScope({ overridePaintGallons: '3' })],
      trimScopes: [],
      pricingSummary: {
        rawLaborHours: 0,
        rawLaborDays: 0,
        effectiveLaborDays: 0,
        effectiveLaborHours: 0,
        laborCost: 0,
        wallPaintMaterialCost: 0,
        ceilingPaintMaterialCost: 45,
        trimPaintMaterialCost: 0,
        paintMaterialCost: 45,
        primerMaterialCost: 0,
        supplyCost: 5,
        prePolicyTotal: 0,
        postLaborPolicyTotal: 0,
        minimumAdjustmentAmount: 0,
        finalTotal: 0,
        rooms: [],
        trimPaint: null,
      },
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

    expect(vm.gallonsByScope).toMatchObject({ walls: 0, ceilings: 3, trim: 0, total: 3 })
    expect(vm.materialCards).toContainEqual({
      label: 'Ceiling Paint',
      finalValue: '3 gal',
      calculatedValue: '1 rounded',
      overridden: true,
    })
    expect(vm.materialCards).toContainEqual({
      label: 'Current Calculated Material Cost',
      finalValue: '$50',
      calculatedValue: 'Pricing summary paint + supplies',
      overridden: false,
    })
  })

  it('keeps current calculated material cost separate from trim override planning gallons', () => {
    const vm = buildVm({
      wallScopes: [],
      ceilingScopes: [],
      trimScopes: [trimScope({ overrideGallons: '2' })],
      pricingSummary: {
        rawLaborHours: 0,
        rawLaborDays: 0,
        effectiveLaborDays: 0,
        effectiveLaborHours: 0,
        laborCost: 0,
        wallPaintMaterialCost: 0,
        ceilingPaintMaterialCost: 0,
        trimPaintMaterialCost: 30,
        paintMaterialCost: 30,
        primerMaterialCost: 0,
        supplyCost: 7,
        prePolicyTotal: 0,
        postLaborPolicyTotal: 0,
        minimumAdjustmentAmount: 0,
        finalTotal: 0,
        rooms: [],
        trimPaint: null,
      },
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

    expect(vm.gallonsByScope).toMatchObject({ walls: 0, ceilings: 0, trim: 2, total: 2 })
    expect(vm.materialCards).toContainEqual({
      label: 'Trim Paint',
      finalValue: '2 gal',
      calculatedValue: '1 rounded',
      overridden: true,
    })
    expect(vm.materialCards).toContainEqual({
      label: 'Current Calculated Material Cost',
      finalValue: '$37',
      calculatedValue: 'Pricing summary paint + supplies',
      overridden: false,
    })
  })

  it('dedupes structured validation issues by stable id while preserving first-seen order', () => {
    const sharedFirst = testIssue({
      id: 'rates:roller-options:unavailable',
      section: 'rates',
      targetId: 'roller-options',
      message: 'Rates unavailable',
    })
    const sharedDuplicate = testIssue({
      id: 'rates:roller-options:unavailable',
      section: 'rates',
      targetId: 'roller-options',
      message: 'Different copy should not win',
    })
    const rollerRequired = testIssue({
      id: 'rollers:wall:COLOR1:coverId:required',
      section: 'rollers',
      targetId: 'wall:COLOR1',
      field: 'coverId',
      message: 'Primary roller cover is required',
    })
    const wallRow = {
      id: 'COLOR1',
      label: 'Primary',
      colorId: 'COLOR1',
      colorName: 'Primary',
      rooms: ['Living'],
      sqFt: 100,
      coats: '2',
      product: 'Wall Paint',
      calculationStatus: 'available' as const,
      calculatedGallons: 1.2,
      roundedGallons: 2,
      overrideGallons: '',
      finalGallons: 2,
      overrideKey: 'walls:color:COLOR1',
      overrideOwnerScopeId: null,
      hasOverride: false,
      errors: [sharedFirst],
    }
    const rollerRow = {
      id: 'wall:COLOR1',
      label: 'Primary',
      sublabel: 'Primary',
      sqFt: 100,
      product: 'Wall Paint',
      coverId: '',
      quantity: '',
      notes: '',
      errors: [sharedDuplicate, rollerRequired],
    }

    const issues = createValidationIssues({
      wallRows: [wallRow],
      ceilingRow: null,
      trimRow: null,
      wallRollerRows: [rollerRow],
      ceilingRollerRow: null,
      trimApplicatorRow: null,
    })

    expect(issues.map((issue) => issue.id)).toEqual([
      'rates:roller-options:unavailable',
      'rollers:wall:COLOR1:coverId:required',
    ])
    expect(issues.map((issue) => issue.message)).toEqual([
      'Rates unavailable',
      'Primary roller cover is required',
    ])
  })

  it('separates blocking validation issues from warnings', () => {
    const warning = testIssue({
      id: 'material:COLOR1:note',
      section: 'material',
      targetId: 'COLOR1',
      severity: 'warning',
      message: 'Warning copy',
    })
    const blocking = testIssue({
      id: 'rollers:wall:COLOR1:quantity:required',
      section: 'rollers',
      targetId: 'wall:COLOR1',
      field: 'quantity',
      message: 'Primary quantity is required',
    })

    expect(getBlockingValidationIssues([warning])).toEqual([])
    expect(getBlockingValidationIssues([warning, blocking])).toEqual([blocking])
    expect(createValidationSummary(getBlockingValidationIssues([warning]))).toMatchObject({
      status: 'ready',
      title: 'Ready to continue',
    })
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

  it('matches unassigned wall roller drafts after save and reload normalization', () => {
    const vm = buildVm({
      wallScopes: [
        wallScope({
          id: 'wall-unassigned',
          colorId: '',
          scopeName: 'Powder bath walls',
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
          selectedOptionId: 'WALL_9',
          rollerSizeIn: '9',
          coversQty: '2',
          notes: 'Saved unassigned scope',
          position: 0,
        },
      ],
    })

    expect(vm.wallRollerRows[0]).toMatchObject({
      id: 'wall:scope:wall-unassigned',
      coverId: 'WALL_9',
      quantity: '2',
      notes: 'Saved unassigned scope',
      errors: [],
    })
  })

  it('continues matching color-based wall roller drafts case-insensitively', () => {
    const vm = buildVm({
      rollers: [
        {
          id: 'roller-wall-1',
          scope: 'Wall',
          wallColorId: 'color1',
          selectedOptionId: 'WALL_9',
          rollerSizeIn: '9',
          coversQty: '1',
          notes: '',
          position: 0,
        },
        {
          id: 'roller-wall-2',
          scope: 'Wall',
          wallColorId: 'COLOR2',
          selectedOptionId: 'WALL_9',
          rollerSizeIn: '9',
          coversQty: '1',
          notes: '',
          position: 1,
        },
        {
          id: 'roller-ceiling',
          scope: 'Ceiling',
          wallColorId: '',
          selectedOptionId: 'CEIL_14',
          rollerSizeIn: '14',
          coversQty: '1',
          notes: '',
          position: 2,
        },
        {
          id: 'roller-trim',
          scope: 'Trim',
          wallColorId: '',
          selectedOptionId: 'TRIM_4',
          rollerSizeIn: '4',
          coversQty: '1',
          notes: '',
          position: 3,
        },
      ],
    })

    expect(vm.wallRollerRows.find((row) => row.id === 'wall:COLOR1')).toMatchObject({
      coverId: 'WALL_9',
      quantity: '1',
    })
  })

  it('validates missing required roller settings', () => {
    const vm = buildVm()
    expect(validationMessages(vm)).toContain('Primary roller cover is required')
    expect(validationMessages(vm)).toContain('Ceilings quantity is required')
    expect(validationMessages(vm)).not.toContain('Trim & Baseboards applicator is required')
    expect(vm.canContinueToSummary).toBe(false)
    expect(vm.validationSummary).toMatchObject({
      status: 'blocked',
      title: 'Summary is blocked',
    })
  })

  it('validates roller quantities with the canonical whole-number rule', () => {
    const vm = buildVm({
      rollers: [
        {
          id: 'roller-wall-1',
          scope: 'Wall',
          wallColorId: 'COLOR1',
          selectedOptionId: 'WALL_9',
          rollerSizeIn: '9',
          coversQty: '1.5',
          notes: '',
          position: 0,
        },
        {
          id: 'roller-wall-2',
          scope: 'Wall',
          wallColorId: 'COLOR2',
          selectedOptionId: 'WALL_9',
          rollerSizeIn: '9',
          coversQty: ' 2 ',
          notes: '',
          position: 1,
        },
        {
          id: 'roller-ceiling',
          scope: 'Ceiling',
          wallColorId: '',
          selectedOptionId: 'CEIL_14',
          rollerSizeIn: '14',
          coversQty: '1',
          notes: '',
          position: 2,
        },
        {
          id: 'roller-trim',
          scope: 'Trim',
          wallColorId: '',
          selectedOptionId: 'TRIM_4',
          rollerSizeIn: '4',
          coversQty: '1',
          notes: '',
          position: 3,
        },
      ],
    })

    expect(vm.wallRollerRows.find((row) => row.id === 'wall:COLOR2')).toMatchObject({
      quantity: '2',
      errors: [],
    })
    expect(validationIds(vm)).toContain('rollers:wall:COLOR1:quantity:whole-number')
    expect(validationMessages(vm)).toContain('Primary quantity must be a whole number')
    expect(vm.canContinueToSummary).toBe(false)
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
    expect(validationMessages(vm)).toContain('Roller and applicator options failed to load.')
    expect(validationMessages(vm)).not.toContain('Primary roller cover is required')
    expect(validationMessages(vm)).not.toContain('Trim & Baseboards applicator is required')
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
    expect(validationMessages(vm)).toContain('Wall roller cover options are not configured')
    expect(validationMessages(vm)).toContain('Ceiling roller cover options are not configured')
    expect(validationMessages(vm)).not.toContain('Trim applicator options are not configured')
    expect(validationMessages(vm)).not.toContain('Primary roller cover is required')
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

    expect(validationMessages(vm)).toContain('Primary override gallons must be a zero or positive number')
    expect(vm.canContinueToSummary).toBe(false)
    expect(vm.continueBlockedReason).toBe('Primary override gallons must be a zero or positive number')
  })

  it('uses consistent optional gallon override semantics across material row types', () => {
    const cases = [
      {
        value: '',
        finalGallons: { wall: 2, ceiling: 1, trim: 1 },
        hasOverride: false,
        invalid: false,
      },
      {
        value: '   ',
        finalGallons: { wall: 2, ceiling: 1, trim: 1 },
        hasOverride: false,
        invalid: false,
      },
      {
        value: '0',
        finalGallons: { wall: 0, ceiling: 0, trim: 0 },
        hasOverride: true,
        invalid: false,
      },
      {
        value: '2.5',
        finalGallons: { wall: 2.5, ceiling: 2.5, trim: 2.5 },
        hasOverride: true,
        invalid: false,
      },
      {
        value: '-1',
        finalGallons: { wall: 2, ceiling: 1, trim: 1 },
        hasOverride: false,
        invalid: true,
      },
      {
        value: 'abc',
        finalGallons: { wall: 2, ceiling: 1, trim: 1 },
        hasOverride: false,
        invalid: true,
      },
    ] as const

    for (const testCase of cases) {
      const displayOverrideGallons = testCase.value.trim() ? testCase.value : ''
      const vm = buildVm({
        wallScopes: [wallScope({ overridePaintGallons: testCase.value })],
        ceilingScopes: [ceilingScope({ overridePaintGallons: testCase.value })],
        trimScopes: [trimScope({ overrideGallons: testCase.value })],
      })

      expect(vm.wallRows[0], `wall override ${JSON.stringify(testCase.value)}`).toMatchObject({
        overrideGallons: displayOverrideGallons,
        roundedGallons: 2,
        finalGallons: testCase.finalGallons.wall,
        hasOverride: testCase.hasOverride,
      })
      expect(vm.ceilingRow, `ceiling override ${JSON.stringify(testCase.value)}`).toMatchObject({
        overrideGallons: displayOverrideGallons,
        roundedGallons: 1,
        finalGallons: testCase.finalGallons.ceiling,
        hasOverride: testCase.hasOverride,
      })
      expect(vm.trimRow, `trim override ${JSON.stringify(testCase.value)}`).toMatchObject({
        overrideGallons: displayOverrideGallons,
        roundedGallons: 1,
        finalGallons: testCase.finalGallons.trim,
        hasOverride: testCase.hasOverride,
      })

      const issueIds = validationIds(vm)
      for (const targetId of ['COLOR1', 'ceilings', 'trim']) {
        const invalidIssueId = `material:${targetId}:overrideGallons:invalid-number`
        if (testCase.invalid) {
          expect(issueIds).toContain(invalidIssueId)
        } else {
          expect(issueIds).not.toContain(invalidIssueId)
        }
      }
    }
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

    expect(vm.activeOverrides[0]).toMatchObject({ key: 'walls:color:COLOR1', itemName: 'Primary', newValue: 4 })
    expect(vm.wallRows[0].overrideOwnerScopeId).toBe('wall-1')
    expect(validationMessages(vm)).not.toContain('Primary override requires a reason')
    expect(vm.canContinueToSummary).toBe(true)
  })

  it('ignores inactive grouped material overrides in details planning rows', () => {
    const vm = buildVm({
      wallScopes: [
        wallScope({ id: 'wall-active', colorId: 'COLOR1', overridePaintGallons: '' }),
        wallScope({
          id: 'wall-inactive',
          colorId: 'COLOR1',
          include: 'N',
          overridePaintGallons: '9',
        }),
      ],
      ceilingScopes: [
        ceilingScope({ id: 'ceil-active', overridePaintGallons: '' }),
        ceilingScope({ id: 'ceil-inactive', include: 'N', overridePaintGallons: '8' }),
      ],
      trimScopes: [
        trimScope({ id: 'trim-active', overrideGallons: '' }),
        trimScope({ id: 'trim-inactive', include: 'N', overrideGallons: '7' }),
      ],
      wallCalculations: [
        wallCalculationRow({ id: 'wall-active', effectiveAreaSf: 100, rawPaintGallons: 1.2 }),
      ],
      ceilingCalculations: [
        ceilingCalculationRow({ id: 'ceil-active', effectiveAreaSf: 75, rawPaintGallons: 0.7 }),
      ],
      trimCalculations: [
        trimCalculationRow({ id: 'trim-active', effectiveMeasurement: 40, rawPaintGallons: 0.2 }),
      ],
    })

    expect(vm.wallRows[0]).toMatchObject({
      overrideGallons: '',
      finalGallons: 2,
      hasOverride: false,
      overrideOwnerScopeId: 'wall-active',
    })
    expect(vm.ceilingRow).toMatchObject({
      overrideGallons: '',
      finalGallons: 1,
      hasOverride: false,
      overrideOwnerScopeId: 'ceil-active',
    })
    expect(vm.trimRow).toMatchObject({
      overrideGallons: '',
      finalGallons: 1,
      hasOverride: false,
      overrideOwnerScopeId: 'trim-active',
    })
    expect(vm.validationIssues.map((issue) => issue.id)).not.toEqual(
      expect.arrayContaining([
        'material:COLOR1:overrideGallons:duplicate-saved-values',
        'material:ceilings:overrideGallons:duplicate-saved-values',
        'material:trim:overrideGallons:duplicate-saved-values',
      ])
    )
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
    expect(validationMessages(vm)).toContain(
      'Primary has conflicting saved gallon overrides across grouped scopes; apply or clear the grouped override to normalize it to the first active scope.'
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
    expect(validationMessages(vm)).toContain(
      'Primary has duplicate saved gallon overrides across grouped scopes; apply or clear the grouped override to normalize it to the first active scope.'
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
    expect(validationMessages(vm)).toContain(
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
    expect(validationMessages(vm)).toContain(
      'Trim & Baseboards has duplicate saved gallon overrides across grouped scopes; apply or clear the grouped override to normalize it to the first active scope.'
    )
    expect(vm.canContinueToSummary).toBe(false)
  })

  it('hydrates roller selections from persisted stable option identities', () => {
    const vm = buildVm({
      rollerOptions: [
        { id: 'WALL_9_STANDARD', label: 'Wall standard 9"', scope: 'Wall', sizeIn: 9, priceEach: 6 },
        { id: 'WALL_9_PREMIUM', label: 'Wall premium 9"', scope: 'Wall', sizeIn: 9, priceEach: 8 },
        { id: 'CEIL_14_STANDARD', label: 'Ceiling standard 14"', scope: 'Ceiling', sizeIn: 14, priceEach: 10 },
        { id: 'CEIL_14_WIDE', label: 'Ceiling wide 14"', scope: 'Ceiling', sizeIn: 14, priceEach: 12 },
        { id: 'TRIM_4_STANDARD', label: 'Trim standard 4"', scope: 'Trim', sizeIn: 4, priceEach: 4 },
        { id: 'TRIM_4_DETAIL', label: 'Trim detail 4"', scope: 'Trim', sizeIn: 4, priceEach: 5 },
      ],
      rollers: [
        {
          id: 'roller-wall-1',
          scope: 'Wall',
          wallColorId: 'COLOR1',
          selectedOptionId: 'WALL_9_PREMIUM',
          rollerSizeIn: '9',
          coversQty: '2',
          notes: 'Saved note',
          position: 0,
        },
        {
          id: 'roller-ceiling-1',
          scope: 'Ceiling',
          wallColorId: '',
          selectedOptionId: 'CEIL_14_WIDE',
          rollerSizeIn: '14',
          coversQty: '1',
          notes: '',
          position: 1,
        },
        {
          id: 'applicator-trim-1',
          scope: 'Trim',
          wallColorId: '',
          selectedOptionId: 'TRIM_4_DETAIL',
          rollerSizeIn: '4',
          coversQty: '2',
          notes: 'Saved trim note',
          position: 2,
        },
      ],
    })

    expect(vm.wallRollerRows[0]).toMatchObject({
      coverId: 'WALL_9_PREMIUM',
      quantity: '2',
      notes: 'Saved note',
      errors: [],
    })
    expect(vm.ceilingRollerRow).toMatchObject({
      coverId: 'CEIL_14_WIDE',
      quantity: '1',
      errors: [],
    })
    expect(vm.trimApplicatorRow).toBeNull()
    expect(vm.canContinueToSummary).toBe(false)
    expect(validationMessages(vm)).not.toContain(
      'Primary saved wall roller cover size 9" matches multiple active options; make sizes unique before continuing.'
    )
  })

  it('hydrates persisted roller drafts through normalized row identities', () => {
    const vm = buildVm({
      rollers: [
        {
          id: 'roller-wall-case',
          scope: 'Wall',
          wallColorId: 'color1',
          selectedOptionId: 'WALL_9',
          rollerSizeIn: '9',
          coversQty: '2',
          notes: 'Case-insensitive color',
          position: 0,
        },
        {
          id: 'roller-ceiling-colored',
          scope: 'Ceiling',
          wallColorId: 'COLOR1',
          selectedOptionId: 'CEIL_14',
          rollerSizeIn: '14',
          coversQty: '1',
          notes: 'Aggregate ignores color',
          position: 1,
        },
        {
          id: 'applicator-trim-colored',
          scope: 'Trim',
          wallColorId: 'COLOR2',
          selectedOptionId: 'TRIM_4',
          rollerSizeIn: '4',
          coversQty: '3',
          notes: 'Trim ignores color',
          position: 2,
        },
      ],
    })

    expect(vm.wallRollerRows.find((row) => row.id === 'wall:COLOR1')).toMatchObject({
      coverId: 'WALL_9',
      quantity: '2',
      notes: 'Case-insensitive color',
      errors: [],
    })
    expect(vm.ceilingRollerRow).toMatchObject({
      id: 'ceiling',
      coverId: 'CEIL_14',
      quantity: '1',
      notes: 'Aggregate ignores color',
      errors: [],
    })
    expect(vm.trimApplicatorRow).toBeNull()
  })

  it('hydrates legacy size-only roller selections from persisted roller rows', () => {
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
    expect(vm.trimApplicatorRow).toBeNull()
  })

  it('surfaces a stale saved selected option id through details VM validation', () => {
    const vm = buildVm({
      rollers: [
        {
          id: 'roller-wall-1',
          scope: 'Wall',
          wallColorId: 'COLOR1',
          selectedOptionId: 'WALL_9_ARCHIVED',
          rollerSizeIn: '99',
          coversQty: '2',
          notes: 'Archived option',
          position: 0,
        },
        {
          id: 'roller-wall-2',
          scope: 'Wall',
          wallColorId: 'COLOR2',
          selectedOptionId: 'WALL_9',
          rollerSizeIn: '9',
          coversQty: '1',
          notes: '',
          position: 1,
        },
        {
          id: 'roller-ceiling',
          scope: 'Ceiling',
          wallColorId: '',
          selectedOptionId: 'CEIL_14',
          rollerSizeIn: '14',
          coversQty: '1',
          notes: '',
          position: 2,
        },
        {
          id: 'roller-trim',
          scope: 'Trim',
          wallColorId: '',
          selectedOptionId: 'TRIM_4',
          rollerSizeIn: '4',
          coversQty: '1',
          notes: '',
          position: 3,
        },
      ],
    })

    expect(vm.wallRollerRows.find((row) => row.id === 'wall:COLOR1')).toMatchObject({
      coverId: '',
      quantity: '2',
      notes: 'Archived option',
    })
    expect(validationIds(vm)).toContain('rollers:wall:COLOR1:coverId:stale-option')
    expect(validationMessages(vm)).toContain(
      'Primary saved wall roller cover option WALL_9_ARCHIVED is no longer active; select an active option before continuing.'
    )
    expect(vm.canContinueToSummary).toBe(false)
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
    expect(validationMessages(vm)).toContain(
      'Primary saved wall roller cover size 9" matches multiple active options; make sizes unique before continuing.'
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
    expect(vm.trimApplicatorRow).toBeNull()
    expect(validationMessages(vm)).toContain(
      'Ceilings saved ceiling roller cover size 14" matches multiple active options; make sizes unique before continuing.'
    )
    expect(validationMessages(vm)).not.toContain(
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
            { id: 'WALL_ARCHIVED', display_name: 'Archived wall', scope: 'Wall', size_in: '9', price_each: '1', active: 'N' },
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

    expect(parseRollerCoverOptionsStateFromRatesFlags({ categories: [{}] })).toMatchObject({
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

  it('applies and clears wall grouped gallon overrides on the explicit owner scope', () => {
    const scopes = [
      wallScope({ id: 'wall-inactive', colorId: 'COLOR1', include: 'N', overridePaintGallons: '9' }),
      wallScope({ id: 'wall-1', colorId: 'COLOR1', overridePaintGallons: '1' }),
      wallScope({ id: 'wall-2', colorId: 'COLOR1', overridePaintGallons: '2' }),
      wallScope({ id: 'wall-3', colorId: 'COLOR2', overridePaintGallons: '7' }),
    ]

    expect(
      applyWallGroupGallonOverride(scopes, 'COLOR1', '5', 'wall-2').map((scope) => ({
        id: scope.id,
        overridePaintGallons: scope.overridePaintGallons,
      }))
    ).toEqual([
      { id: 'wall-inactive', overridePaintGallons: '' },
      { id: 'wall-1', overridePaintGallons: '' },
      { id: 'wall-2', overridePaintGallons: '5' },
      { id: 'wall-3', overridePaintGallons: '7' },
    ])

    expect(
      applyWallGroupGallonOverride(scopes, 'COLOR1', '').map((scope) => ({
        id: scope.id,
        overridePaintGallons: scope.overridePaintGallons,
      }))
    ).toEqual([
      { id: 'wall-inactive', overridePaintGallons: '' },
      { id: 'wall-1', overridePaintGallons: '' },
      { id: 'wall-2', overridePaintGallons: '' },
      { id: 'wall-3', overridePaintGallons: '7' },
    ])
  })

  it('applies unassigned wall overrides by stable scope group key', () => {
    const scopes = [
      wallScope({
        id: 'wall-unassigned-a',
        colorId: '',
        scopeName: 'Unassigned A',
        overridePaintGallons: '1',
      }),
      wallScope({
        id: 'wall-unassigned-b',
        colorId: '',
        scopeName: 'Unassigned B',
        overridePaintGallons: '2',
      }),
      wallScope({
        id: 'wall-unassigned-inactive',
        colorId: '',
        scopeName: 'Unassigned inactive',
        include: 'N',
        overridePaintGallons: '8',
      }),
    ]

    expect(
      applyWallGroupGallonOverride(scopes, 'scope:wall-unassigned-b', '6').map((scope) => ({
        id: scope.id,
        overridePaintGallons: scope.overridePaintGallons,
      }))
    ).toEqual([
      { id: 'wall-unassigned-a', overridePaintGallons: '1' },
      { id: 'wall-unassigned-b', overridePaintGallons: '6' },
      { id: 'wall-unassigned-inactive', overridePaintGallons: '8' },
    ])
  })

  it('keeps wall grouped override ownership stable when active scope order changes', () => {
    const firstOrder = [
      wallScope({ id: 'wall-a', colorId: 'COLOR1', position: 0, overridePaintGallons: '1' }),
      wallScope({ id: 'wall-b', colorId: 'COLOR1', position: 1, overridePaintGallons: '' }),
    ]
    const secondOrder = [...firstOrder].reverse()
    const summarize = (scopes: EstimateV2WallScopeDraft[]) =>
      scopes.map((scope) => ({
        id: scope.id,
        overridePaintGallons: scope.overridePaintGallons,
      }))

    expect(summarize(applyWallGroupGallonOverride(firstOrder, 'COLOR1', '5'))).toEqual([
      { id: 'wall-a', overridePaintGallons: '5' },
      { id: 'wall-b', overridePaintGallons: '' },
    ])
    expect(summarize(applyWallGroupGallonOverride(secondOrder, 'COLOR1', '5'))).toEqual([
      { id: 'wall-b', overridePaintGallons: '' },
      { id: 'wall-a', overridePaintGallons: '5' },
    ])
  })

  it('centralizes grouped material override persistence policy', () => {
    const scopes = [
      { id: 'inactive-match', include: 'N', group: 'target', overrideGallons: '9' },
      { id: 'owner', include: 'Y', group: 'target', overrideGallons: '1' },
      { id: 'z-duplicate', include: 'Y', group: 'target', overrideGallons: '2' },
      { id: 'other', include: 'Y', group: 'other', overrideGallons: '7' },
    ]

    expect(
      applyGroupedMaterialOverridePersistencePolicy({
        scopes,
        value: '4',
        belongsToGroup: (scope) => scope.group === 'target',
        getPersistedValue: (scope) => scope.overrideGallons,
        applyValue: (scope, value) => ({ ...scope, overrideGallons: value }),
      })
    ).toEqual([
      { id: 'inactive-match', include: 'N', group: 'target', overrideGallons: '' },
      { id: 'owner', include: 'Y', group: 'target', overrideGallons: '4' },
      { id: 'z-duplicate', include: 'Y', group: 'target', overrideGallons: '' },
      { id: 'other', include: 'Y', group: 'other', overrideGallons: '7' },
    ])
  })

  it('applies and clears ceiling grouped gallon overrides on the explicit owner scope', () => {
    const scopes = [
      ceilingScope({ id: 'ceil-inactive', include: 'N', overridePaintGallons: '9' }),
      ceilingScope({ id: 'ceil-1', overridePaintGallons: '1' }),
      ceilingScope({ id: 'ceil-2', overridePaintGallons: '2' }),
    ]

    expect(applyCeilingGallonOverride(scopes, '3', 'ceil-2').map((scope) => scope.overridePaintGallons)).toEqual([
      '',
      '',
      '3',
    ])
    expect(applyCeilingGallonOverride(scopes, '').map((scope) => scope.overridePaintGallons)).toEqual([
      '',
      '',
      '',
    ])
  })

  it('applies and clears trim grouped gallon overrides on the explicit owner scope', () => {
    const scopes = [
      trimScope({ id: 'trim-inactive', include: 'N', overrideGallons: '9' }),
      trimScope({ id: 'trim-1', overrideGallons: '1' }),
      trimScope({ id: 'trim-2', overrideGallons: '2' }),
    ]

    expect(applyTrimGallonOverride(scopes, '2', 'trim-2').map((scope) => scope.overrideGallons)).toEqual([
      '',
      '',
      '2',
    ])
    expect(applyTrimGallonOverride(scopes, '').map((scope) => scope.overrideGallons)).toEqual([
      '',
      '',
      '',
    ])
  })

  it('keeps ceiling and trim grouped override ownership stable when scope order changes', () => {
    const ceilingScopes = [
      ceilingScope({ id: 'ceil-a', overridePaintGallons: '1' }),
      ceilingScope({ id: 'ceil-b', overridePaintGallons: '' }),
    ]
    const trimScopes = [
      trimScope({ id: 'trim-a', overrideGallons: '1' }),
      trimScope({ id: 'trim-b', overrideGallons: '' }),
    ]

    expect(
      applyCeilingGallonOverride([...ceilingScopes].reverse(), '4').map((scope) => ({
        id: scope.id,
        overridePaintGallons: scope.overridePaintGallons,
      }))
    ).toEqual([
      { id: 'ceil-b', overridePaintGallons: '' },
      { id: 'ceil-a', overridePaintGallons: '4' },
    ])
    expect(
      applyTrimGallonOverride([...trimScopes].reverse(), '3').map((scope) => ({
        id: scope.id,
        overrideGallons: scope.overrideGallons,
      }))
    ).toEqual([
      { id: 'trim-b', overrideGallons: '' },
      { id: 'trim-a', overrideGallons: '3' },
    ])
  })

  it('returns previous wall, ceiling, and trim collections for no-op grouped override persistence', () => {
    const wallScopes = [
      wallScope({ id: 'wall-a', colorId: 'COLOR1', overridePaintGallons: '5' }),
      wallScope({ id: 'wall-b', colorId: 'COLOR1', overridePaintGallons: '' }),
      wallScope({ id: 'wall-inactive', colorId: 'COLOR1', include: 'N', overridePaintGallons: '' }),
      wallScope({ id: 'wall-other', colorId: 'COLOR2', overridePaintGallons: '8' }),
    ]
    const ceilingScopes = [
      ceilingScope({ id: 'ceil-a', overridePaintGallons: '3' }),
      ceilingScope({ id: 'ceil-b', overridePaintGallons: '' }),
      ceilingScope({ id: 'ceil-inactive', include: 'N', overridePaintGallons: '' }),
    ]
    const trimScopes = [
      trimScope({ id: 'trim-a', overrideGallons: '2' }),
      trimScope({ id: 'trim-b', overrideGallons: '' }),
      trimScope({ id: 'trim-inactive', include: 'N', overrideGallons: '' }),
    ]

    expect(applyWallGroupGallonOverride(wallScopes, 'COLOR1', '5', 'wall-a')).toBe(wallScopes)
    expect(applyCeilingGallonOverride(ceilingScopes, '3', 'ceil-a')).toBe(ceilingScopes)
    expect(applyTrimGallonOverride(trimScopes, '2', 'trim-a')).toBe(trimScopes)
  })
})
