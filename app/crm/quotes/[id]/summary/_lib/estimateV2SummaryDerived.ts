'use client'

import { reconcileWholeDollarRows } from '@/lib/estimator/pricingPolicies'
import { asMaybeNumber } from '@/lib/estimator/parsing'
import {
  SCOPE_KIND_LABELS,
  SCOPE_KIND_ORDER,
  type ScopeKind,
} from '@/lib/estimator/scopeKinds'
import type {
  EstimateV2PaintProductRow,
  EstimateV2PricingSummary,
  EstimateV2RoomFlagRow,
  EstimateV2RoomInputRow,
  EstimateV2TrimPaint,
} from '@/types/estimator/v2'

type SummaryScopeSourceRow = {
  id: string
  room_id: string
  scope_name?: string | null
  include?: string | null
  effective_area_sf?: number | null
  effective_measurement?: number | null
  effective_paint_hours?: number | null
  effective_primer_hours?: number | null
  effective_supply_cost?: number | null
  effective_total?: number | null
  override_area_sf?: number | null
  override_paint_hours?: number | null
  override_primer_hours?: number | null
  override_paint_gallons?: number | null
  override_primer_gallons?: number | null
  override_supply_cost?: number | null
  override_total?: number | null
  paint_product_id?: string | null
  paint_product_label?: string | null
  raw_paint_gallons?: number | null
  allocated_paint_material_cost?: number | null
  override_measurement?: number | null
  override_hours?: number | null
  override_gallons?: number | null
  override_description?: string | null
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
  missingProduct: boolean
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
}

export type EstimateV2SummaryPricingKpis = {
  finalTotal: number | null
  laborHours: number | null
  laborDays: number | null
  laborCost: number | null
  suppliesCost: number | null
  rooms: number
  laborRate: number
}

export type EstimateV2SummaryPricingTableRow = {
  label: string
  value: string
}

type ScopeMappingConfig = {
  fallbackLabel: string
  quantity: (scope: SummaryScopeSourceRow) => number | null
  paintCost: (scope: SummaryScopeSourceRow) => number | null
  hasOverride: (scope: SummaryScopeSourceRow) => boolean
  missingProduct: (scope: SummaryScopeSourceRow) => boolean
}

const SCOPE_MAPPING_CONFIG: Record<ScopeKind, ScopeMappingConfig> = {
  walls: {
    fallbackLabel: 'Walls',
    quantity: (scope) => scope.effective_area_sf ?? null,
    paintCost: (scope) => scope.allocated_paint_material_cost ?? null,
    hasOverride: (scope) =>
      scope.override_area_sf != null ||
      scope.override_paint_hours != null ||
      scope.override_primer_hours != null ||
      scope.override_paint_gallons != null ||
      scope.override_primer_gallons != null ||
      scope.override_supply_cost != null ||
      scope.override_total != null,
    missingProduct: (scope) => !scope.paint_product_id && !scope.paint_product_label,
  },
  ceilings: {
    fallbackLabel: 'Ceilings',
    quantity: (scope) => scope.effective_area_sf ?? null,
    paintCost: (scope) => scope.allocated_paint_material_cost ?? null,
    hasOverride: (scope) =>
      scope.override_area_sf != null ||
      scope.override_paint_hours != null ||
      scope.override_primer_hours != null ||
      scope.override_paint_gallons != null ||
      scope.override_primer_gallons != null ||
      scope.override_supply_cost != null ||
      scope.override_total != null,
    missingProduct: (scope) => !scope.paint_product_id && !scope.paint_product_label,
  },
  trim: {
    fallbackLabel: 'Trim',
    quantity: (scope) => scope.effective_measurement ?? null,
    paintCost: () => null,
    hasOverride: (scope) =>
      scope.override_measurement != null ||
      scope.override_hours != null ||
      scope.override_gallons != null ||
      scope.override_supply_cost != null ||
      scope.override_total != null ||
      !!scope.override_description,
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
    effective_paint_hours: asMaybeNumber(value.effective_paint_hours),
    effective_primer_hours: asMaybeNumber(value.effective_primer_hours),
    effective_supply_cost: asMaybeNumber(value.effective_supply_cost),
    effective_total: asMaybeNumber(value.effective_total),
    override_area_sf: asMaybeNumber(value.override_area_sf),
    override_paint_hours: asMaybeNumber(value.override_paint_hours),
    override_primer_hours: asMaybeNumber(value.override_primer_hours),
    override_paint_gallons: asMaybeNumber(value.override_paint_gallons),
    override_primer_gallons: asMaybeNumber(value.override_primer_gallons),
    override_supply_cost: asMaybeNumber(value.override_supply_cost),
    override_total: asMaybeNumber(value.override_total),
    paint_product_id: asNullableString(value.paint_product_id),
    paint_product_label: asNullableString(value.paint_product_label),
    raw_paint_gallons: asMaybeNumber(value.raw_paint_gallons),
    allocated_paint_material_cost: asMaybeNumber(value.allocated_paint_material_cost),
    override_measurement: asMaybeNumber(value.override_measurement),
    override_hours: asMaybeNumber(value.override_hours),
    override_gallons: asMaybeNumber(value.override_gallons),
    override_description: asNullableString(value.override_description),
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

function buildScopeRow(kind: ScopeKind, scope: SummaryScopeSourceRow): EstimateV2SummaryScopeRowVm {
  const config = SCOPE_MAPPING_CONFIG[kind]

  return {
    id: scope.id,
    roomId: scope.room_id,
    kind,
    label: scope.scope_name?.trim() || config.fallbackLabel,
    quantity: config.quantity(scope),
    laborHours: (scope.effective_paint_hours ?? 0) + (scope.effective_primer_hours ?? 0),
    paintCost: config.paintCost(scope),
    suppliesCost: scope.effective_supply_cost ?? null,
    subtotal: scope.effective_total ?? null,
    hasOverride: config.hasOverride(scope),
    missingProduct: config.missingProduct(scope),
  }
}

export function buildRoomScopeRows(params: {
  wallScopes: SummaryScopeSourceRow[]
  ceilingScopes: SummaryScopeSourceRow[]
  trimScopes: SummaryScopeSourceRow[]
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
    laborCost: params.pricingSummary?.laborCost ?? null,
    suppliesCost: params.pricingSummary?.supplyCost ?? null,
    rooms: params.roomsCount,
    laborRate: params.laborRateEffective,
  }
}

export function buildSummaryAlerts(params: {
  pricingSummary: EstimateV2PricingSummary | null | undefined
  hasJobSettings: boolean
  laborRateOverrideActive: boolean
  roomScopeRows: Map<string, EstimateV2SummaryScopeRowVm[]>
  roomFlags: EstimateV2RoomFlagRow[]
  rooms: EstimateV2RoomInputRow[]
}) {
  const alerts: EstimateV2SummaryAlert[] = []
  const flattened = [...params.roomScopeRows.values()].flat()
  const firstMissingProduct = flattened.find((scope) => scope.missingProduct)
  const missingProductCount = flattened.filter((scope) => scope.missingProduct).length
  const overrideCount = flattened.filter((scope) => scope.hasOverride).length
  const flagCount = params.roomFlags.length

  if (!params.pricingSummary || !params.hasJobSettings) {
    alerts.push({
      kind: 'error',
      title: 'Missing pricing input',
      detail: 'Pricing summary not available',
    })
  } else if (missingProductCount > 0) {
    const roomName = params.rooms.find((room) => room.room_id === firstMissingProduct?.roomId)
    alerts.push({
      kind: 'error',
      title: 'Missing product selection',
      detail: `${roomName ? roomLabel(roomName) : 'A room'} needs a paint product`,
    })
  }

  if (overrideCount > 0 || params.laborRateOverrideActive) {
    alerts.push({
      kind: 'warn',
      title: 'Manual override detected',
      detail: params.laborRateOverrideActive ? 'Labor rate override active' : 'Scope override active',
    })
  }

  if (flagCount > 0) {
    alerts.push({
      kind: 'warn',
      title: 'Warning flags active',
      detail: `${flagCount} room flag${flagCount === 1 ? '' : 's'} selected`,
    })
  }

  if (alerts.length === 0) {
    alerts.push({
      kind: 'info',
      title: 'No active alerts',
      detail: 'Estimate is currently clean',
    })
  }

  return alerts.slice(0, 4)
}

function formatWholeDollar(value: number | null | undefined) {
  return value == null ? '-' : `$${Math.round(value).toLocaleString('en-US')}`
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

export function buildPaintSupplyRows(pricingSummary: EstimateV2PricingSummary | null | undefined) {
  return [
    {
      label: 'Wall paint',
      value: formatWholeDollar(pricingSummary?.wallPaintMaterialCost),
    },
    {
      label: 'Ceiling paint',
      value: formatWholeDollar(pricingSummary?.ceilingPaintMaterialCost),
    },
    {
      label: 'Primer',
      value: formatWholeDollar(pricingSummary?.primerMaterialCost),
    },
    {
      label: 'Supplies',
      value: formatWholeDollar(pricingSummary?.supplyCost),
    },
  ]
}

export function calculatePaintSuppliesTotal(pricingSummary: EstimateV2PricingSummary | null | undefined) {
  return (
    (pricingSummary?.wallPaintMaterialCost ?? 0) +
    (pricingSummary?.ceilingPaintMaterialCost ?? 0) +
    (pricingSummary?.trimPaintMaterialCost ?? 0) +
    (pricingSummary?.supplyCost ?? 0)
  )
}

export function hasTrimPaintSummary(trimPaint: EstimateV2TrimPaint | null | undefined) {
  return (
    !!trimPaint &&
    (!!trimPaint.paint_product_id || trimPaint.paint_cost > 0 || trimPaint.normalized_gallons > 0)
  )
}
