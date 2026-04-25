import { asMaybeNumber } from '@/lib/estimator/parsing'
import type {
  EstimateV2CeilingScopeDraft,
  EstimateV2PricingSummary,
  EstimateV2RoomDraft,
  EstimateV2TrimScopeDraft,
  EstimateV2WallScopeDraft,
  UnsafeRecord,
} from '@/types/estimator/v2'

export type DetailsRollerCoverOption = {
  id: string
  label: string
  scope: 'Wall' | 'Ceiling' | 'Other'
  sizeIn: number | null
  priceEach: number | null
}

export type DetailsRollerRowState = {
  coverId: string
  quantity: string
  notes: string
}

export type DetailsRollerState = Record<string, DetailsRollerRowState>
export type DetailsOverrideReasons = Record<string, string>

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
  calculatedGallons: number
  roundedGallons: number
  overrideGallons: string
  finalGallons: number
  overrideKey: string
  hasOverride: boolean
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
  errors: string[]
}

export type DetailsOverrideVm = {
  key: string
  itemName: string
  originalValue: number
  newValue: number
  reason: string
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
  materialCards: Array<{
    label: string
    finalValue: string
    calculatedValue: string
    overridden: boolean
  }>
  activeOverrides: DetailsOverrideVm[]
  validationIssues: string[]
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

type BuildDetailsVmParams = {
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
  rollerState: DetailsRollerState
  overrideReasons: DetailsOverrideReasons
}

function isActive(include: string | null | undefined) {
  return include !== 'N'
}

function roomNameById(rooms: EstimateV2RoomDraft[]) {
  return new Map(rooms.map((room) => [room.roomId, room.roomName || room.roomId] as const))
}

function calcById(rows: UnsafeRecord[] | null | undefined) {
  return new Map((rows ?? []).map((row) => [String(row.id ?? ''), row] as const))
}

function n(value: unknown) {
  return asMaybeNumber(value) ?? 0
}

function round1(value: number) {
  return Math.round(value * 10) / 10
}

function cleanInputNumber(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function resolveProduct(
  scopes: Array<{ paintProductId: string }>,
  productLabelById: Map<string, string>
) {
  const ids = Array.from(new Set(scopes.map((scope) => scope.paintProductId).filter(Boolean)))
  if (ids.length > 1) return { label: 'Mixed', warning: 'Mixed product selection' }
  const id = ids[0] ?? ''
  return { label: id ? productLabelById.get(id) ?? id : 'Default product' }
}

function createWallRows(params: BuildDetailsVmParams): DetailsScopeLineVm[] {
  const rooms = roomNameById(params.rooms)
  const wallCalcById = calcById(params.wallCalculations)
  const groups = new Map<string, EstimateV2WallScopeDraft[]>()

  for (const scope of params.wallScopes) {
    if (!isActive(scope.include)) continue
    const key = scope.colorId || `scope:${scope.id}`
    groups.set(key, [...(groups.get(key) ?? []), scope])
  }

  return Array.from(groups.entries()).map(([colorId, scopes], index) => {
    const calculatedGallons = scopes.reduce(
      (sum, scope) => sum + n(wallCalcById.get(scope.id)?.raw_paint_gallons),
      0
    )
    const sqFt = scopes.reduce(
      (sum, scope) => sum + n(wallCalcById.get(scope.id)?.effective_area_sf),
      0
    )
    const overrideGallons = scopes.find((scope) => scope.overridePaintGallons)?.overridePaintGallons ?? ''
    const override = cleanInputNumber(overrideGallons)
    const roundedGallons = Math.ceil(calculatedGallons)
    const product = resolveProduct(scopes, params.paintProductLabelById)

    return {
      id: colorId,
      label: `Color ${index + 1}`,
      colorId,
      colorName: params.colorLabelById.get(colorId) ?? colorId,
      rooms: Array.from(new Set(scopes.map((scope) => rooms.get(scope.roomId) ?? scope.roomId))),
      sqFt: round1(sqFt),
      coats: Array.from(new Set(scopes.map((scope) => scope.paintCoats || '2'))).join(', '),
      product: product.label,
      productWarning: product.warning,
      calculatedGallons: round1(calculatedGallons),
      roundedGallons,
      overrideGallons,
      finalGallons: override ?? roundedGallons,
      overrideKey: `walls:${colorId}`,
      hasOverride: override != null,
    }
  })
}

function createAggregateRow(params: {
  id: string
  label: string
  scopes: Array<
    EstimateV2CeilingScopeDraft | EstimateV2TrimScopeDraft
  >
  calcRows: UnsafeRecord[] | null | undefined
  rooms: EstimateV2RoomDraft[]
  productLabelById: Map<string, string>
  overrideField: 'overridePaintGallons' | 'overrideGallons'
}): DetailsScopeLineVm | null {
  const scopes = params.scopes.filter((scope) => isActive(scope.include))
  if (scopes.length === 0) return null

  const byId = calcById(params.calcRows)
  const rooms = roomNameById(params.rooms)
  const calculatedGallons = scopes.reduce(
    (sum, scope) => sum + n(byId.get(scope.id)?.raw_paint_gallons),
    0
  )
  const sqFt = scopes.reduce(
    (sum, scope) =>
      sum + n(byId.get(scope.id)?.effective_area_sf ?? byId.get(scope.id)?.effective_measurement),
    0
  )
  const getOverrideValue = (scope: EstimateV2CeilingScopeDraft | EstimateV2TrimScopeDraft) =>
    params.overrideField === 'overridePaintGallons'
      ? (scope as EstimateV2CeilingScopeDraft).overridePaintGallons
      : (scope as EstimateV2TrimScopeDraft).overrideGallons
  const overrideGallons = getOverrideValue(scopes.find((scope) => getOverrideValue(scope)) ?? scopes[0]) ?? ''
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
    calculatedGallons: round1(calculatedGallons),
    roundedGallons,
    overrideGallons,
    finalGallons: override ?? roundedGallons,
    overrideKey: params.id,
    hasOverride: override != null,
  }
}

function validateRollerRow(row: DetailsRollerVm) {
  const issues: string[] = []
  if (!row.coverId) issues.push(`${row.label} roller cover is required`)
  if ((cleanInputNumber(row.quantity) ?? 0) <= 0) issues.push(`${row.label} quantity is required`)
  return issues
}

export function parseRollerCoverOptionsFromRatesFlags(payload: unknown): DetailsRollerCoverOption[] {
  const categories =
    payload && typeof payload === 'object' && 'categories' in payload
      ? (payload as { categories?: unknown }).categories
      : null
  if (!Array.isArray(categories)) return []
  const category = categories.find(
    (entry) =>
      entry &&
      typeof entry === 'object' &&
      (entry as { key?: unknown }).key === 'supply_rates_roller_covers'
  ) as { rows?: unknown } | undefined
  if (!Array.isArray(category?.rows)) return []

  return category.rows
    .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
    .filter((row) => String(row.active ?? 'Y').toUpperCase() !== 'N')
    .map((row): DetailsRollerCoverOption => {
      const scope = String(row.scope ?? 'Other')
      const normalizedScope: DetailsRollerCoverOption['scope'] = scope
        .toLowerCase()
        .startsWith('wall')
        ? 'Wall'
        : scope.toLowerCase().startsWith('ceil')
          ? 'Ceiling'
          : 'Other'
      return {
        id: String(row.id ?? ''),
        label: `${row.display_name ?? row.id ?? 'Roller cover'}${row.size_in ? ` ${row.size_in}"` : ''}`,
        scope: normalizedScope,
        sizeIn: asMaybeNumber(row.size_in),
        priceEach: asMaybeNumber(row.price_each),
      }
    })
    .filter((row) => row.id)
}

export function buildEstimateV2DetailsVm(params: BuildDetailsVmParams): EstimateV2DetailsVm {
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

  const wallRollerRows = wallRows.map((row) => {
    const state = params.rollerState[`wall:${row.id}`] ?? { coverId: '', quantity: '', notes: '' }
    const rollerRow = {
      id: `wall:${row.id}`,
      label: row.label,
      sublabel: row.colorName,
      sqFt: row.sqFt,
      product: row.product,
      ...state,
      errors: [],
    }
    return { ...rollerRow, errors: validateRollerRow(rollerRow) }
  })
  const ceilingState = params.rollerState.ceiling ?? { coverId: '', quantity: '', notes: '' }
  const ceilingRollerRow = ceilingRow
    ? {
        id: 'ceiling',
        label: 'Ceilings',
        sublabel: 'All active ceiling scopes',
        sqFt: ceilingRow.sqFt,
        product: ceilingRow.product,
        ...ceilingState,
        errors: [] as string[],
      }
    : null
  if (ceilingRollerRow) ceilingRollerRow.errors = validateRollerRow(ceilingRollerRow)

  const trimApplicatorRow = trimRow
    ? {
        id: 'trim',
        label: 'Trim & Baseboards',
        sublabel: 'Page-local applicator quantity',
        sqFt: trimRow.sqFt,
        product: trimRow.product,
        ...(params.rollerState.trim ?? { coverId: '', quantity: '', notes: '' }),
        errors: [],
      }
    : null

  const activeOverrides = [wallRows, ceilingRow ? [ceilingRow] : [], trimRow ? [trimRow] : []]
    .flat()
    .filter((row) => row.hasOverride)
    .map((row) => ({
      key: row.overrideKey,
      itemName: row.label,
      originalValue: row.roundedGallons,
      newValue: row.finalGallons,
      reason: params.overrideReasons[row.overrideKey] ?? '',
    }))

  const validationIssues = [
    ...wallRollerRows.flatMap((row) => row.errors),
    ...(ceilingRollerRow?.errors ?? []),
    ...activeOverrides
      .filter((override) => !override.reason.trim())
      .map((override) => `${override.itemName} override requires a reason`),
  ]

  const walls = wallRows.reduce((sum, row) => sum + row.finalGallons, 0)
  const ceilings = ceilingRow?.finalGallons ?? 0
  const trim = trimRow?.finalGallons ?? 0

  return {
    wallRows,
    ceilingRow,
    trimRow,
    wallRollerRows,
    ceilingRollerRow,
    trimApplicatorRow,
    wallRollerOptions: params.rollerOptions.filter((option) => option.scope === 'Wall'),
    ceilingRollerOptions: params.rollerOptions.filter((option) => option.scope === 'Ceiling'),
    materialCards: [
      { label: 'Wall Paint', finalValue: `${round1(walls)} gal`, calculatedValue: `${round1(wallRows.reduce((sum, row) => sum + row.roundedGallons, 0))} rounded`, overridden: wallRows.some((row) => row.hasOverride) },
      { label: 'Ceiling Paint', finalValue: `${round1(ceilings)} gal`, calculatedValue: `${ceilingRow?.roundedGallons ?? 0} rounded`, overridden: !!ceilingRow?.hasOverride },
      { label: 'Trim Paint', finalValue: `${round1(trim)} gal`, calculatedValue: `${trimRow?.roundedGallons ?? 0} rounded`, overridden: !!trimRow?.hasOverride },
      { label: 'Total Paint', finalValue: `${round1(walls + ceilings + trim)} gal`, calculatedValue: `${round1(wallRows.reduce((sum, row) => sum + row.calculatedGallons, 0) + (ceilingRow?.calculatedGallons ?? 0) + (trimRow?.calculatedGallons ?? 0))} calc`, overridden: activeOverrides.length > 0 },
      { label: 'Estimated Material Cost', finalValue: `$${Math.round((params.pricingSummary?.paintMaterialCost ?? 0) + (params.pricingSummary?.supplyCost ?? 0)).toLocaleString('en-US')}`, calculatedValue: 'Paint + supplies', overridden: false },
    ],
    activeOverrides,
    validationIssues,
    gallonsByScope: {
      walls: round1(walls),
      ceilings: round1(ceilings),
      trim: round1(trim),
      total: round1(walls + ceilings + trim),
    },
    estimatedMaterialCost:
      (params.pricingSummary?.paintMaterialCost ?? 0) + (params.pricingSummary?.supplyCost ?? 0),
    hasCeilings: !!ceilingRow,
    hasTrim: !!trimRow,
  }
}

export function applyWallGroupGallonOverride(
  scopes: EstimateV2WallScopeDraft[],
  colorId: string,
  value: string
) {
  let used = false
  return scopes.map((scope) => {
    if (scope.colorId !== colorId || scope.include === 'N') return scope
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
