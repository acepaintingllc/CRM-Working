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

describe('estimate details VM core', () => {

  it('formats details display numbers with the shared one-decimal formatter', () => {
    expect(formatDetailsNumber(1234.56)).toBe('1,234.6')
    expect(formatDetailsNumber(2)).toBe('2')
  })


  it('formats system wall color ids as readable fallback labels', () => {
    const baseParams = {
      rooms,
      wallScopes: [wallScope({})],
      ceilingScopes: [],
      trimScopes: [],
      wallCalculations: [
        wallCalculationRow({ id: 'wall-1', effectiveAreaSf: 100, rawPaintGallons: 1.2 }),
      ],
      ceilingCalculations: [],
      trimCalculations: [],
      pricingSummary: null,
      paintProductLabelById: new Map([['P-WALL', 'Wall Paint']]),
      rollerOptions: [],
      rollers: [],
    }

    expect(createWallRows({ ...baseParams, colorLabelById: new Map() })[0]).toMatchObject({
      id: 'COLOR1',
      label: 'Color 1',
      colorName: 'Color 1',
    })
    expect(
      createWallRows({ ...baseParams, colorLabelById: new Map([['COLOR1', 'COLOR1']]) })[0]
    ).toMatchObject({
      id: 'COLOR1',
      label: 'Color 1',
      colorName: 'Color 1',
    })
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

})
