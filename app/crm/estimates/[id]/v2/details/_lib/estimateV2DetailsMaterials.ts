import type {
  EstimateV2CeilingScopeDraft,
  EstimateV2RoomDraft,
  EstimateV2TrimScopeDraft,
  EstimateV2WallScopeDraft,
} from '@/types/estimator/v2'
import type {
  BuildDetailsVmParams,
  DetailsScopeLineVm,
} from './estimateV2DetailsVm'
import {
  cleanInputNumber,
  isActive,
  resolveOptionalGallonOverride,
  round1,
  sumNumbers,
} from './estimateV2DetailsShared'
import {
  createMaterialMissingCalculationIssues,
  createMaterialMissingProductIssues,
  createMaterialOverrideInputIssues,
} from './estimateV2DetailsValidation'
import {
  calculationRowsById,
  type EstimateV2DetailsAggregateCalculationRow,
} from './estimateV2DetailsMaterialCalculations'
import {
  resolveGroupedOverride,
  wallScopeGroupKey,
} from './estimateV2DetailsMaterialOverrides'

export {
  extractEstimateV2DetailsCalculationRows,
  type EstimateV2DetailsCeilingCalculationRow,
  type EstimateV2DetailsCalculationRows,
  type EstimateV2DetailsTrimCalculationRow,
  type EstimateV2DetailsWallCalculationRow,
} from './estimateV2DetailsMaterialCalculations'

export {
  applyCeilingGallonOverride,
  applyGroupedMaterialOverridePersistencePolicy,
  applyTrimGallonOverride,
  applyWallGroupGallonOverride,
  resolveGroupedOverride,
} from './estimateV2DetailsMaterialOverrides'

function roomNameById(rooms: EstimateV2RoomDraft[]) {
  return new Map(rooms.map((room) => [room.roomId, room.roomName || room.roomId] as const))
}

function validateOverrideInput(params: { label: string; targetId: string; value: string }) {
  return createMaterialOverrideInputIssues({
    ...params,
    isValid: cleanInputNumber(params.value) != null,
  })
}

function formatSystemColorLabel(value: string) {
  const normalized = value.trim()
  const match = normalized.match(/^COLOR[\s_-]*(\d+)$/i)
  return match ? `Color ${match[1]}` : normalized
}

function resolveColorLabel(colorId: string, colorLabelById: Map<string, string>) {
  const catalogLabel = colorLabelById.get(colorId)?.trim()
  if (catalogLabel) return formatSystemColorLabel(catalogLabel)
  return formatSystemColorLabel(colorId)
}

function resolveWallGroupIdentity(params: {
  groupKey: string
  scopes: EstimateV2WallScopeDraft[]
  colorLabelById: Map<string, string>
}) {
  const colorId = params.scopes.find((scope) => scope.colorId)?.colorId || null
  if (colorId) {
    const colorName = resolveColorLabel(colorId, params.colorLabelById)
    return {
      id: colorId,
      colorId,
      label: colorName,
      colorName,
      overrideKey: `walls:color:${colorId}`,
    }
  }

  const ownerScope = params.scopes[0] ?? null
  const scopeLabel = ownerScope?.scopeName?.trim()
  const fallbackLabel = ownerScope ? `Unassigned wall scope ${ownerScope.id}` : params.groupKey
  return {
    id: params.groupKey,
    colorId: undefined,
    label: scopeLabel || fallbackLabel,
    colorName: 'Unassigned',
    overrideKey: `walls:${params.groupKey}`,
  }
}

function resolveProduct(
  scopes: Array<{ paintProductId: string }>,
  productLabelById: Map<string, string>
) {
  const ids = Array.from(new Set(scopes.map((scope) => scope.paintProductId).filter(Boolean)))
  if (ids.length > 1) return { label: 'Mixed', warning: 'Mixed product selection' }
  const id = ids[0] ?? ''
  if (!id) return { label: 'Default product' }
  const label = productLabelById.get(id)
  return label
    ? { label }
    : { label: id, warning: `${id} is not in the loaded catalog` }
}

function summarizeWallCalculations(params: {
  scopes: EstimateV2WallScopeDraft[]
  calcById: Map<string, { effectiveAreaSf: number | null; rawPaintGallons: number | null }>
}) {
  return {
    calculatedGallons: sumNumbers(
      params.scopes,
      (scope) => params.calcById.get(scope.id)?.rawPaintGallons
    ),
    missingCalcScopeIds: params.scopes
      .filter((scope) => !params.calcById.has(scope.id))
      .map((scope) => scope.id),
    sqFt: sumNumbers(params.scopes, (scope) => params.calcById.get(scope.id)?.effectiveAreaSf),
  }
}

function summarizeAggregateCalculations(params: {
  scopes: Array<EstimateV2CeilingScopeDraft | EstimateV2TrimScopeDraft>
  calcById: Map<string, EstimateV2DetailsAggregateCalculationRow>
}) {
  return {
    calculatedGallons: sumNumbers(
      params.scopes,
      (scope) => params.calcById.get(scope.id)?.rawPaintGallons
    ),
    missingCalcScopeIds: params.scopes
      .filter((scope) => !params.calcById.has(scope.id))
      .map((scope) => scope.id),
    sqFt: sumNumbers(params.scopes, (scope) => {
      const row = params.calcById.get(scope.id)
      if (!row) return null
      return 'effectiveAreaSf' in row ? row.effectiveAreaSf : row.effectiveMeasurement
    }),
  }
}

export function createWallRows(params: BuildDetailsVmParams): DetailsScopeLineVm[] {
  const rooms = roomNameById(params.rooms)
  const wallCalcById = calculationRowsById(params.wallCalculations)
  const groups = new Map<string, EstimateV2WallScopeDraft[]>()

  for (const scope of params.wallScopes) {
    if (!isActive(scope.include)) continue
    const key = wallScopeGroupKey(scope)
    groups.set(key, [...(groups.get(key) ?? []), scope])
  }

  return Array.from(groups.entries()).map(([groupKey, scopes]) => {
    const identity = resolveWallGroupIdentity({
      groupKey,
      scopes,
      colorLabelById: params.colorLabelById,
    })
    const calculationSummary = summarizeWallCalculations({ scopes, calcById: wallCalcById })
    const groupedOverride = resolveGroupedOverride({
      label: identity.label,
      targetId: identity.id,
      scopes,
      valuesByScopeId: new Map(scopes.map((scope) => [scope.id, scope.overridePaintGallons] as const)),
    })
    const overrideGallons = groupedOverride.overrideGallons
    const roundedGallons = Math.ceil(calculationSummary.calculatedGallons)
    const overrideState = resolveOptionalGallonOverride({ overrideGallons, roundedGallons })
    const product = resolveProduct(scopes, params.paintProductLabelById)

    return {
      id: identity.id,
      label: identity.label,
      colorId: identity.colorId,
      colorName: identity.colorName,
      rooms: Array.from(new Set(scopes.map((scope) => rooms.get(scope.roomId) ?? scope.roomId))),
      sqFt: round1(calculationSummary.sqFt),
      coats: Array.from(new Set(scopes.map((scope) => scope.paintCoats || '2'))).join(', '),
      product: product.label,
      productWarning: product.warning,
      calculationStatus:
        calculationSummary.missingCalcScopeIds.length > 0 ? 'unavailable' : 'available',
      calculationMessage:
        calculationSummary.missingCalcScopeIds.length > 0
          ? 'Calculation data unavailable'
          : undefined,
      calculatedGallons: round1(calculationSummary.calculatedGallons),
      roundedGallons,
      overrideGallons,
      finalGallons: overrideState.finalGallons,
      overrideKey: identity.overrideKey,
      overrideOwnerScopeId: groupedOverride.ownerScopeId,
      hasOverride: overrideState.hasOverride,
      errors: [
        ...createMaterialMissingCalculationIssues({
          label: identity.label,
          targetId: identity.id,
          missingScopeIds: calculationSummary.missingCalcScopeIds,
        }),
        ...createMaterialMissingProductIssues({
          label: identity.label,
          targetId: identity.id,
          productWarning: product.warning,
        }),
        ...groupedOverride.errors,
        ...validateOverrideInput({
          label: identity.label,
          targetId: identity.id,
          value: overrideGallons,
        }),
      ],
    }
  })
}

export function createAggregateRow(params: {
  id: string
  label: string
  scopes: Array<EstimateV2CeilingScopeDraft | EstimateV2TrimScopeDraft>
  calcRows: EstimateV2DetailsAggregateCalculationRow[] | null | undefined
  rooms: EstimateV2RoomDraft[]
  productLabelById: Map<string, string>
  overrideField: 'overridePaintGallons' | 'overrideGallons'
}): DetailsScopeLineVm | null {
  const scopes = params.scopes.filter((scope) => isActive(scope.include))
  if (scopes.length === 0) return null

  const calcById = calculationRowsById(params.calcRows)
  const rooms = roomNameById(params.rooms)
  const calculationSummary = summarizeAggregateCalculations({ scopes, calcById })
  const getOverrideValue = (scope: EstimateV2CeilingScopeDraft | EstimateV2TrimScopeDraft) =>
    params.overrideField === 'overridePaintGallons'
      ? (scope as EstimateV2CeilingScopeDraft).overridePaintGallons
      : (scope as EstimateV2TrimScopeDraft).overrideGallons
  const groupedOverride = resolveGroupedOverride({
    label: params.label,
    targetId: params.id,
    scopes,
    valuesByScopeId: new Map(scopes.map((scope) => [scope.id, getOverrideValue(scope)] as const)),
  })
  const overrideGallons = groupedOverride.overrideGallons
  const roundedGallons = Math.ceil(calculationSummary.calculatedGallons)
  const overrideState = resolveOptionalGallonOverride({ overrideGallons, roundedGallons })
  const product = resolveProduct(scopes, params.productLabelById)

  return {
    id: params.id,
    label: params.label,
    colorName: params.label,
    rooms: Array.from(new Set(scopes.map((scope) => rooms.get(scope.roomId) ?? scope.roomId))),
    sqFt: round1(calculationSummary.sqFt),
    coats: Array.from(new Set(scopes.map((scope) => scope.paintCoats || '2'))).join(', '),
    product: product.label,
    productWarning: product.warning,
    calculationStatus:
      calculationSummary.missingCalcScopeIds.length > 0 ? 'unavailable' : 'available',
    calculationMessage:
      calculationSummary.missingCalcScopeIds.length > 0
        ? 'Calculation data unavailable'
        : undefined,
    calculatedGallons: round1(calculationSummary.calculatedGallons),
    roundedGallons,
    overrideGallons,
    finalGallons: overrideState.finalGallons,
    overrideKey: params.id,
    overrideOwnerScopeId: groupedOverride.ownerScopeId,
    hasOverride: overrideState.hasOverride,
    errors: [
      ...createMaterialMissingCalculationIssues({
        label: params.label,
        targetId: params.id,
        missingScopeIds: calculationSummary.missingCalcScopeIds,
      }),
      ...createMaterialMissingProductIssues({
        label: params.label,
        targetId: params.id,
        productWarning: product.warning,
      }),
      ...groupedOverride.errors,
      ...validateOverrideInput({ label: params.label, targetId: params.id, value: overrideGallons }),
    ],
  }
}
