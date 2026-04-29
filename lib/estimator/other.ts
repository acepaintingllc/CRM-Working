import { asNullableNumber } from './parsing.ts'

export type OtherPricingMode = 'fixed' | 'quantity_rate' | 'labor' | 'material_supply'
export type OtherRollupTarget =
  | 'other'
  | 'walls'
  | 'ceilings'
  | 'trim'
  | 'doors'
  | 'drywall'
  | 'room_total'
  | 'job_total'
export type OtherCustomerVisibility = 'standalone' | 'rollup'

export type OtherCalculationRow = {
  id?: string | null
  room_id?: string | null
  position?: number | string | null
  active?: string | null
  description?: string | null
  customer_label?: string | null
  pricing_mode?: string | null
  quantity?: number | string | null
  unit_rate?: number | string | null
  labor_hours?: number | string | null
  labor_rate?: number | string | null
  material_cost?: number | string | null
  supply_cost?: number | string | null
  fixed_amount?: number | string | null
  rollup_target?: string | null
  rollup_scope?: string | null
  customer_visibility?: string | null
  internal_notes?: string | null
  notes?: string | null
  client_description?: string | null
  location?: string | null
  qty?: number | string | null
  uom?: string | null
  labor_hrs_each?: number | string | null
  materials_each?: number | string | null
}

export type OtherCalculationScopeResult = OtherCalculationRow & {
  id: string
  room_id: string | null
  position: number
  include: 'Y' | 'N'
  description: string | null
  customer_label: string | null
  pricing_mode: OtherPricingMode
  quantity: number | null
  unit_rate: number | null
  labor_hours: number | null
  labor_rate_per_hour: number
  material_cost: number | null
  supply_cost: number | null
  fixed_amount: number | null
  rollup_target: OtherRollupTarget
  customer_visibility: OtherCustomerVisibility
  raw_paint_hours: number
  effective_paint_hours: number
  effective_paint_gallons: number
  raw_primer_hours: number
  effective_primer_hours: number
  effective_primer_gallons: number
  raw_supply_cost: number
  effective_supply_cost: number
  raw_total: number
  effective_total: number
}

export type OtherCalculationOutput = {
  scopes: OtherCalculationScopeResult[]
  room_totals: Array<{ room_id: string; effective_total: number }>
  per_color_supply_groups: Array<{ allocations: Array<{ allocated_supply_cost: number }> }>
  assumptions: { labor_rate_per_hour: number }
}

function round4(value: number) {
  return Math.round((value + Number.EPSILON) * 10_000) / 10_000
}

function normalizeInclude(value: unknown): 'Y' | 'N' {
  return String(value ?? 'Y').trim().toUpperCase() === 'N' ? 'N' : 'Y'
}

function normalizePricingMode(value: unknown): OtherPricingMode {
  const raw = String(value ?? '').trim().toLowerCase()
  if (raw === 'quantity_rate' || raw === 'labor' || raw === 'material_supply') return raw
  return 'fixed'
}

export function normalizeOtherRollupTarget(value: unknown): OtherRollupTarget {
  const raw = String(value ?? '').trim().toLowerCase()
  if (
    raw === 'walls' ||
    raw === 'ceilings' ||
    raw === 'trim' ||
    raw === 'doors' ||
    raw === 'drywall' ||
    raw === 'room_total' ||
    raw === 'job_total' ||
    raw === 'other'
  ) {
    return raw
  }
  if (raw === 'wall') return 'walls'
  if (raw === 'ceiling') return 'ceilings'
  if (raw === 'door') return 'doors'
  if (raw === 'room') return 'room_total'
  if (raw === 'job') return 'job_total'
  return 'other'
}

function normalizeVisibility(value: unknown): OtherCustomerVisibility {
  return String(value ?? '').trim().toLowerCase() === 'rollup' ? 'rollup' : 'standalone'
}

function nonNegative(value: unknown) {
  const parsed = asNullableNumber(value)
  return parsed == null || parsed < 0 ? null : parsed
}

function textOrNull(value: unknown) {
  const text = String(value ?? '').trim()
  return text || null
}

function calculateRowTotal(params: {
  row: OtherCalculationRow
  pricingMode: OtherPricingMode
  laborRate: number
}) {
  const quantity = nonNegative(params.row.quantity ?? params.row.qty)
  const unitRate = nonNegative(params.row.unit_rate)
  const laborHours = nonNegative(params.row.labor_hours ?? params.row.labor_hrs_each)
  const materialCost = nonNegative(params.row.material_cost ?? params.row.materials_each)
  const supplyCost = nonNegative(params.row.supply_cost)
  const fixedAmount = nonNegative(params.row.fixed_amount)

  if (params.pricingMode === 'quantity_rate') {
    return {
      quantity,
      unitRate,
      laborHours,
      materialCost,
      supplyCost,
      fixedAmount,
      total: round4((quantity ?? 0) * (unitRate ?? 0)),
    }
  }

  if (params.pricingMode === 'labor') {
    return {
      quantity,
      unitRate,
      laborHours,
      materialCost,
      supplyCost,
      fixedAmount,
      total: round4((laborHours ?? 0) * params.laborRate),
    }
  }

  if (params.pricingMode === 'material_supply') {
    return {
      quantity,
      unitRate,
      laborHours,
      materialCost,
      supplyCost,
      fixedAmount,
      total: round4((materialCost ?? 0) + (supplyCost ?? 0)),
    }
  }

  return {
    quantity,
    unitRate,
    laborHours,
    materialCost,
    supplyCost,
    fixedAmount,
    total: round4(fixedAmount ?? 0),
  }
}

export function calculateOtherItems(params: {
  rows: OtherCalculationRow[]
  settings?: { labor_rate_per_hour?: number | null }
}): OtherCalculationOutput {
  const defaultLaborRate = Math.max(0, params.settings?.labor_rate_per_hour ?? 0)
  const roomTotals = new Map<string, number>()
  const scopes = params.rows.map((row, index): OtherCalculationScopeResult => {
    const include = normalizeInclude(row.active)
    const pricingMode = normalizePricingMode(row.pricing_mode)
    const laborRate = nonNegative(row.labor_rate) ?? defaultLaborRate
    const calculated = calculateRowTotal({ row, pricingMode, laborRate })
    const effectiveTotal = include === 'Y' ? calculated.total : 0
    const effectiveLaborHours =
      include === 'Y' && pricingMode === 'labor' ? calculated.laborHours ?? 0 : 0
    const roomId = textOrNull(row.room_id ?? row.location)

    if (include === 'Y' && roomId) {
      roomTotals.set(roomId, round4((roomTotals.get(roomId) ?? 0) + effectiveTotal))
    }

    return {
      ...row,
      id: textOrNull(row.id) ?? `other-${index + 1}`,
      room_id: roomId,
      position: Number(row.position ?? index),
      include,
      description: textOrNull(row.description ?? row.client_description),
      customer_label: textOrNull(row.customer_label ?? row.client_description),
      pricing_mode: pricingMode,
      quantity: calculated.quantity,
      unit_rate: calculated.unitRate,
      labor_hours: calculated.laborHours,
      labor_rate_per_hour: laborRate,
      material_cost: calculated.materialCost,
      supply_cost: calculated.supplyCost,
      fixed_amount: calculated.fixedAmount,
      rollup_target: normalizeOtherRollupTarget(row.rollup_target ?? row.rollup_scope),
      customer_visibility: normalizeVisibility(row.customer_visibility),
      raw_paint_hours: pricingMode === 'labor' ? calculated.laborHours ?? 0 : 0,
      effective_paint_hours: effectiveLaborHours,
      effective_paint_gallons: 0,
      raw_primer_hours: 0,
      effective_primer_hours: 0,
      effective_primer_gallons: 0,
      raw_supply_cost: pricingMode === 'material_supply' ? calculated.supplyCost ?? 0 : 0,
      effective_supply_cost:
        include === 'Y' && pricingMode === 'material_supply' ? calculated.supplyCost ?? 0 : 0,
      raw_total: calculated.total,
      effective_total: effectiveTotal,
    }
  })

  return {
    scopes,
    room_totals: [...roomTotals.entries()]
      .map(([room_id, effective_total]) => ({ room_id, effective_total }))
      .sort((a, b) => a.room_id.localeCompare(b.room_id)),
    per_color_supply_groups: [],
    assumptions: { labor_rate_per_hour: defaultLaborRate },
  }
}
