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

describe('estimate details VM overrides', () => {

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
