export type EngineOutput = {
  scopes: Array<{
    include: 'Y' | 'N'
    effective_paint_hours: number | null
    effective_primer_hours: number | null
    effective_paint_gallons: number | null
    effective_primer_gallons: number | null
    effective_supply_cost: number | null
    allocated_paint_material_cost?: number | null
    allocated_paint_gallons?: number | null
    paint_material_group_key?: string | null
    paint_product_label?: string | null
    raw_paint_material_cost?: number | null
    paint_price_per_gal?: number | null
    primer_price_per_gal?: number | null
    raw_total?: number | null
    override_total?: number | string | null
    effective_total?: number | null
  }>
  room_totals: Array<{
    room_id: string
    effective_total: number
  }>
  job_level_total?: number
  per_color_supply_groups: Array<{
    allocations: Array<{ allocated_supply_cost: number }>
  }>
  paint_material_groups?: Array<{
    total_paint_cost: number
  }>
  assumptions: {
    labor_rate_per_hour: number
  }
}

export type EstimatePricingEngineKind = 'walls' | 'ceilings' | 'trim' | 'drywall' | 'doors' | 'other'

export type EstimatePricingEngineInput = {
  kind: EstimatePricingEngineKind
  output: EngineOutput
}

export type LaborDayPolicySettings = {
  enabled: boolean
  dayhours: number
  roundingIncrementHours: number
}

export type JobMinimumSettings = {
  enabled: boolean
  amount: number
}

export type LaborDayPolicyResult = {
  rawHours: number
  rawDays: number
  effectiveHours: number
  effectiveDays: number
  adjustmentHours: number
}

export type JobMinimumResult = {
  adjustmentAmount: number
  finalTotal: number
}

export type RoomPricingSummary = {
  room_id: string
  baseTotal: number
  allocatedMinimumAdjustment: number
  finalTotal: number
}

export type AccessFeePricingAllocation = {
  walls: number
  ceilings: number
  trim: number
  doors: number
  drywall: number
  other: number
  unallocated: number
  warning: string | null
}

export type EstimateAccessFeePricingInput = {
  total: number
  scopes: AccessFeeAllocationScope[]
}

export type WholeDollarReconciledRow<T extends { price: number }> = T

export type EstimateTrimPaintInput = {
  paint_product_id: string | null
  paint_product_label: string | null
  gallons: number
  quarts: number
  normalized_gallons: number
  paint_cost: number
}

export type EstimatePricingSummary = {
  rawLaborHours: number
  rawLaborDays: number
  effectiveLaborDays: number
  effectiveLaborHours: number
  laborAdjustmentHours: number
  laborCost: number
  wallPaintMaterialCost: number
  ceilingPaintMaterialCost: number
  trimPaintMaterialCost: number
  paintMaterialCost: number
  primerMaterialCost: number
  supplyCost: number
  sharedAccessCost: number
  access_fee_total: number
  accessFeeAllocation: AccessFeePricingAllocation
  prePolicyTotal: number
  postLaborPolicyTotal: number
  minimumAdjustmentAmount: number
  finalTotal: number
  rooms: RoomPricingSummary[]
  trimPaint: EstimateTrimPaintInput | null
}

function round4(value: number) {
  return Math.round((value + Number.EPSILON) * 10_000) / 10_000
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function roundWholeDollar(value: number) {
  return Math.round(value)
}

/**
 * Rounds visible rows to whole dollars without reducing any row below its
 * raw whole-dollar floor. Any positive delta up to the displayed total is
 * allocated proportionally so the rows still sum to the displayed total.
 */
export function reconcileWholeDollarRows<T extends { price: number }>(
  rows: T[],
  targetTotal: number | null
): WholeDollarReconciledRow<T>[] {
  const normalized = rows.map((row) => ({ ...row, price: round2(row.price) }))
  if (normalized.length === 0) return normalized

  const targetDollars =
    targetTotal == null || !Number.isFinite(targetTotal) ? null : roundWholeDollar(targetTotal)
  if (targetDollars == null) {
    return normalized.map((row) => ({ ...row, price: Math.max(0, roundWholeDollar(row.price)) })) as WholeDollarReconciledRow<T>[]
  }

  const baseDollars = normalized.map((row) => Math.max(0, Math.floor(row.price)))
  const baseTotal = baseDollars.reduce((sum, value) => sum + value, 0)
  const diff = targetDollars - baseTotal
  if (diff <= 0) {
    return normalized.map((row, index) => ({ ...row, price: baseDollars[index] })) as WholeDollarReconciledRow<T>[]
  }

  const weights = normalized.map((row) => Math.max(Math.abs(row.price), 1))
  const totalWeight = weights.reduce((sum, value) => sum + value, 0)
  const allocations = new Array(normalized.length).fill(0)
  const remainders: Array<{ index: number; remainder: number }> = []

  for (let index = 0; index < normalized.length; index += 1) {
    const exact = (diff * weights[index]) / totalWeight
    const allocation = Math.floor(exact)
    allocations[index] = allocation
    remainders.push({ index, remainder: exact - allocation })
  }

  const allocated = allocations.reduce((sum, value) => sum + value, 0)
  let remaining = diff - allocated
  remainders.sort((a, b) => b.remainder - a.remainder)

  let cursor = 0
  while (remaining > 0 && remainders.length > 0) {
    const current = remainders[cursor % remainders.length]
    allocations[current.index] += 1
    remaining -= 1
    cursor += 1
  }

  return normalized.map((row, index) => ({
    ...row,
    price: Math.max(0, baseDollars[index] + allocations[index]),
  })) as WholeDollarReconciledRow<T>[]
}

/**
 * Applies the labor day policy to raw labor hours.
 *
 * Rules:
 *   - rawDays < 1: bill exactly 1 day (dayhours)
 *   - rawDays >= 1: round up to nearest (roundingIncrementHours / dayhours) day increment
 *   - Always rounds up, never down
 *   - When disabled, effective = raw (no change)
 */
export function applyLaborDayPolicy(
  rawHours: number,
  settings: LaborDayPolicySettings
): LaborDayPolicyResult {
  const { enabled, dayhours, roundingIncrementHours } = settings
  const safeDayhours = dayhours > 0 ? dayhours : DEFAULT_DAY_HOURS
  const safeIncrement =
    roundingIncrementHours > 0 ? roundingIncrementHours : DEFAULT_ROUNDING_INCREMENT_HOURS
  const rawDays = round4(rawHours / safeDayhours)

  if (!enabled) {
    return {
      rawHours,
      rawDays,
      effectiveHours: rawHours,
      effectiveDays: rawDays,
      adjustmentHours: 0,
    }
  }

  let effectiveHours: number
  if (rawDays < 1) {
    effectiveHours = safeDayhours
  } else {
    // Ceiling to nearest increment in hours
    effectiveHours = Math.ceil(rawHours / safeIncrement) * safeIncrement
  }

  const effectiveDays = round4(effectiveHours / safeDayhours)
  const adjustmentHours = round4(effectiveHours - rawHours)

  return {
    rawHours,
    rawDays,
    effectiveHours,
    effectiveDays,
    adjustmentHours,
  }
}

/**
 * Applies the job minimum pricing policy.
 *
 * If enabled and subtotal < amount, returns the difference as an adjustment.
 * Customer never sees this line; it is stored internally.
 */
export function applyJobMinimum(
  subtotal: number,
  settings: JobMinimumSettings
): JobMinimumResult {
  const safeAmount = settings.amount > 0 ? settings.amount : DEFAULT_JOB_MINIMUM_AMOUNT
  if (!settings.enabled || subtotal >= safeAmount) {
    return { adjustmentAmount: 0, finalTotal: round2(subtotal) }
  }
  const adjustmentAmount = round2(safeAmount - subtotal)
  return { adjustmentAmount, finalTotal: round2(subtotal + adjustmentAmount) }
}

/**
 * Allocates a minimum adjustment amount across rooms proportionally by each room's
 * share of the pre-policy total (baseTotal). Rooms with zero base get zero allocation.
 */
export function allocateMinimumAdjustment(
  rooms: Array<{ room_id: string; baseTotal: number }>,
  adjustmentAmount: number
): RoomPricingSummary[] {
  if (adjustmentAmount <= 0) {
    return rooms.map((r) => ({
      room_id: r.room_id,
      baseTotal: round2(r.baseTotal),
      allocatedMinimumAdjustment: 0,
      finalTotal: round2(r.baseTotal),
    }))
  }

  const grandTotal = rooms.reduce((sum, r) => sum + r.baseTotal, 0)
  if (grandTotal <= 0) {
    // Edge case: no base total to weight against; distribute equally.
    const perRoom = round2(adjustmentAmount / Math.max(rooms.length, 1))
    return rooms.map((r) => ({
      room_id: r.room_id,
      baseTotal: round2(r.baseTotal),
      allocatedMinimumAdjustment: perRoom,
      finalTotal: round2(r.baseTotal + perRoom),
    }))
  }

  // Weighted allocation with rounding error correction on the last room
  let remaining = round2(adjustmentAmount)
  return rooms.map((r, i) => {
    const weight = r.baseTotal / grandTotal
    const isLast = i === rooms.length - 1
    const allocated = isLast ? remaining : round2(adjustmentAmount * weight)
    remaining = round2(remaining - allocated)
    return {
      room_id: r.room_id,
      baseTotal: round2(r.baseTotal),
      allocatedMinimumAdjustment: allocated,
      finalTotal: round2(r.baseTotal + allocated),
    }
  })
}

/**
 * Builds the full estimate-level pricing summary from wall calculation output
 * and policy settings. Uses the engine's room_totals as the cost base so the
 * labor rate is always the single value the engine resolved; no separate rate
 * parameter needed.
 */
export function buildEstimatePricingSummary(
  engines: EngineOutput[],
  laborPolicy: LaborDayPolicySettings,
  minimumPolicy: JobMinimumSettings,
  trimPaint: EstimateTrimPaintInput | null = null,
  extraSupplyCost = 0,
  accessFees: EstimateAccessFeePricingInput | null = null
): EstimatePricingSummary {
  return buildEstimatePricingSummaryFromEngines(
    engines.map((output, index) => ({
      kind: index === 0 ? 'walls' : index === 1 ? 'ceilings' : 'other',
      output,
    })),
    laborPolicy,
    minimumPolicy,
    trimPaint,
    extraSupplyCost,
    accessFees
  )
}

export function buildEstimatePricingSummaryFromEngines(
  engineInputs: EstimatePricingEngineInput[],
  laborPolicy: LaborDayPolicySettings,
  minimumPolicy: JobMinimumSettings,
  trimPaint: EstimateTrimPaintInput | null = null,
  extraSupplyCost = 0,
  accessFees: EstimateAccessFeePricingInput | null = null
): EstimatePricingSummary {
  const engines = engineInputs.map((engine) => engine.output)
  const laborRate = engines[0]?.assumptions.labor_rate_per_hour ?? DEFAULT_LABOR_RATE
  const wallEngines = engineInputs.filter((engine) => engine.kind === 'walls').map((engine) => engine.output)
  const ceilingEngines = engineInputs.filter((engine) => engine.kind === 'ceilings').map((engine) => engine.output)
  const trimEngines = engineInputs.filter((engine) => engine.kind === 'trim').map((engine) => engine.output)
  const paintSupplyEngines = [...wallEngines, ...ceilingEngines, ...trimEngines]

  // Scope total overrides are already reflected in engine room totals.
  // Labor-day rounding remains an estimate-level policy based on effective
  // scope hours, even when a scope total has been manually overridden.
  let rawLaborHours = 0
  let wallPaintMaterialCost = 0
  let ceilingPaintMaterialCost = 0
  let primerMaterialCost = 0
  let areaSupplyCost = 0

  for (const engine of engines) {
    for (const scope of engine.scopes) {
      if (scope.include !== 'Y') continue
      rawLaborHours = round4(rawLaborHours + (scope.effective_paint_hours ?? 0) + (scope.effective_primer_hours ?? 0))
    }
  }

  for (const engine of paintSupplyEngines) {
    for (const scope of engine.scopes) {
      if (scope.include !== 'Y') continue
      const primerPrice = scope.primer_price_per_gal ?? 0
      primerMaterialCost = round4(primerMaterialCost + (scope.effective_primer_gallons ?? 0) * primerPrice)
      areaSupplyCost = round4(areaSupplyCost + (scope.effective_supply_cost ?? 0))
    }
  }

  for (const engine of wallEngines) {
    for (const scope of engine.scopes) {
      if (scope.include !== 'Y') continue
      wallPaintMaterialCost = round4(
        wallPaintMaterialCost + (scope.allocated_paint_material_cost ?? scope.raw_paint_material_cost ?? 0)
      )
    }
  }

  for (const engine of ceilingEngines) {
    for (const scope of engine.scopes) {
      if (scope.include !== 'Y') continue
      ceilingPaintMaterialCost = round4(
        ceilingPaintMaterialCost + (scope.allocated_paint_material_cost ?? scope.raw_paint_material_cost ?? 0)
      )
    }
  }

  let trimScopePaintMaterialCost = 0
  for (const engine of trimEngines) {
    for (const scope of engine.scopes) {
      if (scope.include !== 'Y') continue
      trimScopePaintMaterialCost = round4(
        trimScopePaintMaterialCost + (scope.allocated_paint_material_cost ?? scope.raw_paint_material_cost ?? 0)
      )
    }
  }

  const standaloneTrimPaintMaterialCost = round2(trimPaint?.paint_cost ?? 0)
  const trimPaintMaterialCost = round2(trimScopePaintMaterialCost + standaloneTrimPaintMaterialCost)
  const paintMaterialCost = round2(wallPaintMaterialCost + ceilingPaintMaterialCost + trimPaintMaterialCost)
  // Paint/supply breakdown rows are owned by wall, ceiling, and trim paint engines.
  let perColorSupplyCost = 0
  for (const engine of paintSupplyEngines) {
    for (const group of engine.per_color_supply_groups) {
      for (const alloc of group.allocations) {
        perColorSupplyCost = round4(perColorSupplyCost + alloc.allocated_supply_cost)
      }
    }
  }
  const supplyCost = round2(areaSupplyCost + perColorSupplyCost + extraSupplyCost)
  const sharedAccessCost = round2(Math.max(0, accessFees?.total ?? 0))
  const accessAllocationResult = allocateAccessFeesByEligibleScope({
    accessFeeTotal: sharedAccessCost,
    scopes: accessFees?.scopes ?? [],
  })
  const accessFeeAllocation: AccessFeePricingAllocation = {
    walls: accessAllocationResult.allocations.walls,
    ceilings: accessAllocationResult.allocations.ceilings,
    trim: accessAllocationResult.allocations.trim,
    doors: accessAllocationResult.allocations.doors,
    drywall: accessAllocationResult.allocations.drywall,
    other: accessAllocationResult.allocations.other,
    unallocated: accessAllocationResult.unallocated,
    warning: accessAllocationResult.warning,
  }

  const laborResult = applyLaborDayPolicy(rawLaborHours, laborPolicy)
  const laborCost = round2(laborResult.effectiveHours * laborRate)

  // Merge room totals across engines by room_id (rooms in multiple engines get totals summed)
  const roomTotalMap = new Map<string, number>()
  for (const engine of engines) {
    for (const rt of engine.room_totals) {
      roomTotalMap.set(rt.room_id, round2((roomTotalMap.get(rt.room_id) ?? 0) + rt.effective_total))
    }
  }

  const roomBases = [...roomTotalMap.entries()].map(([room_id, baseTotal]) => ({ room_id, baseTotal }))
  const trimAllocations = allocateMinimumAdjustment(roomBases, standaloneTrimPaintMaterialCost)
  const roomBasesWithTrim = roomBases.map((room, idx) => ({
    room_id: room.room_id,
    baseTotal: round2(room.baseTotal + (trimAllocations[idx]?.allocatedMinimumAdjustment ?? 0)),
  }))
  const jobLevelTotal = round2(
    engineInputs.reduce((sum, engine) => {
      if (engine.kind !== 'other') return sum
      return sum + Math.max(0, engine.output.job_level_total ?? 0)
    }, 0)
  )

  const prePolicyTotal = round2(
    roomBasesWithTrim.reduce((s, v) => s + v.baseTotal, 0) + jobLevelTotal + sharedAccessCost
  )
  const postLaborPolicyTotal = round2(prePolicyTotal + (laborResult.effectiveHours - rawLaborHours) * laborRate)

  const minimumResult = applyJobMinimum(postLaborPolicyTotal, minimumPolicy)
  const roomSummaries = allocateMinimumAdjustment(roomBasesWithTrim, minimumResult.adjustmentAmount)

  return {
    rawLaborHours,
    rawLaborDays: laborResult.rawDays,
    effectiveLaborDays: laborResult.effectiveDays,
    effectiveLaborHours: laborResult.effectiveHours,
    laborAdjustmentHours: laborResult.adjustmentHours,
    laborCost,
    wallPaintMaterialCost: round2(wallPaintMaterialCost),
    ceilingPaintMaterialCost: round2(ceilingPaintMaterialCost),
    trimPaintMaterialCost,
    paintMaterialCost,
    primerMaterialCost: round2(primerMaterialCost),
    supplyCost,
    sharedAccessCost,
    access_fee_total: sharedAccessCost,
    accessFeeAllocation,
    prePolicyTotal,
    postLaborPolicyTotal,
    minimumAdjustmentAmount: minimumResult.adjustmentAmount,
    finalTotal: minimumResult.finalTotal,
    rooms: roomSummaries,
    trimPaint,
  }
}

export function buildPerJobSupplyCost(params: {
  catalogs: WallCalculationCatalogs | null | undefined
  crewSize: number
  activeScopes: Array<'walls' | 'ceilings' | 'trim'>
}) {
  const activeScopes = new Set(params.activeScopes)
  let total = 0
  for (const row of params.catalogs?.supplies_rates ?? []) {
    if (String(row.supply_group ?? '').replace(/[^a-z0-9]/gi, '').toLowerCase() !== 'perjob') {
      continue
    }
    const scope = String(row.scope ?? '').replace(/[^a-z0-9]/gi, '').toLowerCase()
    const applies =
      scope === '' ||
      scope === 'all' ||
      (activeScopes.has('walls') && (scope === 'wall' || scope === 'walls')) ||
      (activeScopes.has('ceilings') && (scope === 'ceiling' || scope === 'ceilings')) ||
      (activeScopes.has('trim') && scope === 'trim')
    if (!applies) continue
    const multiplier = String(row.crew_multiplier ?? '').toUpperCase() === 'Y' ? params.crewSize : 1
    const value = row.value == null ? null : Math.max(0, row.value)
    if (value == null) continue
    total = round4(total + value * multiplier)
  }
  return total
}
import {
  DEFAULT_DAY_HOURS,
  DEFAULT_JOB_MINIMUM_AMOUNT,
  DEFAULT_LABOR_RATE,
  DEFAULT_ROUNDING_INCREMENT_HOURS,
} from './defaults.ts'
import {
  allocateAccessFeesByEligibleScope,
  type AccessFeeAllocationScope,
} from './accessFees.ts'
import type { WallCalculationCatalogs } from './wallsTypes.ts'

