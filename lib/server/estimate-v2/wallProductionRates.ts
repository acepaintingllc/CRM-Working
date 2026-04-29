import { asNullableNumber, asText } from '../../estimator/parsing.ts'
import type { WallCalculationScopeRow } from '../../estimator/wallsTypes.ts'

type RoomWallRateSelection = {
  room_id?: unknown
  wall_complexity_id?: unknown
  wall_complexity_type_id?: unknown
}

type WallProductionRateRow = {
  id?: unknown
  scope_id?: unknown
  sqft_per_hr?: unknown
  prep_sqft_per_hr?: unknown
  primer_sqft_per_hr?: unknown
}

function normalizeId(value: unknown) {
  return asText(value).toUpperCase()
}

function positiveNumber(value: unknown) {
  const parsed = asNullableNumber(value)
  return parsed != null && parsed > 0 ? parsed : null
}

function isWallProductionRate(row: WallProductionRateRow) {
  const scope = normalizeId(row.scope_id)
  return scope === 'WALLS' || scope === 'WALL'
}

function buildWallProductionRateById(rows: WallProductionRateRow[]) {
  const rates = new Map<string, WallProductionRateRow>()
  for (const row of rows) {
    const id = normalizeId(row.id)
    if (!id || !isWallProductionRate(row)) continue
    rates.set(id, row)
  }
  return rates
}

function buildSelectedWallRateByRoomId(params: {
  rooms: RoomWallRateSelection[]
  ratesById: Map<string, WallProductionRateRow>
}) {
  const selected = new Map<string, WallProductionRateRow>()
  for (const room of params.rooms) {
    const roomId = normalizeId(room.room_id)
    const rateId = normalizeId(room.wall_complexity_id || room.wall_complexity_type_id)
    const rate = params.ratesById.get(rateId)
    if (roomId && rate) selected.set(roomId, rate)
  }
  return selected
}

export function applySelectedWallProductionRates<TScope extends WallCalculationScopeRow>(params: {
  rooms: RoomWallRateSelection[]
  scopes: TScope[]
  productionRates: WallProductionRateRow[]
}): TScope[] {
  const ratesById = buildWallProductionRateById(params.productionRates)
  if (ratesById.size === 0) return params.scopes

  const selectedRateByRoomId = buildSelectedWallRateByRoomId({
    rooms: params.rooms,
    ratesById,
  })
  if (selectedRateByRoomId.size === 0) return params.scopes

  return params.scopes.map((scope) => {
    const rate = selectedRateByRoomId.get(normalizeId(scope.room_id))
    if (!rate) return scope

    const paintRate = positiveNumber(rate.sqft_per_hr ?? rate.prep_sqft_per_hr)
    const primerRate = positiveNumber(rate.primer_sqft_per_hr)
    if (paintRate == null && primerRate == null) return scope

    return {
      ...scope,
      paint_prod_rate_sqft_per_hour:
        positiveNumber(scope.paint_prod_rate_sqft_per_hour) ?? paintRate,
      primer_prod_rate_sqft_per_hour:
        positiveNumber(scope.primer_prod_rate_sqft_per_hour) ?? primerRate,
    }
  })
}
