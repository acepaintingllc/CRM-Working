import type {
  EstimateV2CeilingScopeDraft,
  EstimateV2PricingSummary,
  EstimateV2RoomDraft,
  EstimateV2RollerDraft,
  EstimateV2TrimScopeDraft,
  EstimateV2WallScopeDraft,
  UnsafeRecord,
} from '@/types/estimator/v2'
import {
  createAggregateRow,
  createWallRows,
  applyCeilingGallonOverride,
  applyTrimGallonOverride,
  applyWallGroupGallonOverride,
} from './estimateV2DetailsMaterials'
import {
  createCeilingRollerRow,
  createTrimApplicatorRow,
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

export type EstimateV2DetailsVm = {
  wallRows: DetailsScopeLineVm[]
  ceilingRow: DetailsScopeLineVm | null
  trimRow: DetailsScopeLineVm | null
  wallRollerRows: DetailsRollerVm[]
  ceilingRollerRow: DetailsRollerVm | null
  trimApplicatorRow: DetailsRollerVm | null
  wallRollerOptions: DetailsRollerCoverOption[]
  ceilingRollerOptions: DetailsRollerCoverOption[]
  trimApplicatorOptions: DetailsRollerCoverOption[]
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
}

export type BuildDetailsVmParams = {
  rooms: EstimateV2RoomDraft[]
  wallScopes: EstimateV2WallScopeDraft[]
  ceilingScopes: EstimateV2CeilingScopeDraft[]
  trimScopes: EstimateV2TrimScopeDraft[]
  wallCalculations: UnsafeRecord[] | null | undefined
  ceilingCalculations: UnsafeRecord[] | null | undefined
  trimCalculations: UnsafeRecord[] | null | undefined
  pricingSummary: EstimateV2PricingSummary | null | undefined
  paintProductLabelById: Map<string, string>
  colorLabelById: Map<string, string>
  rollerOptions: DetailsRollerCoverOption[]
  rollerOptionsState?: DetailsRollerOptionsState
  rollers: EstimateV2RollerDraft[]
}

export {
  applyCeilingGallonOverride,
  applyTrimGallonOverride,
  applyWallGroupGallonOverride,
  parseRollerCoverOptionsFromRatesFlags,
  parseRollerCoverOptionsStateFromRatesFlags,
}

export function buildEstimateV2DetailsVm(params: BuildDetailsVmParams): EstimateV2DetailsVm {
  const rollerOptionsState = params.rollerOptionsState ?? {
    status: 'loaded' as const,
    options: params.rollerOptions,
    message: null,
  }
  const rollerOptions = rollerOptionsState.options
  const wallRollerOptions = rollerOptions.filter((option) => option.scope === 'Wall')
  const ceilingRollerOptions = rollerOptions.filter((option) => option.scope === 'Ceiling')
  const trimApplicatorOptions = rollerOptions.filter((option) => option.scope === 'Trim')
  const wallRows = createWallRows(params)
  const ceilingRow = createAggregateRow({
    id: 'ceilings',
    label: 'Ceilings',
    scopes: params.ceilingScopes,
    calcRows: params.ceilingCalculations,
    rooms: params.rooms,
    productLabelById: params.paintProductLabelById,
    overrideField: 'overridePaintGallons',
  })
  const trimRow = createAggregateRow({
    id: 'trim',
    label: 'Trim & Baseboards',
    scopes: params.trimScopes,
    calcRows: params.trimCalculations,
    rooms: params.rooms,
    productLabelById: params.paintProductLabelById,
    overrideField: 'overrideGallons',
  })

  const wallRollerRows = createWallRollerRows({
    wallRows,
    rollers: params.rollers,
    rollerOptions,
    rollerOptionsState,
    wallRollerOptions,
  })
  const ceilingRollerRow = createCeilingRollerRow({
    ceilingRow,
    rollers: params.rollers,
    rollerOptions,
    rollerOptionsState,
    ceilingRollerOptions,
  })
  const trimApplicatorRow = createTrimApplicatorRow({
    trimRow,
    rollers: params.rollers,
    rollerOptions,
    rollerOptionsState,
    trimApplicatorOptions,
  })

  const activeOverrides = createActiveOverrides({ wallRows, ceilingRow, trimRow })
  const validationIssues = createValidationIssues({
    wallRows,
    ceilingRow,
    trimRow,
    wallRollerRows,
    ceilingRollerRow,
    trimApplicatorRow,
    activeMaterialScopeCount:
      wallRows.length + (ceilingRow ? 1 : 0) + (trimRow ? 1 : 0),
  })
  const blockingValidationIssues = getBlockingValidationIssues(validationIssues)
  const canContinueToSummary = blockingValidationIssues.length === 0
  const continueBlockedReason = blockingValidationIssues[0]?.message ?? null
  const walls = wallRows.reduce((sum, row) => sum + row.finalGallons, 0)
  const ceilings = ceilingRow?.finalGallons ?? 0
  const trim = trimRow?.finalGallons ?? 0
  const estimatedMaterialCost =
    (params.pricingSummary?.paintMaterialCost ?? 0) + (params.pricingSummary?.supplyCost ?? 0)

  return {
    wallRows,
    ceilingRow,
    trimRow,
    wallRollerRows,
    ceilingRollerRow,
    trimApplicatorRow,
    wallRollerOptions,
    ceilingRollerOptions,
    trimApplicatorOptions,
    rollerOptionsState,
    materialCards: createMaterialCards({
      wallRows,
      ceilingRow,
      trimRow,
      activeOverrides,
      estimatedMaterialCost,
    }),
    materialPlanningSections: {
      walls: {
        description: `${wallRows.length} active wall color group${wallRows.length === 1 ? '' : 's'}.`,
        emptyTitle: 'No Active Wall Scopes',
        emptyMessage: 'There are no active wall scopes to plan paint or roller covers for.',
      },
      ceilings: {
        description: ceilingRow
          ? `${formatDetailsNumber(round1(ceilingRow.sqFt))} sqft across active ceiling scopes.`
          : 'No active ceiling scopes.',
        emptyTitle: 'No Active Ceiling Scopes',
        emptyMessage: 'There are no active ceiling scopes to plan ceiling paint or roller covers for.',
      },
      trim: {
        description: trimRow
          ? 'Paint gallons for trim and baseboards.'
          : 'No active trim scopes.',
        emptyTitle: 'No Active Trim Scopes',
        emptyMessage: 'There are no active trim scopes to plan trim paint or applicators for.',
      },
    },
    activeOverrides,
    validationIssues,
    validationSummary: createValidationSummary(blockingValidationIssues),
    canContinueToSummary,
    continueBlockedReason,
    gallonsByScope: {
      walls: round1(walls),
      ceilings: round1(ceilings),
      trim: round1(trim),
      total: round1(walls + ceilings + trim),
    },
    estimatedMaterialCost,
    hasCeilings: !!ceilingRow,
    hasTrim: !!trimRow,
  }
}
