'use client'

import { reconcileWholeDollarRows } from '@/lib/estimator/pricingPolicies'
import { asMaybeNumber, asNullableNumber } from '@/lib/estimator/parsing'
import {
  SCOPE_KIND_LABELS,
  SCOPE_KIND_ORDER,
  type ScopeKind,
} from '@/lib/estimator/scopeKinds'
import type {
  EstimateV2JobSettingsInput,
  EstimateV2PaintProductRow,
  EstimateV2PricingSummary,
  EstimateV2RoomFlagRow,
  EstimateV2RoomInputRow,
  EstimateV2TrimPaint,
} from '@/types/estimator/v2'
import {
  normalizeConditionSelections,
  type EstimateV2ConditionSelections,
} from '@/lib/estimator/conditionModifiers'

type SummaryScopeSourceRow = {
  id: string
  room_id: string
  scope_name?: string | null
  include?: string | null
  effective_area_sf?: number | null
  effective_measurement?: number | null
  effective_units?: number | null
  effective_quantity?: number | null
  raw_area_sf?: number | null
  raw_measurement?: number | null
  raw_units?: number | null
  raw_quantity?: number | null
  raw_paint_hours?: number | null
  effective_paint_hours?: number | null
  raw_primer_hours?: number | null
  effective_primer_hours?: number | null
  raw_material_cost?: number | null
  raw_supply_cost?: number | null
  effective_supply_cost?: number | null
  raw_total?: number | null
  effective_total?: number | null
  override_area_sf?: number | null
  override_paint_hours?: number | null
  override_primer_hours?: number | null
  override_paint_gallons?: number | null
  override_primer_gallons?: number | null
  override_material_cost?: number | null
  override_supply_cost?: number | null
  override_total?: number | null
  paint_product_id?: string | null
  paint_product_label?: string | null
  raw_paint_gallons?: number | null
  raw_primer_gallons?: number | null
  allocated_paint_material_cost?: number | null
  override_measurement?: number | null
  override_hours?: number | null
  override_gallons?: number | null
  override_description?: string | null
  repair_type?: string | null
  surface?: string | null
  unit?: string | null
  condition_selections?: EstimateV2ConditionSelections | null
}

export type EstimateV2SummaryAlert = {
  kind: 'warn' | 'info' | 'error'
  title: string
  detail: string
}

export type EstimateV2SummaryScopeRowVm = {
  id: string
  roomId: string
  kind: ScopeKind
  label: string
  quantity: number | null
  laborHours: number | null
  paintCost: number | null
  suppliesCost: number | null
  subtotal: number | null
  hasOverride: boolean
  overrideSummary: string | null
  missingProduct: boolean
  conditionSelections: EstimateV2ConditionSelections
}

export type EstimateV2SummaryRoomBlockVm = {
  room: EstimateV2RoomInputRow
  scopeRows: EstimateV2SummaryScopeRowVm[]
  displayScopeSubtotalMap: Map<string, number>
  scopes: string[]
  roomArea: number | null
  roomTotal: number | null
  roomPct: number | null
  totals: {
    labor: number
    paint: number
    supplies: number
  }
  flagsLabel: string
  alerts: {
    missingProduct: number
    overrides: number
    flags: number
  }
  conditionBadges: string[]
}

export type EstimateV2SummaryPricingKpis = {
  finalTotal: number | null
  laborHours: number | null
  laborDays: number | null
  rawLaborHours: number | null
  rawLaborDays: number | null
  laborCost: number | null
  suppliesCost: number | null
  rooms: number
  laborRate: number
}

export type EstimateV2SummaryPricingTableRow = {
  label: string
  value: string
}

export type EstimateV2PaintSupplyProductLabels = {
  wallPaintProductLabel?: string | null
  ceilingPaintProductLabel?: string | null
  trimPaintProductLabel?: string | null
  primerProductLabel?: string | null
  totalGallons?: number | null
}

type ScopeMappingConfig = {
  fallbackLabel: string
  quantity: (scope: SummaryScopeSourceRow) => number | null
  paintCost: (scope: SummaryScopeSourceRow) => number | null
  hasOverride: (scope: SummaryScopeSourceRow) => boolean
  missingProduct: (scope: SummaryScopeSourceRow) => boolean
}

const OVERRIDE_EPSILON = 0.0001

function hasActiveOverrideValue(value: number | null | undefined, baseline?: number | null) {
  if (value == null) return false
  if (baseline != null) return Math.abs(value - baseline) > OVERRIDE_EPSILON
  return Math.abs(value) > OVERRIDE_EPSILON
}

const SCOPE_MAPPING_CONFIG: Record<ScopeKind, ScopeMappingConfig> = {
  walls: {
    fallbackLabel: 'Walls',
    quantity: (scope) => scope.effective_area_sf ?? null,
    paintCost: (scope) => scope.allocated_paint_material_cost ?? null,
    hasOverride: (scope) =>
      hasActiveOverrideValue(scope.override_area_sf, scope.raw_area_sf) ||
      hasActiveOverrideValue(scope.override_paint_hours, scope.raw_paint_hours) ||
      hasActiveOverrideValue(scope.override_primer_hours, scope.raw_primer_hours) ||
      hasActiveOverrideValue(scope.override_paint_gallons, scope.raw_paint_gallons) ||
      hasActiveOverrideValue(scope.override_primer_gallons, scope.raw_primer_gallons) ||
      hasActiveOverrideValue(scope.override_supply_cost, scope.raw_supply_cost) ||
      hasActiveOverrideValue(scope.override_total, scope.raw_total),
    missingProduct: (scope) => !scope.paint_product_id && !scope.paint_product_label,
  },
  ceilings: {
    fallbackLabel: 'Ceilings',
    quantity: (scope) => scope.effective_area_sf ?? null,
    paintCost: (scope) => scope.allocated_paint_material_cost ?? null,
    hasOverride: (scope) =>
      hasActiveOverrideValue(scope.override_area_sf, scope.raw_area_sf) ||
      hasActiveOverrideValue(scope.override_paint_hours, scope.raw_paint_hours) ||
      hasActiveOverrideValue(scope.override_primer_hours, scope.raw_primer_hours) ||
      hasActiveOverrideValue(scope.override_paint_gallons, scope.raw_paint_gallons) ||
      hasActiveOverrideValue(scope.override_primer_gallons, scope.raw_primer_gallons) ||
      hasActiveOverrideValue(scope.override_supply_cost, scope.raw_supply_cost) ||
      hasActiveOverrideValue(scope.override_total, scope.raw_total),
    missingProduct: (scope) => !scope.paint_product_id && !scope.paint_product_label,
  },
  trim: {
    fallbackLabel: 'Trim',
    quantity: (scope) => scope.effective_measurement ?? null,
    paintCost: () => null,
    hasOverride: (scope) =>
      hasActiveOverrideValue(scope.override_measurement, scope.raw_measurement) ||
      hasActiveOverrideValue(scope.override_hours, scope.raw_paint_hours) ||
      hasActiveOverrideValue(scope.override_gallons, scope.raw_paint_gallons) ||
      hasActiveOverrideValue(scope.override_supply_cost, scope.raw_supply_cost) ||
      hasActiveOverrideValue(scope.override_total, scope.raw_total) ||
      !!scope.override_description?.trim(),
    missingProduct: () => false,
  },
  doors: {
    fallbackLabel: 'Doors',
    quantity: (scope) => scope.effective_units ?? null,
    paintCost: () => null,
    hasOverride: (scope) =>
      hasActiveOverrideValue(scope.override_paint_hours, scope.raw_paint_hours) ||
      hasActiveOverrideValue(scope.override_primer_hours, scope.raw_primer_hours) ||
      hasActiveOverrideValue(scope.override_material_cost, scope.raw_material_cost) ||
      hasActiveOverrideValue(scope.override_supply_cost, scope.raw_supply_cost) ||
      hasActiveOverrideValue(scope.override_total, scope.raw_total),
    missingProduct: () => false,
  },
  drywall: {
    fallbackLabel: 'Drywall',
    quantity: (scope) => scope.effective_quantity ?? scope.raw_quantity ?? null,
    paintCost: () => null,
    hasOverride: (scope) => hasActiveOverrideValue(scope.override_total, scope.raw_total),
    missingProduct: () => false,
  },
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function asNullableString(value: unknown) {
  return typeof value === 'string' ? value : null
}

function formatOverrideNumber(value: number) {
  return Number.isInteger(value)
    ? value.toLocaleString('en-US')
    : value.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

function formatOverrideCurrency(value: number) {
  return `$${formatOverrideNumber(value)}`
}

function formatOverrideValue(value: number, unit?: string) {
  return `${formatOverrideNumber(value)}${unit ? ` ${unit}` : ''}`
}

function activeOverride(
  label: string,
  value: number | null | undefined,
  unit?: string,
  baseline?: number | null
) {
  return hasActiveOverrideValue(value, baseline) ? `${label}: ${formatOverrideValue(value ?? 0, unit)}` : null
}

function activeCurrencyOverride(
  label: string,
  value: number | null | undefined,
  baseline?: number | null
) {
  return hasActiveOverrideValue(value, baseline) ? `${label}: ${formatOverrideCurrency(value ?? 0)}` : null
}

function buildOverrideSummary(kind: ScopeKind, scope: SummaryScopeSourceRow) {
  const entries =
    kind === 'drywall'
      ? [activeCurrencyOverride('Total', scope.override_total, scope.raw_total)]
      : kind === 'trim'
      ? [
          activeOverride('Measurement', scope.override_measurement, 'lf', scope.raw_measurement),
          activeOverride('Labor hours', scope.override_hours, 'h', scope.raw_paint_hours),
          activeOverride('Gallons', scope.override_gallons, 'gal', scope.raw_paint_gallons),
          activeCurrencyOverride('Supply cost', scope.override_supply_cost, scope.raw_supply_cost),
          activeCurrencyOverride('Total', scope.override_total, scope.raw_total),
          scope.override_description?.trim()
            ? `Description: ${scope.override_description.trim()}`
            : null,
        ]
      : kind === 'doors'
        ? [
            activeOverride('Paint hours', scope.override_paint_hours, 'h', scope.raw_paint_hours),
            activeOverride('Primer hours', scope.override_primer_hours, 'h', scope.raw_primer_hours),
            activeCurrencyOverride('Material cost', scope.override_material_cost, scope.raw_material_cost),
            activeCurrencyOverride('Supply cost', scope.override_supply_cost, scope.raw_supply_cost),
            activeCurrencyOverride('Total', scope.override_total, scope.raw_total),
          ]
      : [
          activeOverride('Area', scope.override_area_sf, 'sf', scope.raw_area_sf),
          activeOverride('Paint hours', scope.override_paint_hours, 'h', scope.raw_paint_hours),
          activeOverride('Primer hours', scope.override_primer_hours, 'h', scope.raw_primer_hours),
          activeOverride('Paint gallons', scope.override_paint_gallons, 'gal', scope.raw_paint_gallons),
          activeOverride('Primer gallons', scope.override_primer_gallons, 'gal', scope.raw_primer_gallons),
          activeCurrencyOverride('Supply cost', scope.override_supply_cost, scope.raw_supply_cost),
          activeCurrencyOverride('Total', scope.override_total, scope.raw_total),
        ]

  const activeEntries = entries.filter((entry): entry is string => entry != null)
  return activeEntries.length ? `Override: ${activeEntries.join(', ')}` : null
}

function asSummaryScopeSourceRow(value: unknown): SummaryScopeSourceRow | null {
  if (!isObjectRecord(value)) return null
  const id = asString(value.id)
  const roomId = asString(value.room_id)
  if (!id || !roomId) return null

  return {
    id,
    room_id: roomId,
    scope_name: asNullableString(value.scope_name),
    include: asNullableString(value.include),
    effective_area_sf: asMaybeNumber(value.effective_area_sf),
    effective_measurement: asMaybeNumber(value.effective_measurement),
    effective_units: asMaybeNumber(value.effective_units),
    effective_quantity: asMaybeNumber(value.effective_quantity),
    raw_area_sf: asMaybeNumber(value.raw_area_sf),
    raw_measurement: asMaybeNumber(value.raw_measurement),
    raw_units: asMaybeNumber(value.raw_units),
    raw_quantity: asMaybeNumber(value.raw_quantity),
    raw_paint_hours: asMaybeNumber(value.raw_paint_hours),
    effective_paint_hours: asMaybeNumber(value.effective_paint_hours),
    raw_primer_hours: asMaybeNumber(value.raw_primer_hours),
    effective_primer_hours: asMaybeNumber(value.effective_primer_hours),
    raw_material_cost: asMaybeNumber(value.raw_material_cost),
    raw_supply_cost: asMaybeNumber(value.raw_supply_cost),
    effective_supply_cost: asMaybeNumber(value.effective_supply_cost),
    raw_total: asMaybeNumber(value.raw_total),
    effective_total: asMaybeNumber(value.effective_total),
    override_area_sf: asNullableNumber(value.override_area_sf),
    override_paint_hours: asNullableNumber(value.override_paint_hours),
    override_primer_hours: asNullableNumber(value.override_primer_hours),
    override_paint_gallons: asNullableNumber(value.override_paint_gallons),
    override_primer_gallons: asNullableNumber(value.override_primer_gallons),
    override_material_cost: asNullableNumber(value.override_material_cost),
    override_supply_cost: asNullableNumber(value.override_supply_cost),
    override_total: asNullableNumber(value.override_total),
    paint_product_id: asNullableString(value.paint_product_id),
    paint_product_label: asNullableString(value.paint_product_label),
    raw_paint_gallons: asMaybeNumber(value.raw_paint_gallons),
    raw_primer_gallons: asMaybeNumber(value.raw_primer_gallons),
    allocated_paint_material_cost: asMaybeNumber(value.allocated_paint_material_cost),
    override_measurement: asNullableNumber(value.override_measurement),
    override_hours: asNullableNumber(value.override_hours),
    override_gallons: asNullableNumber(value.override_gallons),
    override_description: asNullableString(value.override_description),
    repair_type: asNullableString(value.repair_type),
    surface: asNullableString(value.surface),
    unit: asNullableString(value.unit),
    condition_selections: normalizeConditionSelections(value.condition_selections),
  }
}

export function normalizeSummaryScopeRows(value: unknown): SummaryScopeSourceRow[] {
  return Array.isArray(value)
    ? value
        .map(asSummaryScopeSourceRow)
        .filter((row): row is SummaryScopeSourceRow => row != null)
    : []
}

export function roomLabel(room: EstimateV2RoomInputRow) {
  return room.room_name ?? room.room_id
}

export function roomScopeTypeLabel(kind: ScopeKind) {
  return SCOPE_KIND_LABELS[kind]
}

export function hasMeaningfulScopeContent(scope: SummaryScopeSourceRow) {
  const hasName = !!scope.scope_name?.trim()
  const hasValue =
    (scope.effective_area_sf ?? 0) > 0 ||
    (scope.effective_measurement ?? 0) > 0 ||
    (scope.effective_units ?? 0) > 0 ||
    (scope.effective_quantity ?? scope.raw_quantity ?? 0) > 0 ||
    (scope.raw_paint_gallons ?? 0) > 0 ||
    (scope.allocated_paint_material_cost ?? 0) > 0 ||
    (scope.effective_total ?? 0) > 0
  return hasName || hasValue
}

export function createPaintProductLabelResolver(paintProducts: EstimateV2PaintProductRow[]) {
  const paintProductsById = new Map(paintProducts.map((product) => [product.id, product] as const))

  return (productId?: string | null, fallbackLabel?: string | null) => {
    if (fallbackLabel?.trim() && !/^[0-9a-f-]{16,}$/i.test(fallbackLabel.trim())) {
      return fallbackLabel
    }
    if (!productId) return '-'
    const product = paintProductsById.get(productId)
    const label =
      product?.display_name?.trim() ||
      product?.display_id?.trim() ||
      product?.label?.trim() ||
      product?.name?.trim() ||
      ''
    if (label && !/^[0-9a-f-]{16,}$/i.test(label)) return label
    if (!/^[0-9a-f-]{16,}$/i.test(productId)) return productId
    return 'Paint product'
  }
}

function firstText(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const text = value?.trim()
    if (text) return text
  }
  return null
}

function resolveSelectedProductLabel(
  resolvePaintProductLabel: (productId?: string | null, fallbackLabel?: string | null) => string,
  productId?: string | null,
  fallbackLabel?: string | null
) {
  const label = resolvePaintProductLabel(productId, fallbackLabel)
  return label === '-' ? null : label
}

function uniqueLabels(labels: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      labels
        .map((label) => label?.trim())
        .filter((label): label is string => !!label && label !== '-')
    )
  )
}

function joinUniqueLabels(labels: Array<string | null | undefined>) {
  const values = uniqueLabels(labels)
  return values.length > 0 ? values.join(', ') : null
}

function resolveScopeProductLabel(
  scope: SummaryScopeSourceRow,
  resolvePaintProductLabel: (productId?: string | null, fallbackLabel?: string | null) => string
) {
  return resolveSelectedProductLabel(
    resolvePaintProductLabel,
    scope.paint_product_id,
    scope.paint_product_label
  )
}

function resolveScopeProductLabels(
  scopes: SummaryScopeSourceRow[],
  resolvePaintProductLabel: (productId?: string | null, fallbackLabel?: string | null) => string
) {
  return joinUniqueLabels(
    scopes
      .filter((scope) => scope.include !== 'N' && hasMeaningfulScopeContent(scope))
      .map((scope) => resolveScopeProductLabel(scope, resolvePaintProductLabel))
  )
}

function sumPaintAndPrimerGallons(scopes: SummaryScopeSourceRow[]) {
  return scopes.reduce(
    (total, scope) => total + (scope.raw_paint_gallons ?? 0) + (scope.raw_primer_gallons ?? 0),
    0
  )
}

export function buildPaintSupplyProductLabels(params: {
  jobsettings: EstimateV2JobSettingsInput | null | undefined
  orgDefaults: EstimateV2JobSettingsInput | null | undefined
  wallScopes: SummaryScopeSourceRow[]
  ceilingScopes: SummaryScopeSourceRow[]
  trimScopes: SummaryScopeSourceRow[]
  doorScopes?: SummaryScopeSourceRow[]
  trimPaint: EstimateV2TrimPaint | null | undefined
  resolvePaintProductLabel: (productId?: string | null, fallbackLabel?: string | null) => string
}): EstimateV2PaintSupplyProductLabels {
  const { jobsettings, orgDefaults, resolvePaintProductLabel } = params
  const wallPaintId = firstText(
    jobsettings?.walls_paint_id,
    jobsettings?.wall_paint_id,
    orgDefaults?.walls_paint_id,
    orgDefaults?.wall_paint_id
  )
  const ceilingPaintId = firstText(jobsettings?.ceiling_paint_id, orgDefaults?.ceiling_paint_id)
  const trimPaintId = firstText(params.trimPaint?.paint_product_id, jobsettings?.trim_paint_id, orgDefaults?.trim_paint_id)
  const primerLabels = uniqueLabels([
    resolveSelectedProductLabel(
      resolvePaintProductLabel,
      firstText(
        jobsettings?.walls_primer_id,
        jobsettings?.wall_primer_id,
        jobsettings?.primer_id,
        orgDefaults?.walls_primer_id,
        orgDefaults?.wall_primer_id,
        orgDefaults?.primer_id
      )
    ),
    resolveSelectedProductLabel(
      resolvePaintProductLabel,
      firstText(jobsettings?.ceiling_primer_id, jobsettings?.primer_id, orgDefaults?.ceiling_primer_id, orgDefaults?.primer_id)
    ),
    resolveSelectedProductLabel(
      resolvePaintProductLabel,
      firstText(jobsettings?.trim_primer_id, jobsettings?.primer_id, orgDefaults?.trim_primer_id, orgDefaults?.primer_id)
    ),
  ])
  const primerProductLabel = primerLabels.length > 0 ? primerLabels.join(', ') : null
  const scopeGallons =
    sumPaintAndPrimerGallons(params.wallScopes) +
    sumPaintAndPrimerGallons(params.ceilingScopes) +
    sumPaintAndPrimerGallons(params.trimScopes)
  const trimPaintGallons = params.trimPaint?.normalized_gallons ?? 0

  return {
    wallPaintProductLabel:
      resolveScopeProductLabels(params.wallScopes, resolvePaintProductLabel) ??
      resolveSelectedProductLabel(resolvePaintProductLabel, wallPaintId),
    ceilingPaintProductLabel:
      resolveScopeProductLabels(params.ceilingScopes, resolvePaintProductLabel) ??
      resolveSelectedProductLabel(resolvePaintProductLabel, ceilingPaintId),
    trimPaintProductLabel: resolveSelectedProductLabel(
      resolvePaintProductLabel,
      trimPaintId,
      params.trimPaint?.paint_product_label
    ),
    primerProductLabel,
    totalGallons: scopeGallons + trimPaintGallons,
  }
}

function buildScopeRow(kind: ScopeKind, scope: SummaryScopeSourceRow): EstimateV2SummaryScopeRowVm {
  const config = SCOPE_MAPPING_CONFIG[kind]
  const overrideSummary = buildOverrideSummary(kind, scope)
  const drywallLabel =
    kind === 'drywall'
      ? [scope.surface, scope.repair_type]
          .map((value) => value?.replace(/_/g, ' ').trim())
          .filter(Boolean)
          .join(' - ')
      : ''

  return {
    id: scope.id,
    roomId: scope.room_id,
    kind,
    label: scope.scope_name?.trim() || drywallLabel || config.fallbackLabel,
    quantity: config.quantity(scope),
    laborHours: (scope.effective_paint_hours ?? 0) + (scope.effective_primer_hours ?? 0),
    paintCost: config.paintCost(scope),
    suppliesCost: scope.effective_supply_cost ?? null,
    subtotal: scope.effective_total ?? null,
    hasOverride: config.hasOverride(scope),
    overrideSummary,
    missingProduct: config.missingProduct(scope),
    conditionSelections: scope.condition_selections ?? {},
  }
}

function buildConditionBadges(room: EstimateV2RoomInputRow, scopeRows: EstimateV2SummaryScopeRowVm[]) {
  const badges: string[] = []
  const pushSelections = (prefix: string, selections: EstimateV2ConditionSelections | null | undefined) => {
    for (const [conditionId, level] of Object.entries(selections ?? {})) {
      badges.push(`${prefix}: ${conditionId.toLowerCase()} ${level}`)
    }
  }

  pushSelections('room', room.condition_selections)
  for (const scope of scopeRows) {
    pushSelections(roomScopeTypeLabel(scope.kind).toLowerCase(), scope.conditionSelections)
  }

  return Array.from(new Set(badges))
}

export function buildRoomScopeRows(params: {
  wallScopes: SummaryScopeSourceRow[]
  ceilingScopes: SummaryScopeSourceRow[]
  trimScopes: SummaryScopeSourceRow[]
  doorScopes?: SummaryScopeSourceRow[]
  drywallScopes?: SummaryScopeSourceRow[]
}) {
  const next = new Map<string, EstimateV2SummaryScopeRowVm[]>()

  const push = (row: EstimateV2SummaryScopeRowVm) => {
    const list = next.get(row.roomId) ?? []
    list.push(row)
    next.set(row.roomId, list)
  }

  for (const scope of params.wallScopes) {
    if (scope.include === 'N' || !hasMeaningfulScopeContent(scope)) continue
    push(buildScopeRow('walls', scope))
  }

  for (const scope of params.ceilingScopes) {
    if (scope.include === 'N' || !hasMeaningfulScopeContent(scope)) continue
    push(buildScopeRow('ceilings', scope))
  }

  for (const scope of params.trimScopes) {
    if (scope.include === 'N' || !hasMeaningfulScopeContent(scope)) continue
    push(buildScopeRow('trim', scope))
  }

  for (const scope of params.doorScopes ?? []) {
    if (scope.include === 'N' || !hasMeaningfulScopeContent(scope)) continue
    push(buildScopeRow('doors', scope))
  }

  for (const scope of params.drywallScopes ?? []) {
    if (scope.include === 'N' || !hasMeaningfulScopeContent(scope)) continue
    push(buildScopeRow('drywall', scope))
  }

  for (const [roomId, rows] of next.entries()) {
    rows.sort(
      (a, b) =>
        SCOPE_KIND_ORDER[a.kind] - SCOPE_KIND_ORDER[b.kind] ||
        a.label.localeCompare(b.label)
    )
    next.set(roomId, rows)
  }

  return next
}

export function buildRoomFlagCountMap(roomFlags: EstimateV2RoomFlagRow[]) {
  const next = new Map<string, number>()
  for (const flag of roomFlags) {
    next.set(flag.room_id, (next.get(flag.room_id) ?? 0) + 1)
  }
  return next
}

export function buildRoomAlertsByRoom(params: {
  rooms: EstimateV2RoomInputRow[]
  roomFlagCountMap: Map<string, number>
  roomScopeRows: Map<string, EstimateV2SummaryScopeRowVm[]>
}) {
  const next = new Map<
    string,
    { missingProduct: number; overrides: number; flags: number }
  >()

  for (const room of params.rooms) {
    next.set(room.room_id, {
      missingProduct: 0,
      overrides: 0,
      flags: params.roomFlagCountMap.get(room.room_id) ?? 0,
    })
  }

  for (const rows of params.roomScopeRows.values()) {
    for (const scope of rows) {
      const current = next.get(scope.roomId) ?? {
        missingProduct: 0,
        overrides: 0,
        flags: 0,
      }
      if (scope.missingProduct) current.missingProduct += 1
      if (scope.hasOverride) current.overrides += 1
      next.set(scope.roomId, current)
    }
  }

  return next
}

export function createDisplayScopePaintCostCalculator(laborRateEffective: number) {
  return (scope: EstimateV2SummaryScopeRowVm) => {
    return scope.paintCost != null
      ? scope.paintCost
      : scope.subtotal != null
        ? Math.max(
            scope.subtotal -
              (scope.laborHours ?? 0) * laborRateEffective -
              (scope.suppliesCost ?? 0),
            0
          )
        : null
  }
}

export function buildRoomBlocks(params: {
  rooms: EstimateV2RoomInputRow[]
  roomScopeRows: Map<string, EstimateV2SummaryScopeRowVm[]>
  roomTotalMap: Map<string, number>
  displayRoomTotalMap: Map<string, number>
  roomAreaMap: Map<string, number>
  pricingSummaryFinalTotal: number | null | undefined
  roomAlertsByRoom: Map<string, { missingProduct: number; overrides: number; flags: number }>
  displayScopePaintCost: (scope: EstimateV2SummaryScopeRowVm) => number | null
}) {
  return params.rooms.map((room) => {
    const scopeRows = params.roomScopeRows.get(room.room_id) ?? []
    const roomTotal = params.roomTotalMap.get(room.room_id) ?? null
    const displayRoomTotal = params.displayRoomTotalMap.get(room.room_id) ?? roomTotal
    const roomPct =
      displayRoomTotal != null && params.pricingSummaryFinalTotal
        ? displayRoomTotal / Math.round(params.pricingSummaryFinalTotal)
        : null
    const roomArea = params.roomAreaMap.get(room.room_id) ?? null
    const totals = scopeRows.reduce(
      (acc, scope) => {
        acc.labor += scope.laborHours ?? 0
        acc.paint += params.displayScopePaintCost(scope) ?? 0
        acc.supplies += scope.suppliesCost ?? 0
        return acc
      },
      { labor: 0, paint: 0, supplies: 0 }
    )
    const displayScopeRows = reconcileWholeDollarRows(
      scopeRows
        .filter((scope) => scope.subtotal != null)
        .map((scope) => ({
          ...scope,
          price: scope.subtotal ?? 0,
        })),
      displayRoomTotal ?? null
    )
    const displayScopeSubtotalMap = new Map(
      displayScopeRows.map((scope) => [scope.id, scope.price] as const)
    )
    const scopes = Array.from(new Set(scopeRows.map((scope) => roomScopeTypeLabel(scope.kind))))
    const alerts = params.roomAlertsByRoom.get(room.room_id) ?? {
      missingProduct: 0,
      overrides: 0,
      flags: 0,
    }
    const flagsLabel =
      alerts.missingProduct || alerts.overrides || alerts.flags
        ? [
            alerts.missingProduct ? `${alerts.missingProduct} missing` : null,
            alerts.overrides
              ? `${alerts.overrides} override${alerts.overrides === 1 ? '' : 's'}`
              : null,
            alerts.flags ? `${alerts.flags} flag${alerts.flags === 1 ? '' : 's'}` : null,
          ]
            .filter(Boolean)
            .join(' | ')
        : 'None'

    return {
      room,
      scopeRows,
      displayScopeSubtotalMap,
      scopes,
      roomArea,
      roomTotal: displayRoomTotal,
      roomPct,
      totals,
      flagsLabel,
      alerts,
      conditionBadges: buildConditionBadges(room, scopeRows),
    }
  })
}

export function buildPricingKpis(params: {
  pricingSummary: EstimateV2PricingSummary | null | undefined
  dayhours: number
  roomsCount: number
  laborRateEffective: number
}): EstimateV2SummaryPricingKpis {
  return {
    finalTotal: params.pricingSummary?.finalTotal ?? null,
    laborHours: params.pricingSummary?.effectiveLaborHours ?? null,
    laborDays:
      params.pricingSummary?.effectiveLaborHours != null
        ? params.pricingSummary.effectiveLaborHours / params.dayhours
        : null,
    rawLaborHours: params.pricingSummary?.rawLaborHours ?? null,
    rawLaborDays:
      params.pricingSummary?.rawLaborHours != null
        ? params.pricingSummary.rawLaborHours / params.dayhours
        : null,
    laborCost: params.pricingSummary?.laborCost ?? null,
    suppliesCost: params.pricingSummary?.supplyCost ?? null,
    rooms: params.roomsCount,
    laborRate: params.laborRateEffective,
  }
}

function formatScopeAlertDetail(scope: EstimateV2SummaryScopeRowVm, roomName: string) {
  const label = scope.label.trim()
  const prefix = roomName.trim()
  return prefix && label.toLowerCase().startsWith(prefix.toLowerCase())
    ? label
    : `${prefix || 'A room'} ${label}`
}

export function buildSummaryAlerts(params: {
  pricingSummary: EstimateV2PricingSummary | null | undefined
  hasJobSettings: boolean
  roomScopeRows: Map<string, EstimateV2SummaryScopeRowVm[]>
  roomFlags: EstimateV2RoomFlagRow[]
  rooms: EstimateV2RoomInputRow[]
}) {
  const alerts: EstimateV2SummaryAlert[] = []
  const flattened = [...params.roomScopeRows.values()].flat()
  const roomLabelById = new Map(params.rooms.map((room) => [room.room_id, roomLabel(room)]))
  const missingProducts = flattened.filter((scope) => scope.missingProduct)
  const overriddenScopes = flattened.filter((scope) => scope.hasOverride)

  if (!params.pricingSummary || !params.hasJobSettings) {
    alerts.push({
      kind: 'error',
      title: 'Missing pricing input',
      detail: 'Pricing summary not available',
    })
  }

  for (const scope of missingProducts) {
    const roomName = roomLabelById.get(scope.roomId) ?? 'A room'
    alerts.push({
      kind: 'error',
      title: 'Missing product selection',
      detail: `${formatScopeAlertDetail(scope, roomName)} needs a paint product`,
    })
  }

  for (const scope of overriddenScopes) {
    const roomName = roomLabelById.get(scope.roomId) ?? 'A room'
    const overrideDetail = scope.overrideSummary?.replace(/^Override:\s*/, '').trim()
    alerts.push({
      kind: 'warn',
      title: 'Manual override detected',
      detail: [
        `${formatScopeAlertDetail(scope, roomName)} override active`,
        overrideDetail || null,
      ].filter(Boolean).join(' - '),
    })
  }

  for (const flag of params.roomFlags) {
    alerts.push({
      kind: 'warn',
      title: 'Warning flag active',
      detail: `${roomLabelById.get(flag.room_id) ?? 'A room'} ${flag.flag_id}`,
    })
  }

  if (alerts.length === 0) {
    alerts.push({
      kind: 'info',
      title: 'No active alerts',
      detail: 'Estimate is currently clean',
    })
  }

  return alerts
}

function formatWholeDollar(value: number | null | undefined) {
  return value == null ? '-' : `$${Math.round(value).toLocaleString('en-US')}`
}

function formatGallons(value: number | null | undefined) {
  const gallons = Number(value ?? 0)
  if (!Number.isFinite(gallons)) return '0 gal'
  return `${Number(gallons.toFixed(2)).toLocaleString('en-US')} gal`
}

function formatPaintSupplyLabel(scopeLabel: string, productLabel: string | null | undefined) {
  const label = productLabel?.trim()
  return label && label !== '-' ? `${scopeLabel} - ${label}` : scopeLabel
}

function resolveTrimPaintMaterialCost(
  pricingSummary: EstimateV2PricingSummary | null | undefined,
  trimPaint?: EstimateV2TrimPaint | null
) {
  const summaryCost = pricingSummary?.trimPaintMaterialCost ?? 0
  if (summaryCost > 0) return summaryCost
  return trimPaint?.paint_cost ?? pricingSummary?.trimPaint?.paint_cost ?? summaryCost
}

function buildPaintSupplyDollarRows(
  pricingSummary: EstimateV2PricingSummary | null | undefined,
  trimPaint?: EstimateV2TrimPaint | null,
  productLabels: EstimateV2PaintSupplyProductLabels = {}
) {
  const rawRows = [
    {
      id: 'wall-paint',
      label: formatPaintSupplyLabel('Wall paint', productLabels.wallPaintProductLabel),
      price: pricingSummary?.wallPaintMaterialCost ?? null,
    },
    {
      id: 'ceiling-paint',
      label: formatPaintSupplyLabel('Ceiling paint', productLabels.ceilingPaintProductLabel),
      price: pricingSummary?.ceilingPaintMaterialCost ?? null,
    },
    {
      id: 'trim-paint',
      label: formatPaintSupplyLabel('Trim paint', productLabels.trimPaintProductLabel),
      price: resolveTrimPaintMaterialCost(pricingSummary, trimPaint),
    },
    {
      id: 'primer',
      label: formatPaintSupplyLabel('Primer', productLabels.primerProductLabel),
      price: pricingSummary?.primerMaterialCost ?? null,
    },
    {
      id: 'supplies',
      label: 'Supplies',
      price: pricingSummary?.supplyCost ?? null,
    },
  ]
  const visibleRows = rawRows.filter((row) => row.id !== 'primer' || (row.price ?? 0) > 0)
  const rawTotal = visibleRows.reduce((sum, row) => sum + (row.price ?? 0), 0)
  const reconciledRows = reconcileWholeDollarRows(
    visibleRows.map((row) => ({ id: row.id, price: row.price ?? 0 })),
    rawTotal
  )
  const reconciledPriceById = new Map(reconciledRows.map((row) => [row.id, row.price] as const))

  return visibleRows.map((row) => ({
    ...row,
    displayPrice: row.price == null ? null : reconciledPriceById.get(row.id) ?? 0,
  }))
}

export function buildPriceBreakdownRows(pricingSummary: EstimateV2PricingSummary | null | undefined) {
  const priceAdjustment = pricingSummary
    ? pricingSummary.postLaborPolicyTotal - pricingSummary.prePolicyTotal
    : null

  return [
    {
      label: 'Base Estimate / Pre-policy total',
      value: formatWholeDollar(pricingSummary?.prePolicyTotal),
    },
    ...((pricingSummary?.sharedAccessCost ?? 0) > 0
      ? [
          {
            label: 'Access Fees',
            value: formatWholeDollar(pricingSummary?.sharedAccessCost ?? null),
          },
        ]
      : []),
    ...((pricingSummary?.prepTripCost ?? 0) > 0
      ? [
          {
            label: 'Prejob Trips',
            value: formatWholeDollar(pricingSummary?.prepTripCost ?? null),
          },
        ]
      : []),
    {
      label: 'Labor Adjustment',
      value: formatWholeDollar(priceAdjustment),
    },
    {
      label: 'Job Minimum',
      value: formatWholeDollar(pricingSummary?.minimumAdjustmentAmount),
    },
  ]
}

export function buildPaintSupplyRows(
  pricingSummary: EstimateV2PricingSummary | null | undefined,
  trimPaint?: EstimateV2TrimPaint | null,
  productLabels: EstimateV2PaintSupplyProductLabels = {}
) {
  const dollarRows = buildPaintSupplyDollarRows(pricingSummary, trimPaint, productLabels)

  return [
    ...dollarRows.map((row) => ({
      label: row.label,
      value: formatWholeDollar(row.displayPrice),
    })),
    {
      label: 'Total gallons',
      value: formatGallons(productLabels.totalGallons),
    },
  ]
}

export function calculatePaintSuppliesTotal(
  pricingSummary: EstimateV2PricingSummary | null | undefined,
  trimPaint?: EstimateV2TrimPaint | null
) {
  return buildPaintSupplyDollarRows(pricingSummary, trimPaint).reduce(
    (sum, row) => sum + (row.displayPrice ?? 0),
    0
  )
}

export function hasTrimPaintSummary(trimPaint: EstimateV2TrimPaint | null | undefined) {
  return (
    !!trimPaint &&
    (!!trimPaint.paint_product_id || trimPaint.paint_cost > 0 || trimPaint.normalized_gallons > 0)
  )
}
