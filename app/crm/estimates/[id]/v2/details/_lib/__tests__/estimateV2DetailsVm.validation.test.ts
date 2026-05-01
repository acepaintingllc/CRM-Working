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

describe('estimate details VM validation', () => {

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
      message: 'Primary roller quantity is required',
    })

    expect(getBlockingValidationIssues([warning])).toEqual([])
    expect(getBlockingValidationIssues([warning, blocking])).toEqual([blocking])
    expect(createValidationSummary(getBlockingValidationIssues([warning]))).toMatchObject({
      status: 'ready',
      title: 'Ready to continue',
    })
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


  it('keeps zero calculated wall gallons distinct from missing calculations and override zero', () => {
    const noOverride = buildVm({
      wallScopes: [wallScope({ id: 'wall-zero', colorId: 'COLOR1', overridePaintGallons: '' })],
      ceilingScopes: [],
      trimScopes: [],
      wallCalculations: [
        wallCalculationRow({ id: 'wall-zero', effectiveAreaSf: 0, rawPaintGallons: 0 }),
      ],
    })

    expect(noOverride.wallRows[0]).toMatchObject({
      calculatedGallons: 0,
      roundedGallons: 0,
      finalGallons: 0,
      hasOverride: false,
    })

    const overrideZero = buildVm({
      wallScopes: [wallScope({ id: 'wall-zero', colorId: 'COLOR1', overridePaintGallons: '0' })],
      ceilingScopes: [],
      trimScopes: [],
      wallCalculations: [
        wallCalculationRow({ id: 'wall-zero', effectiveAreaSf: 0, rawPaintGallons: 0 }),
      ],
    })

    expect(overrideZero.wallRows[0]).toMatchObject({
      calculatedGallons: 0,
      roundedGallons: 0,
      finalGallons: 0,
      hasOverride: true,
    })
  })

})
