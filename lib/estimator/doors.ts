import {
  n,
  nonNeg,
  normalizeInclude,
  pos,
  resolveSettings,
  round4,
} from './wallsHelpers.ts'
import type { MissingInput, WallRoomTotal, YN } from './wallsTypes.ts'
import type {
  DoorCalculationInput,
  DoorCalculationOutput,
  DoorCalculationScopeResult,
  DoorCalculationScopeRow,
  DoorUnitRateCatalogRow,
} from '@/types/estimator/doors'

function doorScopeKey(scope: DoorCalculationScopeRow) {
  return scope.id ?? `${scope.room_id}::${scope.position ?? 0}`
}

function buildDoorRateMap(rates: DoorUnitRateCatalogRow[] | undefined) {
  const byId = new Map<string, DoorUnitRateCatalogRow>()
  for (const row of rates ?? []) {
    if (row.id) byId.set(row.id.toUpperCase(), row)
  }
  return byId
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

function buildRoomTotals(scopes: DoorCalculationScopeResult[]) {
  const totals = new Map<string, WallRoomTotal>()
  for (const scope of scopes) {
    const total = totals.get(scope.room_id) ?? emptyRoomTotal(scope.room_id)
    total.scope_count += 1
    if (scope.include === 'Y') total.included_scope_count += 1
    total.raw_paint_hours = round4(total.raw_paint_hours + scope.raw_paint_hours)
    total.effective_paint_hours = round4(total.effective_paint_hours + scope.effective_paint_hours)
    total.raw_primer_hours = round4(total.raw_primer_hours + scope.raw_primer_hours)
    total.effective_primer_hours = round4(total.effective_primer_hours + scope.effective_primer_hours)
    total.raw_supply_cost = round4(total.raw_supply_cost + scope.raw_supply_cost)
    total.effective_supply_cost = round4(total.effective_supply_cost + scope.effective_supply_cost)
    total.raw_total = round4(total.raw_total + scope.raw_total)
    total.effective_total = round4(total.effective_total + scope.effective_total)
    totals.set(scope.room_id, total)
  }
  return Array.from(totals.values()).sort((a, b) => a.room_id.localeCompare(b.room_id))
}

export function calculateDoors(input: DoorCalculationInput): DoorCalculationOutput {
  const settings = resolveSettings(input.settings ?? undefined, null)
  const rateMap = buildDoorRateMap(input.catalogs?.door_unit_rates)
  const missingInputs: MissingInput[] = []

  const scopes = input.scopes.map((scope): DoorCalculationScopeResult => {
    const include: YN = normalizeInclude(scope.include ?? 'Y')
    const scopeKey = doorScopeKey(scope)
    const rate = scope.door_type_id ? rateMap.get(scope.door_type_id.toUpperCase()) : undefined
    if (include === 'Y' && !rate) {
      missingInputs.push({
        level: 'scope',
        room_id: scope.room_id,
        scope_id: scopeKey,
        segment_id: null,
        field: 'door_type_id',
        message: `Door scope ${scope.scope_name ?? (scope.position ?? 0) + 1}: door type is required`,
      })
    }

    const quantity = nonNeg(n(scope.quantity))
    const sides = nonNeg(n(scope.sides))
    if (include === 'Y' && quantity == null) {
      missingInputs.push({
        level: 'scope',
        room_id: scope.room_id,
        scope_id: scopeKey,
        segment_id: null,
        field: 'quantity',
        message: `Door scope ${scope.scope_name ?? (scope.position ?? 0) + 1}: quantity is required`,
      })
    }
    if (include === 'Y' && sides == null) {
      missingInputs.push({
        level: 'scope',
        room_id: scope.room_id,
        scope_id: scopeKey,
        segment_id: null,
        field: 'sides',
        message: `Door scope ${scope.scope_name ?? (scope.position ?? 0) + 1}: sides is required`,
      })
    }
    if (include === 'Y' && sides != null && sides !== 1 && sides !== 2) {
      missingInputs.push({
        level: 'scope',
        room_id: scope.room_id,
        scope_id: scopeKey,
        segment_id: null,
        field: 'sides',
        message: `Door scope ${scope.scope_name ?? (scope.position ?? 0) + 1}: sides must be 1 or 2`,
      })
    }
    const billableSides = sides === 1 || sides === 2 ? sides : 0
    const rawUnits = round4((quantity ?? 0) * billableSides)
    const effectiveUnits = include === 'Y' ? rawUnits : 0
    const laborRate = nonNeg(n(scope.labor_rate)) ?? nonNeg(n(rate?.labor_rate)) ?? 0
    const materialRate =
      nonNeg(n(scope.material_rate)) ?? nonNeg(n(rate?.material_rate)) ?? nonNeg(n(rate?.amount)) ?? 0
    const paintCoats = pos(n(scope.paint_coats)) ?? settings.paint_coats
    const primerCoats = pos(n(scope.primer_coats)) ?? settings.primer_coats
    const spotPrimePercent = Math.min(100, nonNeg(n(scope.spot_prime_percent)) ?? settings.spot_prime_percent)
    const conditionFactor = nonNeg(n(scope.condition_factor)) ?? 1
    const primerMultiplier =
      include !== 'Y' || scope.prime_mode === 'NONE'
        ? 0
        : scope.prime_mode === 'FULL'
          ? 1
          : spotPrimePercent / 100

    const rawPaintHours = include === 'Y' ? round4(effectiveUnits * laborRate * paintCoats * conditionFactor) : 0
    const rawPrimerHours =
      include === 'Y' ? round4(effectiveUnits * laborRate * primerCoats * primerMultiplier * conditionFactor) : 0

    const overridePaintHours = nonNeg(n(scope.override_paint_hours))
    const overridePrimerHours = nonNeg(n(scope.override_primer_hours))
    const overrideHours =
      overridePaintHours == null && overridePrimerHours == null
        ? null
        : {
            primary: overridePaintHours ?? rawPaintHours,
            secondary: overridePrimerHours ?? rawPrimerHours,
          }
    const effectivePaintHours = include === 'Y' ? overrideHours?.primary ?? rawPaintHours : 0
    const effectivePrimerHours = include === 'Y' ? overrideHours?.secondary ?? rawPrimerHours : 0

    const rawMaterialCost = include === 'Y' ? round4(effectiveUnits * materialRate) : 0
    const effectiveMaterialCost = include === 'Y' ? round4(nonNeg(n(scope.override_material_cost)) ?? rawMaterialCost) : 0
    const rawSupplyCost = 0
    const effectiveSupplyCost = include === 'Y' ? round4(nonNeg(n(scope.override_supply_cost)) ?? rawSupplyCost) : 0
    const laborCost = round4((effectivePaintHours + effectivePrimerHours) * settings.labor_rate_per_hour)
    const rawLaborCost = round4((rawPaintHours + rawPrimerHours) * settings.labor_rate_per_hour)
    const rawTotal = round4(rawLaborCost + rawMaterialCost + rawSupplyCost)
    const effectiveBeforeOverride = round4(laborCost + effectiveMaterialCost + effectiveSupplyCost)
    const overrideTotal = include === 'Y' ? nonNeg(n(scope.override_total)) : null

    return {
      ...scope,
      include,
      raw_units: include === 'Y' ? rawUnits : 0,
      effective_units: effectiveUnits,
      raw_paint_hours: rawPaintHours,
      effective_paint_hours: effectivePaintHours,
      raw_primer_hours: rawPrimerHours,
      effective_primer_hours: effectivePrimerHours,
      raw_paint_gallons: 0,
      effective_paint_gallons: 0,
      raw_primer_gallons: 0,
      effective_primer_gallons: 0,
      raw_material_cost: rawMaterialCost,
      effective_material_cost: effectiveMaterialCost,
      raw_supply_cost: rawSupplyCost,
      effective_supply_cost: effectiveSupplyCost,
      raw_total: rawTotal,
      effective_total: round4(overrideTotal ?? effectiveBeforeOverride),
    }
  })

  return {
    scopes,
    room_totals: buildRoomTotals(scopes),
    per_color_supply_groups: [],
    missing_inputs: missingInputs,
    assumptions: {
      labor_rate_per_hour: settings.labor_rate_per_hour,
      crew_size: settings.crew_size,
    },
  }
}

export type {
  DoorCalculationInput,
  DoorCalculationOutput,
  DoorCalculationScopeRow,
} from '@/types/estimator/doors'
