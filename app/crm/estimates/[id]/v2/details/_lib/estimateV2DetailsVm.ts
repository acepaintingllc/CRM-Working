import { asMaybeNumber } from '@/lib/estimator/parsing'
import type {
  EstimateV2CeilingScopeDraft,
  EstimateV2PricingSummary,
  EstimateV2RoomDraft,
  EstimateV2RollerDraft,
  EstimateV2RollerScope,
  EstimateV2TrimScopeDraft,
  EstimateV2WallScopeDraft,
  UnsafeRecord,
} from '@/types/estimator/v2'

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
  overrideOwnerScopeId: string | null
  hasOverride: boolean
  errors: string[]
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
  activeOverrides: DetailsOverrideVm[]
  validationIssues: string[]
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
  rollerOptionsState?: DetailsRollerOptionsState
  rollers: EstimateV2RollerDraft[]
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

function validateOverrideInput(params: { label: string; value: string }) {
  if (!params.value.trim()) return []
  return cleanInputNumber(params.value) == null
    ? [`${params.label} override gallons must be a zero or positive number`]
    : []
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

function resolveGroupedOverride(params: {
  label: string
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
  const errors =
    persistedOverrides.length <= 1
      ? []
      : [
          uniqueValues.length === 1
            ? `${params.label} has duplicate saved gallon overrides across grouped scopes; apply or clear the grouped override to normalize it to the first active scope.`
            : `${params.label} has conflicting saved gallon overrides across grouped scopes; apply or clear the grouped override to normalize it to the first active scope.`,
        ]

  return {
    overrideGallons,
    ownerScopeId,
    errors,
  }
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
    const groupedOverride = resolveGroupedOverride({
      label: `Color ${index + 1}`,
      scopes,
      valuesByScopeId: new Map(scopes.map((scope) => [scope.id, scope.overridePaintGallons] as const)),
    })
    const overrideGallons = groupedOverride.overrideGallons
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
      overrideOwnerScopeId: groupedOverride.ownerScopeId,
      hasOverride: override != null,
      errors: [
        ...groupedOverride.errors,
        ...validateOverrideInput({ label: `Color ${index + 1}`, value: overrideGallons }),
      ],
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
  const groupedOverride = resolveGroupedOverride({
    label: params.label,
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
    calculatedGallons: round1(calculatedGallons),
    roundedGallons,
    overrideGallons,
    finalGallons: override ?? roundedGallons,
    overrideKey: params.id,
    overrideOwnerScopeId: groupedOverride.ownerScopeId,
    hasOverride: override != null,
    errors: [
      ...groupedOverride.errors,
      ...validateOverrideInput({ label: params.label, value: overrideGallons }),
    ],
  }
}

function validateRollerRow(
  row: DetailsRollerVm,
  optionsState: DetailsRollerOptionsState,
  scopedOptions: DetailsRollerCoverOption[]
) {
  const issues: string[] = []
  if (optionsState.status === 'loading') {
    issues.push('Roller and applicator options are still loading')
  } else if (optionsState.status === 'unavailable') {
    issues.push(optionsState.message)
  } else if (scopedOptions.length === 0) {
    issues.push(
      `${row.id === 'trim' ? 'Trim applicator' : row.id === 'ceiling' ? 'Ceiling roller cover' : 'Wall roller cover'} options are not configured`
    )
  } else if (!row.coverId) {
    issues.push(`${row.label} ${row.id === 'trim' ? 'applicator' : 'roller cover'} is required`)
  }
  if ((cleanInputNumber(row.quantity) ?? 0) <= 0) issues.push(`${row.label} quantity is required`)
  return issues
}

function rollerDraftByScope(params: {
  rollers: EstimateV2RollerDraft[]
  scope: EstimateV2RollerScope
  wallColorId?: string
}) {
  return params.rollers.find((roller) => {
    if (roller.scope !== params.scope) return false
    if (params.scope === 'Ceiling' || params.scope === 'Trim') return true
    return roller.wallColorId === params.wallColorId
  })
}

function rollerOptionScopeLabel(scope: DetailsRollerCoverOption['scope']) {
  if (scope === 'Trim') return 'trim applicator'
  if (scope === 'Ceiling') return 'ceiling roller cover'
  if (scope === 'Wall') return 'wall roller cover'
  return 'roller cover'
}

function resolveRollerRowState(params: {
  label: string
  draft: EstimateV2RollerDraft | null | undefined
  options: DetailsRollerCoverOption[]
  scope: DetailsRollerCoverOption['scope']
}): DetailsRollerRowState & { hydrationErrors: string[] } {
  const size = cleanInputNumber(params.draft?.rollerSizeIn ?? '')
  const matchingOptions = params.options.filter(
    (option) => option.scope === params.scope && option.sizeIn != null && option.sizeIn === size
  )
  const isAmbiguous = size != null && matchingOptions.length > 1
  return {
    coverId: matchingOptions.length === 1 ? matchingOptions[0].id : '',
    quantity: params.draft?.coversQty ?? '',
    notes: params.draft?.notes ?? '',
    hydrationErrors: isAmbiguous
      ? [
          `${params.label} saved ${rollerOptionScopeLabel(params.scope)} size ${size}" matches multiple active options; make sizes unique before continuing.`,
        ]
      : [],
  }
}

export function parseRollerCoverOptionsFromRatesFlags(payload: unknown): DetailsRollerCoverOption[] {
  return parseRollerCoverOptionsStateFromRatesFlags(payload).options
}

export function parseRollerCoverOptionsStateFromRatesFlags(
  payload: unknown
): DetailsRollerOptionsState {
  const categories =
    payload && typeof payload === 'object' && 'categories' in payload
      ? (payload as { categories?: unknown }).categories
      : null
  if (!Array.isArray(categories)) {
    return {
      status: 'unavailable',
      options: [],
      message: 'Roller and applicator options could not be read from rates and flags.',
    }
  }
  const category = categories.find(
    (entry) =>
      entry &&
      typeof entry === 'object' &&
      (entry as { key?: unknown }).key === 'supply_rates_roller_covers'
  ) as { rows?: unknown } | undefined
  if (!category || !Array.isArray(category.rows)) {
    return {
      status: 'unavailable',
      options: [],
      message: 'Roller and applicator options could not be read from rates and flags.',
    }
  }

  const options = category.rows
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
          : scope.toLowerCase().startsWith('trim')
            ? 'Trim'
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

  if (options.length === 0) {
    return {
      status: 'empty',
      options,
      message: 'No roller or applicator options are configured in rates and flags.',
    }
  }

  return {
    status: 'loaded',
    options,
    message: null,
  }
}

export function buildEstimateV2DetailsVm(params: BuildDetailsVmParams): EstimateV2DetailsVm {
  const rollerOptionsState = params.rollerOptionsState ?? {
    status: 'loaded',
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

  const wallRollerRows = wallRows.map((row) => {
    const state = resolveRollerRowState({
      label: row.label,
      draft: rollerDraftByScope({ rollers: params.rollers, scope: 'Wall', wallColorId: row.id }),
      options: rollerOptions,
      scope: 'Wall',
    })
    const rollerRow = {
      id: `wall:${row.id}`,
      label: row.label,
      sublabel: row.colorName,
      sqFt: row.sqFt,
      product: row.product,
      coverId: state.coverId,
      quantity: state.quantity,
      notes: state.notes,
      errors: [],
    }
    return {
      ...rollerRow,
      errors: [
        ...state.hydrationErrors,
        ...validateRollerRow(rollerRow, rollerOptionsState, wallRollerOptions),
      ],
    }
  })
  const ceilingState = resolveRollerRowState({
    label: 'Ceilings',
    draft: rollerDraftByScope({ rollers: params.rollers, scope: 'Ceiling' }),
    options: rollerOptions,
    scope: 'Ceiling',
  })
  const ceilingRollerRow = ceilingRow
    ? {
        id: 'ceiling',
        label: 'Ceilings',
        sublabel: 'All active ceiling scopes',
        sqFt: ceilingRow.sqFt,
        product: ceilingRow.product,
        coverId: ceilingState.coverId,
        quantity: ceilingState.quantity,
        notes: ceilingState.notes,
        errors: [] as string[],
      }
    : null
  if (ceilingRollerRow) {
    ceilingRollerRow.errors = [
      ...ceilingState.hydrationErrors,
      ...validateRollerRow(ceilingRollerRow, rollerOptionsState, ceilingRollerOptions),
    ]
  }

  const trimState = resolveRollerRowState({
    label: 'Trim & Baseboards',
    draft: rollerDraftByScope({ rollers: params.rollers, scope: 'Trim' }),
    options: rollerOptions,
    scope: 'Trim',
  })
  const trimApplicatorRow = trimRow
    ? {
        id: 'trim',
        label: 'Trim & Baseboards',
        sublabel: 'All active trim scopes',
        sqFt: trimRow.sqFt,
        product: trimRow.product,
        coverId: trimState.coverId,
        quantity: trimState.quantity,
        notes: trimState.notes,
        errors: [] as string[],
      }
    : null
  if (trimApplicatorRow) {
    trimApplicatorRow.errors = [
      ...trimState.hydrationErrors,
      ...validateRollerRow(trimApplicatorRow, rollerOptionsState, trimApplicatorOptions),
    ]
  }

  const activeOverrides = [wallRows, ceilingRow ? [ceilingRow] : [], trimRow ? [trimRow] : []]
    .flat()
    .filter((row) => row.hasOverride)
    .map((row) => ({
      key: row.overrideKey,
      itemName: row.label,
      originalValue: row.roundedGallons,
      newValue: row.finalGallons,
    }))

  const materialValidationIssues = [
    ...wallRows.flatMap((row) => row.errors),
    ...(ceilingRow?.errors ?? []),
    ...(trimRow?.errors ?? []),
  ]
  const validationIssues = Array.from(new Set([
    ...materialValidationIssues,
    ...wallRollerRows.flatMap((row) => row.errors),
    ...(ceilingRollerRow?.errors ?? []),
    ...(trimApplicatorRow?.errors ?? []),
  ]))
  const canContinueToSummary = validationIssues.length === 0
  const continueBlockedReason =
    validationIssues[0] ?? null

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
    wallRollerOptions,
    ceilingRollerOptions,
    trimApplicatorOptions,
    rollerOptionsState,
    materialCards: [
      { label: 'Wall Paint', finalValue: `${round1(walls)} gal`, calculatedValue: `${round1(wallRows.reduce((sum, row) => sum + row.roundedGallons, 0))} rounded`, overridden: wallRows.some((row) => row.hasOverride) },
      { label: 'Ceiling Paint', finalValue: `${round1(ceilings)} gal`, calculatedValue: `${ceilingRow?.roundedGallons ?? 0} rounded`, overridden: !!ceilingRow?.hasOverride },
      { label: 'Trim Paint', finalValue: `${round1(trim)} gal`, calculatedValue: `${trimRow?.roundedGallons ?? 0} rounded`, overridden: !!trimRow?.hasOverride },
      { label: 'Total Paint', finalValue: `${round1(walls + ceilings + trim)} gal`, calculatedValue: `${round1(wallRows.reduce((sum, row) => sum + row.calculatedGallons, 0) + (ceilingRow?.calculatedGallons ?? 0) + (trimRow?.calculatedGallons ?? 0))} calc`, overridden: activeOverrides.length > 0 },
      { label: 'Estimated Material Cost', finalValue: `$${Math.round((params.pricingSummary?.paintMaterialCost ?? 0) + (params.pricingSummary?.supplyCost ?? 0)).toLocaleString('en-US')}`, calculatedValue: 'Paint + supplies', overridden: false },
    ],
    activeOverrides,
    validationIssues,
    validationSummary: canContinueToSummary
      ? {
          status: 'ready',
          title: 'Ready to continue',
          message: 'Required material planning fields are complete.',
        }
      : {
          status: 'blocked',
          title: 'Summary is blocked',
          message: `${validationIssues.length} required item${validationIssues.length === 1 ? '' : 's'} need attention before continuing.`,
        },
    canContinueToSummary,
    continueBlockedReason,
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
