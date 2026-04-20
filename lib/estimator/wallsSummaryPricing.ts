import type { WallCalculationOutput } from './walls.ts'

export type WallsSummarySnapshot = {
  scope_count: number
  included_scope_count: number
  totals: {
    effective_area_sf: number
    effective_total: number
    effective_paint_hours: number
    effective_primer_hours: number
    effective_paint_gallons: number
    effective_primer_gallons: number
    effective_supply_cost: number
  }
  rooms: Array<{
    room_id: string
    included_scope_count: number
    effective_area_sf: number
    effective_total: number
  }>
}

export type WallsPricingReadinessIssue = {
  code:
    | 'CALC_MISSING_INPUTS'
    | 'SCOPE_METRIC_MISSING'
    | 'SCOPE_TRACE_MISSING'
    | 'ROOM_TOTAL_MISMATCH'
  message: string
  room_id?: string
  scope_id?: string
}

function round4(value: number) {
  return Math.round((value + Number.EPSILON) * 10_000) / 10_000
}

function scopeKey(scope: WallCalculationOutput['scopes'][number]) {
  return scope.id ?? `${scope.room_id}::${scope.position}`
}

export function buildWallsSummarySnapshot(calculations: Pick<WallCalculationOutput, 'scopes' | 'room_totals'>) {
  const includedScopes = calculations.scopes.filter((scope) => scope.include === 'Y')
  const roomStats = new Map<string, { included_scope_count: number; effective_area_sf: number; effective_total: number }>()

  let effectiveAreaTotal = 0
  let effectiveTotal = 0
  let effectivePaintHours = 0
  let effectivePrimerHours = 0
  let effectivePaintGallons = 0
  let effectivePrimerGallons = 0
  let effectiveSupplyCost = 0

  for (const scope of includedScopes) {
    const area = scope.effective_area_sf ?? 0
    const total = scope.effective_total ?? 0
    const room = roomStats.get(scope.room_id) ?? { included_scope_count: 0, effective_area_sf: 0, effective_total: 0 }
    room.included_scope_count += 1
    room.effective_area_sf = round4(room.effective_area_sf + area)
    room.effective_total = round4(room.effective_total + total)
    roomStats.set(scope.room_id, room)

    effectiveAreaTotal = round4(effectiveAreaTotal + area)
    effectiveTotal = round4(effectiveTotal + total)
    effectivePaintHours = round4(effectivePaintHours + (scope.effective_paint_hours ?? 0))
    effectivePrimerHours = round4(effectivePrimerHours + (scope.effective_primer_hours ?? 0))
    effectivePaintGallons = round4(effectivePaintGallons + (scope.effective_paint_gallons ?? 0))
    effectivePrimerGallons = round4(effectivePrimerGallons + (scope.effective_primer_gallons ?? 0))
    effectiveSupplyCost = round4(effectiveSupplyCost + (scope.effective_supply_cost ?? 0))
  }

  return {
    scope_count: calculations.scopes.length,
    included_scope_count: includedScopes.length,
    totals: {
      effective_area_sf: effectiveAreaTotal,
      effective_total: effectiveTotal,
      effective_paint_hours: effectivePaintHours,
      effective_primer_hours: effectivePrimerHours,
      effective_paint_gallons: effectivePaintGallons,
      effective_primer_gallons: effectivePrimerGallons,
      effective_supply_cost: effectiveSupplyCost,
    },
    rooms: Array.from(roomStats.entries())
      .map(([room_id, room]) => ({ room_id, ...room }))
      .sort((a, b) => a.room_id.localeCompare(b.room_id)),
  } satisfies WallsSummarySnapshot
}

export function validateWallsPricingReadiness(
  calculations: Pick<WallCalculationOutput, 'scopes' | 'room_totals' | 'scope_traces' | 'missing_inputs'>
) {
  const issues: WallsPricingReadinessIssue[] = []

  if (calculations.missing_inputs.length > 0) {
    issues.push({
      code: 'CALC_MISSING_INPUTS',
      message: `${calculations.missing_inputs.length} calculation input(s) are missing`,
    })
  }

  const traceScopeKeySet = new Set(
    calculations.scope_traces.map((trace) => trace.scope_id ?? trace.scope_key)
  )

  for (const scope of calculations.scopes) {
    if (scope.include !== 'Y') continue
    const key = scopeKey(scope)
    if (!traceScopeKeySet.has(key)) {
      issues.push({
        code: 'SCOPE_TRACE_MISSING',
        message: `Included scope ${key} is missing a scope trace row`,
        room_id: scope.room_id,
        scope_id: key,
      })
    }

    const requiredMetrics: Array<[field: string, value: number | null]> = [
      ['effective_area_sf', scope.effective_area_sf],
      ['effective_total', scope.effective_total],
      ['effective_paint_hours', scope.effective_paint_hours],
      ['effective_primer_hours', scope.effective_primer_hours],
      ['effective_paint_gallons', scope.effective_paint_gallons],
      ['effective_primer_gallons', scope.effective_primer_gallons],
      ['effective_supply_cost', scope.effective_supply_cost],
    ]
    for (const [field, value] of requiredMetrics) {
      if (value == null) {
        issues.push({
          code: 'SCOPE_METRIC_MISSING',
          message: `Included scope ${key} is missing ${field}`,
          room_id: scope.room_id,
          scope_id: key,
        })
      }
    }
  }

  const roomSumMap = new Map<string, { area: number; total: number }>()
  for (const scope of calculations.scopes) {
    const entry = roomSumMap.get(scope.room_id) ?? { area: 0, total: 0 }
    entry.area += scope.effective_area_sf ?? 0
    entry.total += scope.effective_total ?? 0
    roomSumMap.set(scope.room_id, entry)
  }

  for (const room of calculations.room_totals) {
    const sums = roomSumMap.get(room.room_id) ?? { area: 0, total: 0 }
    if (Math.abs(round4(sums.area) - round4(room.effective_area_sf)) > 0.001) {
      issues.push({
        code: 'ROOM_TOTAL_MISMATCH',
        message: `Room ${room.room_id} effective area does not match scope rollup`,
        room_id: room.room_id,
      })
    }
    if (Math.abs(round4(sums.total) - round4(room.effective_total)) > 0.001) {
      issues.push({
        code: 'ROOM_TOTAL_MISMATCH',
        message: `Room ${room.room_id} effective total does not match scope rollup`,
        room_id: room.room_id,
      })
    }
  }

  return issues
}
