import {
  n,
  nonNeg,
  round4,
} from './wallsHelpers.ts'
import { calculateDrywallEffectiveQuantity } from './calculationPrimitives.ts'
import type { MissingInput, WallRoomTotal } from './wallsTypes.ts'
import type {
  DrywallCalculationInput,
  DrywallCalculationOutput,
  DrywallRepairCalculationResult,
  DrywallRepairCalculationRow,
  DrywallRepairSurface,
  DrywallRepairType,
  DrywallRepairUnit,
  DrywallUnitRateCatalogRow,
} from '@/types/estimator/drywall'

const WALL_REPAIR_TYPES = new Set<DrywallRepairType>([
  'corner_tape_replacement',
  'flat_wall_crack',
  'stress_crack_at_seam',
  'patch_opening_repair',
])

const CEILING_REPAIR_TYPES = new Set<DrywallRepairType>([
  'ceiling_crack',
  'patch_opening_repair',
])

const REPAIR_UNIT_BY_TYPE: Record<DrywallRepairType, DrywallRepairUnit> = {
  corner_tape_replacement: 'LF',
  flat_wall_crack: 'LF',
  stress_crack_at_seam: 'LF',
  ceiling_crack: 'LF',
  patch_opening_repair: 'SQFT',
}

function emptyRoomTotal(roomId: string): WallRoomTotal {
  return {
    room_id: roomId,
    scope_count: 0,
    included_scope_count: 0,
    raw_area_sf: 0,
    effective_area_sf: 0,
    raw_paint_hours: 0,
    effective_paint_hours: 0,
    raw_primer_hours: 0,
    effective_primer_hours: 0,
    raw_paint_gallons: 0,
    effective_paint_gallons: 0,
    raw_paint_material_cost: 0,
    effective_paint_material_cost: 0,
    raw_primer_gallons: 0,
    effective_primer_gallons: 0,
    raw_supply_cost: 0,
    effective_supply_cost: 0,
    raw_total: 0,
    effective_total: 0,
  }
}

function normalizeSurface(value: unknown): DrywallRepairSurface {
  return String(value ?? '').toLowerCase() === 'ceiling' ? 'ceiling' : 'wall'
}

function normalizeRepairType(value: unknown): DrywallRepairType | null {
  const raw = String(value ?? '').trim().toLowerCase()
  if (
    raw === 'corner_tape_replacement' ||
    raw === 'flat_wall_crack' ||
    raw === 'stress_crack_at_seam' ||
    raw === 'ceiling_crack' ||
    raw === 'patch_opening_repair'
  ) {
    return raw
  }
  return null
}

function buildRateMap(rates: DrywallUnitRateCatalogRow[] | undefined) {
  const byType = new Map<string, DrywallUnitRateCatalogRow>()
  for (const rate of rates ?? []) {
    const id = String(rate.id ?? '').toLowerCase()
    const type = String(rate.unit_rate_type ?? '').toLowerCase()
    if (id) byType.set(id, rate)
    if (type) byType.set(type, rate)
  }
  return byType
}

function isRepairValidForSurface(repairType: DrywallRepairType, surface: DrywallRepairSurface) {
  return surface === 'ceiling'
    ? CEILING_REPAIR_TYPES.has(repairType)
    : WALL_REPAIR_TYPES.has(repairType)
}

function scopeKey(row: DrywallRepairCalculationRow) {
  return row.id ?? `${row.room_id}::${row.position ?? 0}`
}

function buildRoomTotals(scopes: DrywallRepairCalculationResult[]) {
  const totals = new Map<string, WallRoomTotal>()
  for (const scope of scopes) {
    const total = totals.get(scope.room_id) ?? emptyRoomTotal(scope.room_id)
    total.scope_count += 1
    total.included_scope_count += 1
    total.raw_total = round4(total.raw_total + scope.raw_total)
    total.effective_total = round4(total.effective_total + scope.effective_total)
    totals.set(scope.room_id, total)
  }
  return Array.from(totals.values()).sort((a, b) => a.room_id.localeCompare(b.room_id))
}

export function calculateDrywallRepairs(input: DrywallCalculationInput): DrywallCalculationOutput {
  const rateMap = buildRateMap(input.catalogs?.drywall_unit_rates)
  const missingInputs: MissingInput[] = []

  const scopes = input.repairs.map((repair): DrywallRepairCalculationResult => {
    const surface = normalizeSurface(repair.surface)
    const repairType = normalizeRepairType(repair.repair_type)
    const rawQuantity = nonNeg(n(repair.quantity)) ?? 0
    const effectiveQuantity = calculateDrywallEffectiveQuantity(rawQuantity)
    const validRepairType = repairType ?? 'flat_wall_crack'
    const validForSurface = repairType ? isRepairValidForSurface(repairType, surface) : false
    const expectedUnit = repairType ? REPAIR_UNIT_BY_TYPE[repairType] : 'LF'
    const rate = repairType ? rateMap.get(repairType) : undefined
    const baseUnitRate = nonNeg(n(rate?.amount)) ?? 0
    const ceilingMultiplier = surface === 'ceiling' ? nonNeg(n(rate?.ceiling_multiplier)) ?? 1 : 1
    const calculatedTotal =
      repairType && validForSurface && rate
        ? round4(effectiveQuantity * baseUnitRate * ceilingMultiplier)
        : 0
    const overrideTotal = nonNeg(n(repair.override_total))
    const effectiveTotal =
      effectiveQuantity > 0
        ? round4(overrideTotal ?? calculatedTotal)
        : 0
    const key = scopeKey(repair)

    if (!repairType) {
      missingInputs.push({
        level: 'scope',
        room_id: repair.room_id,
        scope_id: key,
        segment_id: null,
        field: 'repair_type',
        message: `Drywall repair ${key}: repair type is required`,
      })
    } else if (!validForSurface) {
      missingInputs.push({
        level: 'scope',
        room_id: repair.room_id,
        scope_id: key,
        segment_id: null,
        field: 'repair_type',
        message: `Drywall repair ${key}: ${repairType} is not valid for ${surface}`,
      })
    }

    if (repairType && validForSurface && !rate) {
      missingInputs.push({
        level: 'scope',
        room_id: repair.room_id,
        scope_id: key,
        segment_id: null,
        field: 'repair_type',
        message: `Drywall repair ${key}: rate is required for ${repairType}`,
      })
    }

    return {
      ...repair,
      surface,
      repair_type: validRepairType,
      unit: expectedUnit,
      include: 'Y',
      raw_quantity: rawQuantity,
      effective_quantity: effectiveQuantity,
      base_unit_rate: baseUnitRate,
      ceiling_multiplier: ceilingMultiplier,
      calculated_total: calculatedTotal,
      override_total: overrideTotal,
      raw_total: calculatedTotal,
      effective_total: effectiveTotal,
      raw_paint_hours: 0,
      effective_paint_hours: 0,
      raw_paint_gallons: 0,
      effective_paint_gallons: 0,
      raw_primer_hours: 0,
      effective_primer_hours: 0,
      raw_primer_gallons: 0,
      effective_primer_gallons: 0,
      raw_supply_cost: 0,
      effective_supply_cost: 0,
    }
  })

  return {
    scopes,
    room_totals: buildRoomTotals(scopes),
    per_color_supply_groups: [],
    missing_inputs: missingInputs,
    assumptions: {
      labor_rate_per_hour: 0,
      quantity_rounding: 'ceil',
    },
  }
}

export type {
  DrywallCalculationInput,
  DrywallCalculationOutput,
  DrywallRepairCalculationRow,
} from '@/types/estimator/drywall'
