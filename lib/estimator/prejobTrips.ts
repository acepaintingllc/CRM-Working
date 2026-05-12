import { asNullableNumber, asText } from './parsing.ts'

export type PrejobTripCalculationRow = {
  id?: string | null
  room_id?: string | null
  position?: number | string | null
  active?: string | null
  trip_name?: string | null
  man_trip_name?: string | null
  task?: string | null
  trip_num?: number | string | null
  trip_rate?: number | string | null
  manual_adjustment?: number | string | null
  notes?: string | null
}

export type PrejobTripCalculationScopeResult = PrejobTripCalculationRow & {
  id: string
  room_id: string | null
  position: number
  include: 'Y' | 'N'
  label: string | null
  trip_count: number
  trip_rate: number
  manual_adjustment: number
  calculated_total: number
  raw_total: number
  effective_total: number
  raw_paint_hours: number
  effective_paint_hours: number
  raw_primer_hours: number
  effective_primer_hours: number
  effective_paint_gallons: number
  effective_primer_gallons: number
  effective_supply_cost: number
}

export type PrejobTripCalculationOutput = {
  scopes: PrejobTripCalculationScopeResult[]
  room_totals: Array<{ room_id: string; effective_total: number }>
  job_level_total: number
  per_color_supply_groups: Array<{ allocations: Array<{ allocated_supply_cost: number }> }>
  assumptions: { labor_rate_per_hour: number }
}

function round4(value: number) {
  return Math.round((value + Number.EPSILON) * 10_000) / 10_000
}

function normalizeInclude(value: unknown): 'Y' | 'N' {
  return asText(value).toUpperCase() === 'N' ? 'N' : 'Y'
}

function nonNegative(value: unknown) {
  const parsed = asNullableNumber(value)
  return parsed == null || parsed < 0 ? 0 : parsed
}

function textOrNull(value: unknown) {
  const text = asText(value)
  return text || null
}

export function calculatePrejobTrips(params: {
  rows: PrejobTripCalculationRow[]
  settings?: { labor_rate_per_hour?: number | null }
}): PrejobTripCalculationOutput {
  const roomTotals = new Map<string, number>()
  let jobLevelTotal = 0
  const scopes = params.rows.map((row, index): PrejobTripCalculationScopeResult => {
    const include = normalizeInclude(row.active)
    const roomId = textOrNull(row.room_id)?.toUpperCase() ?? null
    const tripCount = nonNegative(row.trip_num)
    const tripRate = nonNegative(row.trip_rate)
    const manualAdjustment = nonNegative(row.manual_adjustment)
    const calculatedTotal = round4(tripCount * tripRate)
    const rawTotal = round4(calculatedTotal + manualAdjustment)
    const effectiveTotal = include === 'Y' ? rawTotal : 0

    if (include === 'Y' && roomId) {
      roomTotals.set(roomId, round4((roomTotals.get(roomId) ?? 0) + effectiveTotal))
    } else if (include === 'Y') {
      jobLevelTotal = round4(jobLevelTotal + effectiveTotal)
    }

    return {
      ...row,
      id: textOrNull(row.id) ?? `prejob-${index + 1}`,
      room_id: roomId,
      position: asNullableNumber(row.position) ?? index,
      include,
      label: textOrNull(row.trip_name ?? row.man_trip_name ?? row.task),
      trip_count: tripCount,
      trip_rate: tripRate,
      manual_adjustment: manualAdjustment,
      calculated_total: calculatedTotal,
      raw_total: rawTotal,
      effective_total: effectiveTotal,
      raw_paint_hours: 0,
      effective_paint_hours: 0,
      raw_primer_hours: 0,
      effective_primer_hours: 0,
      effective_paint_gallons: 0,
      effective_primer_gallons: 0,
      effective_supply_cost: 0,
    }
  })

  return {
    scopes,
    room_totals: [...roomTotals.entries()]
      .map(([room_id, effective_total]) => ({ room_id, effective_total }))
      .sort((a, b) => a.room_id.localeCompare(b.room_id)),
    job_level_total: round4(jobLevelTotal),
    per_color_supply_groups: [],
    assumptions: { labor_rate_per_hour: Math.max(0, params.settings?.labor_rate_per_hour ?? 0) },
  }
}
