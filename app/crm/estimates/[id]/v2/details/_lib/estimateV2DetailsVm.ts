import type {
  EstimateV2AccessFeeDraft,
  EstimateV2AccessFeeOption,
  EstimateV2CeilingScopeDraft,
  EstimateV2JobDefaultProducts,
  EstimateV2PaintProductOption,
  EstimateV2PricingSummary,
  EstimateV2RoomDraft,
  EstimateV2RollerDraft,
  EstimateV2TrimScopeDraft,
  EstimateV2WallScopeDraft,
  EstimateV2ConditionModifier,
  EstimateV2ConditionSelections,
  ConditionScopeFactors,
} from '@/types/estimator/v2'
import {
  resolveAllConditionFactors,
  countActiveConditions,
  emptyConditionSelections,
} from './estimateV2DetailsConditions'
import {
  buildEstimateV2DetailsAccessFeesVm,
  type DetailsAccessFeesVm,
} from './estimateV2DetailsAccessFees'
import {
  createAggregateRow,
  createWallRows,
  applyCeilingGallonOverride,
  applyTrimGallonOverride,
  applyWallGroupGallonOverride,
  extractEstimateV2DetailsCalculationRows,
  type EstimateV2DetailsCeilingCalculationRow,
  type EstimateV2DetailsTrimCalculationRow,
  type EstimateV2DetailsWallCalculationRow,
} from './estimateV2DetailsMaterials'
import {
  createCeilingRollerRow,
  createWallRollerRows,
  parseRollerCoverOptionsFromRatesFlags,
  parseRollerCoverOptionsStateFromRatesFlags,
} from './estimateV2DetailsRollers'
import { formatDetailsNumber, round1 } from './estimateV2DetailsShared'
import {
  createActiveOverrides,
  createMaterialCards,
  createValidationIssues,
  createValidationSummary,
  getBlockingValidationIssues,
} from './estimateV2DetailsValidation'

export type DetailsRollerCoverOption = {
  id: string
  label: string
  scope: 'Wall' | 'Ceiling' | 'Trim' | 'Other'
  sizeIn: number | null
  priceEach: number | null
}

export type DetailsRollerOptionsState =
  | {
      status: 'loading'
      options: DetailsRollerCoverOption[]
      message: string
    }
  | {
      status: 'loaded'
      options: DetailsRollerCoverOption[]
      message: string | null
    }
  | {
      status: 'empty'
      options: DetailsRollerCoverOption[]
      message: string
    }
  | {
      status: 'unavailable'
      options: DetailsRollerCoverOption[]
      message: string
    }

export type DetailsRollerRowState = {
  coverId: string
  quantity: string
  notes: string
}

export type DetailsRollerState = Record<string, DetailsRollerRowState>

export type DetailsValidationIssue = {
  id: string
  section: 'material' | 'rollers' | 'rates' | 'save' | 'unknown'
  targetId: string
  field?: string
  severity: 'blocking' | 'warning'
  message: string
}

export type DetailsScopeLineVm = {
  id: string
  label: string
  colorId?: string
  colorName: string
  rooms: string[]
  sqFt: number
  coats: string
  product: string
  productDefaultLabel: string
  productValue: string
  productScopeIds: string[]
  productOptions: EstimateV2PaintProductOption[]
  productWarning?: string
  calculationStatus: 'available' | 'unavailable'
  calculationMessage?: string
  calculatedGallons: number
  roundedGallons: number
  overrideGallons: string
  finalGallons: number
  overrideKey: string
  overrideOwnerScopeId: string | null
  hasOverride: boolean
  errors: DetailsValidationIssue[]
}

export type DetailsRollerVm = {
  id: string
  label: string
  sublabel: string
  sqFt: number
  product: string
  coverId: string
  quantity: string
  notes: string
  errors: DetailsValidationIssue[]
}

export type DetailsOverrideVm = {
  key: string
  itemName: string
  originalValue: number
  newValue: number
}

export type DetailsConditionsVm = {
  available: boolean
  conditions: EstimateV2ConditionModifier[]
  selections: EstimateV2ConditionSelections
  roomActiveCount: number
  wallActiveCount: number
  ceilingActiveCount: number
  trimActiveCount: number
  scopeFactors: ConditionScopeFactors
}

export type EstimateV2DetailsVm = {
  crewSize: number
  wallRows: DetailsScopeLineVm[]
  ceilingRow: DetailsScopeLineVm | null
  trimRow: DetailsScopeLineVm | null
  wallRollerRows: DetailsRollerVm[]
  ceilingRollerRow: DetailsRollerVm | null
  trimApplicatorSummary: { active: boolean; label: string } | null
  wallRollerOptions: DetailsRollerCoverOption[]
  ceilingRollerOptions: DetailsRollerCoverOption[]
  rollerOptionsState: DetailsRollerOptionsState
  materialCards: Array<{
    label: string
    finalValue: string
    calculatedValue: string
    overridden: boolean
  }>
  materialPlanningSections: {
    walls: {
      description: string
      emptyTitle: string
      emptyMessage: string
    }
    ceilings: {
      description: string
      emptyTitle: string
      emptyMessage: string
    }
    trim: {
      description: string
      emptyTitle: string
      emptyMessage: string
    }
  }
  activeOverrides: DetailsOverrideVm[]
  validationIssues: DetailsValidationIssue[]
  validationSummary: {
    status: 'ready' | 'blocked'
    title: string
    message: string
  }
  canContinueToSummary: boolean
  continueBlockedReason: string | null
  gallonsByScope: {
    walls: number
    ceilings: number
    trim: number
    total: number
  }
  estimatedMaterialCost: number
  hasCeilings: boolean
  hasTrim: boolean
  conditions: DetailsConditionsVm
  accessFees: DetailsAccessFeesVm
}

export type BuildDetailsVmParams = {
  rooms: EstimateV2RoomDraft[]
  wallScopes: EstimateV2WallScopeDraft[]
  ceilingScopes: EstimateV2CeilingScopeDraft[]
  trimScopes: EstimateV2TrimScopeDraft[]
  wallCalculations: EstimateV2DetailsWallCalculationRow[] | null | undefined
  ceilingCalculations: EstimateV2DetailsCeilingCalculationRow[] | null | undefined
  trimCalculations: EstimateV2DetailsTrimCalculationRow[] | null | undefined
  pricingSummary: EstimateV2PricingSummary | null | undefined
  crewSize?: number
  paintProductLabelById: Map<string, string>
  paintProductCoverageById?: Map<string, number | null>
  productDefaults?: EstimateV2JobDefaultProducts
  wallPaintOptions?: EstimateV2PaintProductOption[]
  ceilingPaintOptions?: EstimateV2PaintProductOption[]
  trimPaintOptions?: EstimateV2PaintProductOption[]
  colorLabelById: Map<string, string>
  rollerOptions: DetailsRollerCoverOption[]
  rollerOptionsState?: DetailsRollerOptionsState
  rollers: EstimateV2RollerDraft[]
  accessFees?: EstimateV2AccessFeeDraft[]
  accessFeeCatalog?: EstimateV2AccessFeeOption[]
  conditionModifiers?: EstimateV2ConditionModifier[]
  conditionSelections?: EstimateV2ConditionSelections
}

export type EstimateV2DetailsMaterialPlanningVm = Pick<
  EstimateV2DetailsVm,
  | 'wallRows'
  | 'ceilingRow'
  | 'trimRow'
  | 'materialPlanningSections'
  | 'activeOverrides'
  | 'hasCeilings'
  | 'hasTrim'
>

export type EstimateV2DetailsRollerPlanningVm = Pick<
  EstimateV2DetailsVm,
  | 'wallRollerRows'
  | 'ceilingRollerRow'
  | 'trimApplicatorSummary'
  | 'wallRollerOptions'
  | 'ceilingRollerOptions'
  | 'rollerOptionsState'
>

export type EstimateV2DetailsValidationVm = Pick<
  EstimateV2DetailsVm,
  | 'validationIssues'
  | 'validationSummary'
  | 'canContinueToSummary'
  | 'continueBlockedReason'
>

export type EstimateV2DetailsTotalsVm = Pick<
  EstimateV2DetailsVm,
  'materialCards' | 'gallonsByScope' | 'estimatedMaterialCost'
>

export {
  applyCeilingGallonOverride,
  applyTrimGallonOverride,
  applyWallGroupGallonOverride,
  extractEstimateV2DetailsCalculationRows,
  parseRollerCoverOptionsFromRatesFlags,
  parseRollerCoverOptionsStateFromRatesFlags,
}

function createMaterialPlanningSections(params: {
  wallRows: DetailsScopeLineVm[]
  ceilingRow: DetailsScopeLineVm | null
  trimRow: DetailsScopeLineVm | null
}): EstimateV2DetailsMaterialPlanningVm['materialPlanningSections'] {
  return {
    walls: {
      description: `${params.wallRows.length} active wall color group${params.wallRows.length === 1 ? '' : 's'}.`,
      emptyTitle: 'No Active Wall Scopes',
      emptyMessage: 'There are no active wall scopes to plan paint or roller covers for.',
    },
    ceilings: {
      description: params.ceilingRow
        ? `${formatDetailsNumber(round1(params.ceilingRow.sqFt))} sqft across active ceiling scopes.`
        : 'No active ceiling scopes.',
      emptyTitle: 'No Active Ceiling Scopes',
      emptyMessage: 'There are no active ceiling scopes to plan ceiling paint or roller covers for.',
    },
    trim: {
      description: params.trimRow
        ? 'Paint gallons for trim and baseboards.'
        : 'No active trim scopes.',
      emptyTitle: 'No Active Trim Scopes',
      emptyMessage: 'There are no active trim scopes to plan trim paint for.',
    },
  }
}

export function buildEstimateV2MaterialPlanningVm(
  params: BuildDetailsVmParams
): EstimateV2DetailsMaterialPlanningVm {
  const wallRows = createWallRows(params)
  const ceilingRow = createAggregateRow({
    id: 'ceilings',
    label: 'Ceilings',
    scopes: params.ceilingScopes,
    calcRows: params.ceilingCalculations,
    rooms: params.rooms,
    productLabelById: params.paintProductLabelById,
    paintProductCoverageById: params.paintProductCoverageById,
    defaultProductId: params.productDefaults?.ceilingPaintProductId,
    productOptions: params.ceilingPaintOptions,
    overrideField: 'overridePaintGallons',
  })
  const trimRow = createAggregateRow({
    id: 'trim',
    label: 'Trim & Baseboards',
    scopes: params.trimScopes,
    calcRows: params.trimCalculations,
    rooms: params.rooms,
    productLabelById: params.paintProductLabelById,
    paintProductCoverageById: params.paintProductCoverageById,
    defaultProductId: params.productDefaults?.trimPaintProductId,
    productOptions: params.trimPaintOptions,
    overrideField: 'overrideGallons',
  })

  return {
    wallRows,
    ceilingRow,
    trimRow,
    materialPlanningSections: createMaterialPlanningSections({ wallRows, ceilingRow, trimRow }),
    activeOverrides: createActiveOverrides({ wallRows, ceilingRow, trimRow }),
    hasCeilings: !!ceilingRow,
    hasTrim: !!trimRow,
  }
}

export function buildEstimateV2RollerPlanningVm(params: {
  materialPlanning: Pick<EstimateV2DetailsMaterialPlanningVm, 'wallRows' | 'ceilingRow' | 'trimRow'>
  rollerOptions: DetailsRollerCoverOption[]
  rollerOptionsState?: DetailsRollerOptionsState
  rollers: EstimateV2RollerDraft[]
}): EstimateV2DetailsRollerPlanningVm {
  const rollerOptionsState = params.rollerOptionsState ?? {
    status: 'loaded' as const,
    options: params.rollerOptions,
    message: null,
  }
  const rollerOptions = rollerOptionsState.options
  const wallRollerOptions = rollerOptions.filter((option) => option.scope === 'Wall')
  const ceilingRollerOptions = rollerOptions.filter((option) => option.scope === 'Ceiling')

  const wallRollerRows = createWallRollerRows({
    wallRows: params.materialPlanning.wallRows,
    rollers: params.rollers,
    rollerOptions,
    rollerOptionsState,
    wallRollerOptions,
  })
  const ceilingRollerRow = createCeilingRollerRow({
    ceilingRow: params.materialPlanning.ceilingRow,
    rollers: params.rollers,
    rollerOptions,
    rollerOptionsState,
    ceilingRollerOptions,
  })
  return {
    wallRollerRows,
    ceilingRollerRow,
    trimApplicatorSummary: params.materialPlanning.trimRow
      ? {
          active: true,
          label: '1 brush + 1 roller included automatically per color',
        }
      : null,
    wallRollerOptions,
    ceilingRollerOptions,
    rollerOptionsState,
  }
}

export function buildEstimateV2ValidationVm(params: {
  materialPlanning: Pick<EstimateV2DetailsMaterialPlanningVm, 'wallRows' | 'ceilingRow' | 'trimRow'>
  rollerPlanning: Pick<
    EstimateV2DetailsRollerPlanningVm,
    'wallRollerRows' | 'ceilingRollerRow'
  >
  conditionsVm?: DetailsConditionsVm
}): EstimateV2DetailsValidationVm {
  const validationIssues = createValidationIssues({
    wallRows: params.materialPlanning.wallRows,
    ceilingRow: params.materialPlanning.ceilingRow,
    trimRow: params.materialPlanning.trimRow,
    wallRollerRows: params.rollerPlanning.wallRollerRows,
    ceilingRollerRow: params.rollerPlanning.ceilingRollerRow,
    activeMaterialScopeCount:
      params.materialPlanning.wallRows.length +
      (params.materialPlanning.ceilingRow ? 1 : 0) +
      (params.materialPlanning.trimRow ? 1 : 0),
    conditionsVm: params.conditionsVm,
  })
  const blockingValidationIssues = getBlockingValidationIssues(validationIssues)
  const canContinueToSummary = blockingValidationIssues.length === 0
  const continueBlockedReason = blockingValidationIssues[0]?.message ?? null

  return {
    validationIssues,
    validationSummary: createValidationSummary(blockingValidationIssues),
    canContinueToSummary,
    continueBlockedReason,
  }
}

export function buildEstimateV2TotalsVm(params: {
  materialPlanning: Pick<
    EstimateV2DetailsMaterialPlanningVm,
    'wallRows' | 'ceilingRow' | 'trimRow' | 'activeOverrides'
  >
  pricingSummary: EstimateV2PricingSummary | null | undefined
}): EstimateV2DetailsTotalsVm {
  const walls = params.materialPlanning.wallRows.reduce((sum, row) => sum + row.finalGallons, 0)
  const ceilings = params.materialPlanning.ceilingRow?.finalGallons ?? 0
  const trim = params.materialPlanning.trimRow?.finalGallons ?? 0
  const estimatedMaterialCost =
    (params.pricingSummary?.paintMaterialCost ?? 0) + (params.pricingSummary?.supplyCost ?? 0)

  return {
    materialCards: createMaterialCards({
      wallRows: params.materialPlanning.wallRows,
      ceilingRow: params.materialPlanning.ceilingRow,
      trimRow: params.materialPlanning.trimRow,
      activeOverrides: params.materialPlanning.activeOverrides,
      estimatedMaterialCost,
    }),
    gallonsByScope: {
      walls: round1(walls),
      ceilings: round1(ceilings),
      trim: round1(trim),
      total: round1(walls + ceilings + trim),
    },
    estimatedMaterialCost,
  }
}

function buildEstimateV2ConditionsVm(params: BuildDetailsVmParams): DetailsConditionsVm {
  const conditions = params.conditionModifiers ?? []
  const selections = params.conditionSelections ?? emptyConditionSelections()
  const available = conditions.length > 0
  const scopeFactors = resolveAllConditionFactors(conditions, selections)
  return {
    available,
    conditions,
    selections,
    roomActiveCount: countActiveConditions(selections.room),
    wallActiveCount: countActiveConditions(selections.wall),
    ceilingActiveCount: countActiveConditions(selections.ceiling),
    trimActiveCount: countActiveConditions(selections.trim),
    scopeFactors,
  }
}

export function buildEstimateV2DetailsVm(params: BuildDetailsVmParams): EstimateV2DetailsVm {
  const materialPlanning = buildEstimateV2MaterialPlanningVm(params)
  const rollerPlanning = buildEstimateV2RollerPlanningVm({
    materialPlanning,
    rollerOptions: params.rollerOptions,
    rollerOptionsState: params.rollerOptionsState,
    rollers: params.rollers,
  })
  const conditions = buildEstimateV2ConditionsVm(params)
  const validation = buildEstimateV2ValidationVm({ materialPlanning, rollerPlanning, conditionsVm: conditions })
  const totals = buildEstimateV2TotalsVm({
    materialPlanning,
    pricingSummary: params.pricingSummary,
  })
  const accessFees = buildEstimateV2DetailsAccessFeesVm({
    accessFees: params.accessFees ?? [],
    catalog: params.accessFeeCatalog ?? [],
    rooms: params.rooms,
    pricingSummary: params.pricingSummary,
  })

  return {
    crewSize: params.crewSize ?? 1,
    ...materialPlanning,
    ...rollerPlanning,
    ...validation,
    ...totals,
    conditions,
    accessFees,
  }
}
