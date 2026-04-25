import type {
  EstimateV2CeilingScopeDraft,
  EstimateV2RoomDraft,
  EstimateV2TrimScopeDraft,
  EstimateV2WallScopeDraft,
  UnsafeRecord,
} from '@/types/estimator/v2'
import type {
  BuildDetailsVmParams,
  DetailsScopeLineVm,
  DetailsValidationIssue,
} from './estimateV2DetailsVm'
import { cleanInputNumber, isActive, round1, sumNumbers } from './estimateV2DetailsShared'
import {
  createDetailsBlockingIssue,
  createDetailsWarningIssue,
} from './estimateV2DetailsValidation'

function roomNameById(rooms: EstimateV2RoomDraft[]) {
  return new Map(rooms.map((room) => [room.roomId, room.roomName || room.roomId] as const))
}

function calcById(rows: UnsafeRecord[] | null | undefined) {
  return new Map((rows ?? []).map((row) => [String(row.id ?? ''), row] as const))
}

function validateOverrideInput(params: { label: string; targetId: string; value: string }) {
  if (!params.value.trim()) return []
  return cleanInputNumber(params.value) == null
    ? [
        createDetailsBlockingIssue({
          id: `material:${params.targetId}:overrideGallons:invalid-number`,
          section: 'material',
          targetId: params.targetId,
          field: 'overrideGallons',
          message: `${params.label} override gallons must be a zero or positive number`,
        }),
      ]
    : []
}

function wallScopeGroupKey(scope: Pick<EstimateV2WallScopeDraft, 'id' | 'colorId'>) {
  return scope.colorId || `scope:${scope.id}`
}

function resolveWallGroupIdentity(params: {
  groupKey: string
  scopes: EstimateV2WallScopeDraft[]
  colorLabelById: Map<string, string>
}) {
  const colorId = params.scopes.find((scope) => scope.colorId)?.colorId || null
  if (colorId) {
    const colorName = params.colorLabelById.get(colorId)?.trim() || `Color ${colorId}`
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

function createMissingCalculationIssue(params: {
  label: string
  targetId: string
  missingScopeIds: string[]
}) {
  if (params.missingScopeIds.length === 0) return []
  return [
    createDetailsBlockingIssue({
      id: `material:${params.targetId}:calculation:missing`,
      section: 'material',
      targetId: params.targetId,
      field: 'calculation',
      message: `${params.label} calculation data is unavailable; reopen the estimate calculator before continuing.`,
    }),
  ]
}

function createMissingProductIssue(params: {
  label: string
  targetId: string
  productWarning?: string
}) {
  if (!params.productWarning) return []
  return [
    createDetailsWarningIssue({
      id: `material:${params.targetId}:paintProductId:missing-catalog-label`,
      section: 'material',
      targetId: params.targetId,
      field: 'paintProductId',
      message: `${params.label} product ${params.productWarning}.`,
    }),
  ]
}

export function resolveGroupedOverride(params: {
  label: string
  targetId: string
  scopes: Array<{ id: string }>
  valuesByScopeId: Map<string, string>
}) {
  const ownerScopeId = params.scopes[0]?.id ?? null
  const persistedOverrides = params.scopes
    .map((scope) => ({
      scopeId: scope.id,
      value: params.valuesByScopeId.get(scope.id) ?? '',
    }))
    .filter((entry) => entry.value.trim())
  const overrideGallons = persistedOverrides[0]?.value ?? ''
  const uniqueValues = Array.from(new Set(persistedOverrides.map((entry) => entry.value.trim())))
  const conflictKind = uniqueValues.length === 1 ? 'duplicate' : 'conflicting'
  const errors: DetailsValidationIssue[] =
    persistedOverrides.length <= 1
      ? []
      : [
          createDetailsBlockingIssue({
            id: `material:${params.targetId}:overrideGallons:${conflictKind}-saved-values`,
            section: 'material',
            targetId: params.targetId,
            field: 'overrideGallons',
            message:
              conflictKind === 'duplicate'
                ? `${params.label} has duplicate saved gallon overrides across grouped scopes; apply or clear the grouped override to normalize it to the first active scope.`
                : `${params.label} has conflicting saved gallon overrides across grouped scopes; apply or clear the grouped override to normalize it to the first active scope.`,
          }),
        ]

  return {
    overrideGallons,
    ownerScopeId,
    errors,
  }
}

export function createWallRows(params: BuildDetailsVmParams): DetailsScopeLineVm[] {
  const rooms = roomNameById(params.rooms)
  const wallCalcById = calcById(params.wallCalculations)
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
    const calculatedGallons = sumNumbers(scopes, (scope) => wallCalcById.get(scope.id)?.raw_paint_gallons)
    const missingCalcScopeIds = scopes
      .filter((scope) => !wallCalcById.has(scope.id))
      .map((scope) => scope.id)
    const sqFt = sumNumbers(scopes, (scope) => wallCalcById.get(scope.id)?.effective_area_sf)
    const groupedOverride = resolveGroupedOverride({
      label: identity.label,
      targetId: identity.id,
      scopes,
      valuesByScopeId: new Map(scopes.map((scope) => [scope.id, scope.overridePaintGallons] as const)),
    })
    const overrideGallons = groupedOverride.overrideGallons
    const override = cleanInputNumber(overrideGallons)
    const roundedGallons = Math.ceil(calculatedGallons)
    const product = resolveProduct(scopes, params.paintProductLabelById)

    return {
      id: identity.id,
      label: identity.label,
      colorId: identity.colorId,
      colorName: identity.colorName,
      rooms: Array.from(new Set(scopes.map((scope) => rooms.get(scope.roomId) ?? scope.roomId))),
      sqFt: round1(sqFt),
      coats: Array.from(new Set(scopes.map((scope) => scope.paintCoats || '2'))).join(', '),
      product: product.label,
      productWarning: product.warning,
      calculationStatus: missingCalcScopeIds.length > 0 ? 'unavailable' : 'available',
      calculationMessage:
        missingCalcScopeIds.length > 0
          ? 'Calculation data unavailable'
          : undefined,
      calculatedGallons: round1(calculatedGallons),
      roundedGallons,
      overrideGallons,
      finalGallons: override ?? roundedGallons,
      overrideKey: identity.overrideKey,
      overrideOwnerScopeId: groupedOverride.ownerScopeId,
      hasOverride: override != null,
      errors: [
        ...createMissingCalculationIssue({
          label: identity.label,
          targetId: identity.id,
          missingScopeIds: missingCalcScopeIds,
        }),
        ...createMissingProductIssue({
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
  calcRows: UnsafeRecord[] | null | undefined
  rooms: EstimateV2RoomDraft[]
  productLabelById: Map<string, string>
  overrideField: 'overridePaintGallons' | 'overrideGallons'
}): DetailsScopeLineVm | null {
  const scopes = params.scopes.filter((scope) => isActive(scope.include))
  if (scopes.length === 0) return null

  const byId = calcById(params.calcRows)
  const rooms = roomNameById(params.rooms)
  const calculatedGallons = sumNumbers(scopes, (scope) => byId.get(scope.id)?.raw_paint_gallons)
  const missingCalcScopeIds = scopes.filter((scope) => !byId.has(scope.id)).map((scope) => scope.id)
  const sqFt = sumNumbers(
    scopes,
    (scope) => byId.get(scope.id)?.effective_area_sf ?? byId.get(scope.id)?.effective_measurement
  )
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
  const override = cleanInputNumber(overrideGallons)
  const roundedGallons = Math.ceil(calculatedGallons)
  const product = resolveProduct(scopes, params.productLabelById)

  return {
    id: params.id,
    label: params.label,
    colorName: params.label,
    rooms: Array.from(new Set(scopes.map((scope) => rooms.get(scope.roomId) ?? scope.roomId))),
    sqFt: round1(sqFt),
    coats: Array.from(new Set(scopes.map((scope) => scope.paintCoats || '2'))).join(', '),
    product: product.label,
    productWarning: product.warning,
    calculationStatus: missingCalcScopeIds.length > 0 ? 'unavailable' : 'available',
    calculationMessage:
      missingCalcScopeIds.length > 0
        ? 'Calculation data unavailable'
        : undefined,
    calculatedGallons: round1(calculatedGallons),
    roundedGallons,
    overrideGallons,
    finalGallons: override ?? roundedGallons,
    overrideKey: params.id,
    overrideOwnerScopeId: groupedOverride.ownerScopeId,
    hasOverride: override != null,
    errors: [
      ...createMissingCalculationIssue({
        label: params.label,
        targetId: params.id,
        missingScopeIds: missingCalcScopeIds,
      }),
      ...createMissingProductIssue({
        label: params.label,
        targetId: params.id,
        productWarning: product.warning,
      }),
      ...groupedOverride.errors,
      ...validateOverrideInput({ label: params.label, targetId: params.id, value: overrideGallons }),
    ],
  }
}

export function applyWallGroupGallonOverride(
  scopes: EstimateV2WallScopeDraft[],
  groupKey: string,
  value: string
) {
  let used = false
  return scopes.map((scope) => {
    if (wallScopeGroupKey(scope) !== groupKey || scope.include === 'N') return scope
    if (!used) {
      used = true
      return { ...scope, overridePaintGallons: value }
    }
    return { ...scope, overridePaintGallons: '' }
  })
}

export function applyCeilingGallonOverride(
  scopes: EstimateV2CeilingScopeDraft[],
  value: string
) {
  let used = false
  return scopes.map((scope) => {
    if (scope.include === 'N') return scope
    if (!used) {
      used = true
      return { ...scope, overridePaintGallons: value }
    }
    return { ...scope, overridePaintGallons: '' }
  })
}

export function applyTrimGallonOverride(scopes: EstimateV2TrimScopeDraft[], value: string) {
  let used = false
  return scopes.map((scope) => {
    if (scope.include === 'N') return scope
    if (!used) {
      used = true
      return { ...scope, overrideGallons: value }
    }
    return { ...scope, overrideGallons: '' }
  })
}
